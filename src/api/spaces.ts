import { Hono } from 'hono';
import type { Bindings, User, Space } from '../types';

const spaces = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

/** 공간 목록 (모든 사용자) */
spaces.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM spaces ORDER BY display_order ASC'
  ).all<Space>();
  return c.json({ spaces: result.results });
});

/** 공간 생성 (관리자) */
spaces.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const body = await c.req.json<Partial<Space>>();
  if (!body.name) return c.json({ error: '공간명을 입력해 주세요.' }, 400);

  const order = await c.env.DB.prepare('SELECT COALESCE(MAX(display_order), 0) + 1 as next FROM spaces').first<{ next: number }>();
  const result = await c.env.DB.prepare(`
    INSERT INTO spaces (name, type, capacity, color, count_in_limit, display_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    body.name,
    body.type || 'meeting_room',
    body.capacity ?? 4,
    body.color || '#0066cc',
    body.count_in_limit ?? 1,
    order?.next ?? 1
  ).run();

  return c.json({ ok: true, id: result.meta.last_row_id });
});

/** 공간 수정 (관리자) */
spaces.patch('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const id = Number(c.req.param('id'));
  const body = await c.req.json<Partial<Space>>();

  const existing = await c.env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(id).first<Space>();
  if (!existing) return c.json({ error: '공간을 찾을 수 없습니다.' }, 404);

  await c.env.DB.prepare(`
    UPDATE spaces
    SET name = ?, type = ?, capacity = ?, color = ?, count_in_limit = ?
    WHERE id = ?
  `).bind(
    body.name ?? existing.name,
    body.type ?? existing.type,
    body.capacity ?? existing.capacity,
    body.color ?? existing.color,
    body.count_in_limit ?? existing.count_in_limit,
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
