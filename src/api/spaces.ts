import { Hono } from 'hono';
import type { Bindings, User, Space } from '../types';

const spaces = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

/**
 * 공간 목록 (V5 — REQ-AUTH-01 / V7 최종본 §1 — 자동 정렬 알고리즘)
 *
 * 정렬 우선순위:
 *  1. 'Meeting Room A'~'Meeting Room E' (정확 매칭) — 알파벳 순
 *  2. 그 외 모든 회의실(type='meeting_room', 신규 생성 회의실 포함) — display_order 순
 *  3. 'Lounge', 'Recharging Zone' (정확 매칭) — 항상 맨 마지막에 고정
 *
 * - tenant_scope IS NULL: 모든 테넌트 공개
 * - tenant_scope = '<사용자의 테넌트>': 해당 테넌트만 조회 가능
 */
spaces.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    `SELECT * FROM spaces
     WHERE tenant_scope IS NULL OR tenant_scope = ?
     ORDER BY display_order ASC`
  ).bind(user.tenant_id).all<Space>();

  // V7 최종본 §1: 자동 정렬 규칙 적용 (백엔드 응답 시점에 정렬)
  const PINNED_TAIL = ['Lounge', 'Recharging Zone']; // 항상 맨 뒤 고정
  const PRIMARY_ORDER = ['Meeting Room A', 'Meeting Room B', 'Meeting Room C', 'Meeting Room D', 'Meeting Room E'];

  const all = (result.results || []) as Space[];
  const primary = PRIMARY_ORDER
    .map(name => all.find(s => s.name === name))
    .filter((s): s is Space => !!s);
  const pinnedTail = PINNED_TAIL
    .map(name => all.find(s => s.name === name))
    .filter((s): s is Space => !!s);
  const rest = all.filter(s =>
    !PRIMARY_ORDER.includes(s.name) && !PINNED_TAIL.includes(s.name)
  ); // 신규 회의실/공용공간 — 기존 display_order 유지

  const sorted = [...primary, ...rest, ...pinnedTail];

  return c.json({ spaces: sorted });
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
