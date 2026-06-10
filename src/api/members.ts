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
    // V5 REQ-SEC-01: 관리자 생성 계정은 최초 로그인 시 비번 강제 변경 필요
    const result = await c.env.DB.prepare(`
      INSERT INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color, is_first_login)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'active', ?, 1)
    `).bind(
      user.tenant_id, body.email, hashed, body.name,
      body.department || null, body.position || null,
      body.role || 'member', avatarColor
    ).run();
    return c.json({ ok: true, id: result.meta.last_row_id, initial_password: body.password ? null : password });
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
        INSERT INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color, is_first_login)
        VALUES (?, ?, ?, ?, ?, ?, NULL, 'member', 'active', ?, 1)
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

  // V13 §1: 관련 데이터 정리 — FK 위반 차단을 위해 reservations 자체도 DELETE
  // (V12까지는 status='cancelled' UPDATE만 했으나, NO ACTION FK 때문에 위반 발생)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM reservation_attendees WHERE member_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM reservations WHERE user_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ]);
  } catch (e: any) {
    console.error('[delete-member] FAILED', e);
    return c.json({ error: `삭제 실패: ${String(e?.message || e)}` }, 500);
  }
  return c.json({ ok: true });
});

/**
 * V13 §1: 일반 멤버 일괄 삭제 — FK 위반 완전 해결판
 *
 * 진단 (V12 실패 원인):
 *  - reservations.user_id는 users(id)를 NO ACTION FK로 참조
 *  - V12는 reservations를 status='cancelled'로 UPDATE만 했음 → FK가 살아있음
 *  - D1 batch 안에서 DELETE FROM users 시도 → FOREIGN KEY constraint failed
 *  - 결과: 전체 트랜잭션 롤백 → "일괄 삭제 실패" 토스트
 *
 * V13 해결:
 *  - reservations 자체를 DELETE (cancelled 보존 안 함 — 삭제된 사용자의 예약은 의미 없음)
 *  - reservation_attendees는 CASCADE라 자동 정리됨
 *  - 본인 계정만 제외, admin 계정도 일괄 삭제 가능 (단, "본인은 절대 제외")
 *    → 사용자 요구: "admin@wylie.co.kr을 제외한 모든 계정 삭제 (단, 러쉬 어드민은 삭제하지 않음)"
 *    = 같은 tenant 안에서 본인만 제외하면 됨 (러쉬 admin은 다른 tenant이므로 자동 제외)
 */
members.post('/bulk-delete', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const body = await c.req.json<{
    member_ids?: number[];
    exclude_admin?: boolean; // V13: true면 다른 admin 계정도 제외 (안전 모드)
  }>();
  const rawIds = Array.isArray(body?.member_ids) ? body.member_ids : [];
  // 정수 + 본인 제외 + 중복 제거
  const ids = Array.from(new Set(
    rawIds.map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0 && n !== user.id)
  ));
  if (!ids.length) return c.json({ error: '삭제할 대상이 없습니다.' }, 400);

  // 같은 tenant 안에서만 (러쉬코리아 admin은 다른 tenant라 자동 제외됨)
  const placeholders = ids.map(() => '?').join(',');
  const eligible = await c.env.DB.prepare(
    `SELECT id, role FROM users WHERE tenant_id = ? AND id IN (${placeholders})`
  ).bind(user.tenant_id, ...ids).all<{ id: number; role: string }>();

  let eligibleRows = eligible.results || [];
  // V13: exclude_admin=true일 때만 admin role 제외 (체크박스 기반 일괄삭제는 true)
  // 사용자가 명시적으로 "admin 포함 전체 삭제" 명령 시 false (관리자 본인 제외 자동)
  if (body.exclude_admin !== false) {
    eligibleRows = eligibleRows.filter(r => r.role !== 'admin');
  }
  const eligibleIds = eligibleRows.map(r => r.id);

  if (!eligibleIds.length) {
    return c.json({ error: '삭제 가능한 대상이 없습니다.' }, 400);
  }

  const skipped = ids.length - eligibleIds.length;

  // V13 §1 핵심: reservations 자체를 DELETE (status update가 아니라!) → FK 위반 차단
  // reservation_attendees는 CASCADE라 자동 삭제됨
  // V13 §1-PATCH: SQLite 변수 ~100개 제한 차단을 위해 50개씩 청크 처리
  const CHUNK = 50;
  let deleted = 0;
  try {
    for (let i = 0; i < eligibleIds.length; i += CHUNK) {
      const chunk = eligibleIds.slice(i, i + CHUNK);
      const ph = chunk.map(() => '?').join(',');
      await c.env.DB.batch([
        c.env.DB.prepare(`DELETE FROM reservation_attendees WHERE member_id IN (${ph})`).bind(...chunk),
        c.env.DB.prepare(`DELETE FROM reservations WHERE user_id IN (${ph})`).bind(...chunk),
        c.env.DB.prepare(`DELETE FROM sessions WHERE user_id IN (${ph})`).bind(...chunk),
        c.env.DB.prepare(`DELETE FROM users WHERE id IN (${ph})`).bind(...chunk),
      ]);
      deleted += chunk.length;
    }
  } catch (e: any) {
    console.error('[bulk-delete] FAILED at chunk', deleted, e);
    return c.json({ error: `일괄 삭제 실패 (${deleted}명 처리 후 중단): ${String(e?.message || e)}` }, 500);
  }

  return c.json({
    ok: true,
    deleted,
    skipped, // 다른 tenant / admin role(exclude_admin=true일 때) / 본인 등으로 거부된 건수
  });
});

/**
 * V13 §1: admin@wylie.co.kr을 제외한 모든 멤버 일괄 삭제 (전체 비우기)
 *  - 사용자 요청: "아예 그냥 admin@wylie.co.kr을 제외한 모든 계정 삭제"
 *  - 본인(요청자) + 본인이 admin이고 본인 회사의 마지막 admin이라면 그것도 보호
 *  - 같은 tenant 안에서만 작동 (러쉬 admin은 자동 제외)
 */
members.post('/purge-all-except-self', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  // 같은 tenant 안에서 본인(요청자)만 제외한 모든 사용자 ID 조회
  const allUsers = await c.env.DB.prepare(
    `SELECT id FROM users WHERE tenant_id = ? AND id != ?`
  ).bind(user.tenant_id, user.id).all<{ id: number }>();

  const targetIds = (allUsers.results || []).map(r => r.id);
  if (!targetIds.length) {
    return c.json({ ok: true, deleted: 0, message: '삭제할 멤버가 없습니다.' });
  }

  // V13 §1-PATCH: SQLite는 SQL 1개당 변수 ~100개 제한 → 청크 단위로 분할 처리
  //   ── 와일리 195명 같은 대용량 케이스에서 "too many SQL variables" 에러 차단
  const CHUNK = 50;
  const chunks: number[][] = [];
  for (let i = 0; i < targetIds.length; i += CHUNK) {
    chunks.push(targetIds.slice(i, i + CHUNK));
  }

  let deleted = 0;
  try {
    for (const ids of chunks) {
      const ph = ids.map(() => '?').join(',');
      await c.env.DB.batch([
        c.env.DB.prepare(`DELETE FROM reservation_attendees WHERE member_id IN (${ph})`).bind(...ids),
        c.env.DB.prepare(`DELETE FROM reservations WHERE user_id IN (${ph})`).bind(...ids),
        c.env.DB.prepare(`DELETE FROM sessions WHERE user_id IN (${ph})`).bind(...ids),
        c.env.DB.prepare(`DELETE FROM users WHERE id IN (${ph})`).bind(...ids),
      ]);
      deleted += ids.length;
    }
  } catch (e: any) {
    console.error('[purge-all] FAILED at chunk', deleted, e);
    return c.json({ error: `전체 삭제 실패 (${deleted}명 처리 후 중단): ${String(e?.message || e)}` }, 500);
  }

  return c.json({ ok: true, deleted });
});

/** 모든 사용자 검색 (참석자 추가용) - 본인 회사 멤버만 */
/**
 * V7 고도화 §2: 참석자 자동완성용 멤버 검색
 *  - 이름 / 이메일 / 부서 / 직책 모두 LIKE 매칭
 *  - 빈 q일 때도 같은 테넌트의 활성 멤버 상위 20명 반환 (드롭다운 초기 노출)
 *  - 본인은 응답에서 제외 (자신을 참석자로 초대 불가)
 */
members.get('/search', async (c) => {
  const user = c.get('user');
  const q = (c.req.query('q') || '').trim();
  const limit = Math.min(Number(c.req.query('limit')) || 20, 50);

  let sql = `
    SELECT id, name, email, avatar_color, department, position
    FROM users
    WHERE tenant_id = ? AND status = 'active' AND id != ?
  `;
  const binds: any[] = [user.tenant_id, user.id];

  if (q) {
    sql += ` AND (name LIKE ? OR email LIKE ? OR IFNULL(department,'') LIKE ? OR IFNULL(position,'') LIKE ?)`;
    const wild = `%${q}%`;
    binds.push(wild, wild, wild, wild);
  }
  sql += ` ORDER BY name ASC LIMIT ?`;
  binds.push(limit);

  const result = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ users: result.results || [] });
});

export default members;
