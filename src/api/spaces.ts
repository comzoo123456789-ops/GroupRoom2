import { Hono } from 'hono';
import type { Bindings, User, Space } from '../types';

const spaces = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

/**
 * 공간 목록 (V5 — REQ-AUTH-01)
 * - tenant_scope IS NULL: 모든 테넌트 공개
 * - tenant_scope = '<사용자의 테넌트>': 해당 테넌트만 조회 가능
 * - 다른 테넌트의 전용 공간은 응답에서 제외 (5층 회의실은 WYLIE 전용)
 */
spaces.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    `SELECT * FROM spaces
     WHERE tenant_scope IS NULL OR tenant_scope = ?
     ORDER BY display_order ASC`
  ).bind(user.tenant_id).all<Space>();
  return c.json({ spaces: result.results });
});

/** 공간 생성 (관리자) — V5: tenant_scope 옵션 지원 */
spaces.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const body = await c.req.json<Partial<Space> & { tenant_scope?: string | null }>();
  if (!body.name) return c.json({ error: '공간명을 입력해 주세요.' }, 400);

  const order = await c.env.DB.prepare('SELECT COALESCE(MAX(display_order), 0) + 1 as next FROM spaces').first<{ next: number }>();
  const result = await c.env.DB.prepare(`
    INSERT INTO spaces (name, type, capacity, color, count_in_limit, display_order, tenant_scope)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.name,
    body.type || 'meeting_room',
    body.capacity ?? 4,
    body.color || '#0066cc',
    body.count_in_limit ?? 1,
    order?.next ?? 1,
    body.tenant_scope || null
  ).run();

  return c.json({ ok: true, id: result.meta.last_row_id });
});

/** 공간 수정 (관리자) — V5: tenant_scope 변경 지원 */
spaces.patch('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const id = Number(c.req.param('id'));
  const body = await c.req.json<Partial<Space> & { tenant_scope?: string | null }>();

  const existing = await c.env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(id).first<Space>();
  if (!existing) return c.json({ error: '공간을 찾을 수 없습니다.' }, 404);

  await c.env.DB.prepare(`
    UPDATE spaces
    SET name = ?, type = ?, capacity = ?, color = ?, count_in_limit = ?, tenant_scope = ?
    WHERE id = ?
  `).bind(
    body.name ?? existing.name,
    body.type ?? existing.type,
    body.capacity ?? existing.capacity,
    body.color ?? existing.color,
    body.count_in_limit ?? existing.count_in_limit,
    body.tenant_scope !== undefined ? body.tenant_scope : (existing as any).tenant_scope ?? null,
    id
  ).run();

  return c.json({ ok: true });
});

/** 공간 삭제 (관리자) - 관련 예약은 함께 취소 처리 */
spaces.delete('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const id = Number(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(id).first<Space>();
  if (!existing) return c.json({ error: '공간을 찾을 수 없습니다.' }, 404);

  await c.env.DB.prepare("UPDATE reservations SET status = 'cancelled' WHERE space_id = ?").bind(id).run();
  await c.env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(id).run();

  return c.json({ ok: true });
});

export default spaces;
