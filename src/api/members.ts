import { Hono } from 'hono';
import { sha256 } from '../auth';
import type { Bindings, User } from '../types';

const members = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

const AVATAR_COLORS = ['#facc15', '#f97316', '#10b981', '#0066cc', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4'];

/** 내 회사 멤버 목록 (관리자) */
members.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const result = await c.env.DB.prepare(`
    SELECT id, tenant_id, email, name, department, position, role, status, avatar_color, created_at
    FROM users WHERE tenant_id = ? ORDER BY created_at DESC
  `).bind(user.tenant_id).all();

  return c.json({ members: result.results || [] });
});

/** 개별 등록 — V4: 휴대폰 필드 제거, 이름/이메일/패스워드/부서/직책만 사용 */
members.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const body = await c.req.json<{
    name: string;
    email: string;
    password?: string;
    department?: string;
    position?: string;
    role?: 'admin' | 'member';
  }>();

  if (!body.name || !body.email) {
    return c.json({ error: '이름과 이메일은 필수입니다.' }, 400);
  }

  const password = body.password || 'user1234';
  const hashed = await sha256(password);
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'active', ?)
    `).bind(
      user.tenant_id, body.email, hashed, body.name,
      body.department || null, body.position || null,
      body.role || 'member', avatarColor
    ).run();
    return c.json({ ok: true, id: result.meta.last_row_id });
  } catch (e: any) {
    if (String(e).includes('UNIQUE')) {
      return c.json({ error: '이미 등록된 이메일입니다.' }, 409);
    }
    return c.json({ error: '등록 중 오류가 발생했습니다.' }, 500);
  }
});

/** 일괄 등록 — V4: 휴대폰 필드 제거 */
members.post('/bulk', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const body = await c.req.json<{
    members: Array<{ name: string; email: string; department?: string; position?: string }>;
  }>();

  if (!body.members || !Array.isArray(body.members)) {
    return c.json({ error: '멤버 목록을 입력해 주세요.' }, 400);
  }

  const password = await sha256('user1234');
  let success = 0;
  const failed: string[] = [];

  for (const m of body.members) {
    if (!m.name || !m.email) {
      failed.push(`${m.email || m.name}: 이름/이메일 누락`);
      continue;
    }
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    try {
      await c.env.DB.prepare(`
        INSERT INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color)
        VALUES (?, ?, ?, ?, ?, ?, NULL, 'member', 'active', ?)
      `).bind(user.tenant_id, m.email, password, m.name, m.department || null, m.position || null, avatarColor).run();
      success++;
    } catch (e) {
      failed.push(`${m.email}: 이미 등록됨`);
    }
  }

  return c.json({ ok: true, success, failed });
});

/** 멤버 수정 (관리자) */
members.patch('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const id = Number(c.req.param('id'));
  const body = await c.req.json<{
    name?: string;
    email?: string;
    department?: string;
    position?: string;
    role?: 'admin' | 'member';
    password?: string;
  }>();

  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').bind(id, user.tenant_id).first<User>();
  if (!target) return c.json({ error: '멤버를 찾을 수 없습니다.' }, 404);

  const fields: string[] = [];
  const binds: any[] = [];
  if (body.name !== undefined) { fields.push('name = ?'); binds.push(body.name); }
  if (body.email !== undefined) { fields.push('email = ?'); binds.push(body.email); }
  if (body.department !== undefined) { fields.push('department = ?'); binds.push(body.department || null); }
  if (body.position !== undefined) { fields.push('position = ?'); binds.push(body.position || null); }
  if (body.role !== undefined) { fields.push('role = ?'); binds.push(body.role); }
  if (body.password) {
    fields.push('password = ?');
    binds.push(await sha256(body.password));
  }

  if (!fields.length) return c.json({ ok: true });

  try {
    await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...binds, id).run();
    return c.json({ ok: true });
  } catch (e: any) {
    if (String(e).includes('UNIQUE')) return c.json({ error: '이미 등록된 이메일입니다.' }, 409);
    return c.json({ error: '수정 중 오류가 발생했습니다.' }, 500);
  }
});

/**
 * 멤버 삭제 — V4: 하드코딩된 락 제거.
 * 본인 계정만 삭제 불가(자기 자신을 삭제하면 즉시 로그아웃 처리되어 운영 사고 위험).
 */
members.delete('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);
  const id = Number(c.req.param('id'));

  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').bind(id, user.tenant_id).first<User>();
  if (!target) return c.json({ error: '멤버를 찾을 수 없습니다.' }, 404);
  if (target.id === user.id) return c.json({ error: '본인 계정은 삭제할 수 없습니다.' }, 400);

  // 본인 회사의 마지막 관리자 계정 삭제 방지
  if (target.role === 'admin') {
    const cnt = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND role = 'admin' AND status = 'active'"
    ).bind(user.tenant_id).first<{ c: number }>();
    if ((cnt?.c ?? 0) <= 1) {
      return c.json({ error: '회사의 마지막 관리자 계정은 삭제할 수 없습니다.' }, 400);
    }
  }

  // 관련 데이터 정리
  await c.env.DB.prepare("UPDATE reservations SET status = 'cancelled' WHERE user_id = ?").bind(id).run();
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

/** 모든 사용자 검색 (참석자 추가용) - 본인 회사 멤버만 */
members.get('/search', async (c) => {
  const user = c.get('user');
  const q = c.req.query('q') || '';
  const result = await c.env.DB.prepare(`
    SELECT id, name, email, avatar_color FROM users
    WHERE tenant_id = ? AND status = 'active' AND (name LIKE ? OR email LIKE ?)
    LIMIT 10
  `).bind(user.tenant_id, `%${q}%`, `%${q}%`).all();
  return c.json({ users: result.results || [] });
});

export default members;
