/**
 * 부서(departments) · 직책(positions) 관리 API
 * - 테넌트별 격리
 * - 관리자 전용 (조회는 활성 멤버 모두 가능: 멤버 생성 폼 드롭다운에 사용)
 */
import { Hono } from 'hono';
import type { Bindings, User, Department, Position } from '../types';

const org = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

// ============ 부서 ============
org.get('/departments', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT * FROM departments WHERE tenant_id = ? ORDER BY display_order ASC, id ASC'
  ).bind(user.tenant_id).all<Department>();
  return c.json({ departments: result.results || [] });
});

org.post('/departments', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 가능합니다.' }, 403);
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: '부서명을 입력해 주세요.' }, 400);

  try {
    const max = await c.env.DB.prepare(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS n FROM departments WHERE tenant_id = ?'
    ).bind(user.tenant_id).first<{ n: number }>();
    const result = await c.env.DB.prepare(
      'INSERT INTO departments (tenant_id, name, display_order) VALUES (?, ?, ?)'
    ).bind(user.tenant_id, name.trim(), max?.n ?? 1).run();
    return c.json({ ok: true, id: result.meta.last_row_id });
  } catch (e: any) {
    if (String(e).includes('UNIQUE')) return c.json({ error: '이미 등록된 부서명입니다.' }, 409);
    return c.json({ error: '등록 중 오류가 발생했습니다.' }, 500);
  }
});

org.patch('/departments/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 가능합니다.' }, 403);
  const id = Number(c.req.param('id'));
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: '부서명을 입력해 주세요.' }, 400);

  const target = await c.env.DB.prepare('SELECT * FROM departments WHERE id = ? AND tenant_id = ?')
    .bind(id, user.tenant_id).first<Department>();
  if (!target) return c.json({ error: '부서를 찾을 수 없습니다.' }, 404);

  try {
    // 기존 이름을 참조하는 사용자도 함께 갱신
    await c.env.DB.prepare('UPDATE users SET department = ? WHERE tenant_id = ? AND department = ?')
      .bind(name.trim(), user.tenant_id, target.name).run();
    await c.env.DB.prepare('UPDATE departments SET name = ? WHERE id = ?').bind(name.trim(), id).run();
    return c.json({ ok: true });
  } catch (e: any) {
    if (String(e).includes('UNIQUE')) return c.json({ error: '이미 등록된 부서명입니다.' }, 409);
    return c.json({ error: '수정 중 오류가 발생했습니다.' }, 500);
  }
});

org.delete('/departments/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 가능합니다.' }, 403);
  const id = Number(c.req.param('id'));
  const target = await c.env.DB.prepare('SELECT * FROM departments WHERE id = ? AND tenant_id = ?')
    .bind(id, user.tenant_id).first<Department>();
  if (!target) return c.json({ error: '부서를 찾을 수 없습니다.' }, 404);

  await c.env.DB.prepare('UPDATE users SET department = NULL WHERE tenant_id = ? AND department = ?')
    .bind(user.tenant_id, target.name).run();
  await c.env.DB.prepare('DELETE FROM departments WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ============ 직책 ============
org.get('/positions', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT * FROM positions WHERE tenant_id = ? ORDER BY display_order ASC, id ASC'
  ).bind(user.tenant_id).all<Position>();
  return c.json({ positions: result.results || [] });
});

org.post('/positions', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 가능합니다.' }, 403);
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: '직책을 입력해 주세요.' }, 400);

  try {
    const max = await c.env.DB.prepare(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS n FROM positions WHERE tenant_id = ?'
    ).bind(user.tenant_id).first<{ n: number }>();
    const result = await c.env.DB.prepare(
      'INSERT INTO positions (tenant_id, name, display_order) VALUES (?, ?, ?)'
    ).bind(user.tenant_id, name.trim(), max?.n ?? 1).run();
    return c.json({ ok: true, id: result.meta.last_row_id });
  } catch (e: any) {
    if (String(e).includes('UNIQUE')) return c.json({ error: '이미 등록된 직책입니다.' }, 409);
    return c.json({ error: '등록 중 오류가 발생했습니다.' }, 500);
  }
});

org.patch('/positions/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 가능합니다.' }, 403);
  const id = Number(c.req.param('id'));
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: '직책을 입력해 주세요.' }, 400);

  const target = await c.env.DB.prepare('SELECT * FROM positions WHERE id = ? AND tenant_id = ?')
    .bind(id, user.tenant_id).first<Position>();
  if (!target) return c.json({ error: '직책을 찾을 수 없습니다.' }, 404);

  try {
    await c.env.DB.prepare('UPDATE users SET position = ? WHERE tenant_id = ? AND position = ?')
      .bind(name.trim(), user.tenant_id, target.name).run();
    await c.env.DB.prepare('UPDATE positions SET name = ? WHERE id = ?').bind(name.trim(), id).run();
    return c.json({ ok: true });
  } catch (e: any) {
    if (String(e).includes('UNIQUE')) return c.json({ error: '이미 등록된 직책입니다.' }, 409);
    return c.json({ error: '수정 중 오류가 발생했습니다.' }, 500);
  }
});

org.delete('/positions/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 가능합니다.' }, 403);
  const id = Number(c.req.param('id'));
  const target = await c.env.DB.prepare('SELECT * FROM positions WHERE id = ? AND tenant_id = ?')
    .bind(id, user.tenant_id).first<Position>();
  if (!target) return c.json({ error: '직책을 찾을 수 없습니다.' }, 404);

  await c.env.DB.prepare('UPDATE users SET position = NULL WHERE tenant_id = ? AND position = ?')
    .bind(user.tenant_id, target.name).run();
  await c.env.DB.prepare('DELETE FROM positions WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default org;
