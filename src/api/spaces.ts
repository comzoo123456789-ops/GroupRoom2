import { Hono } from 'hono';
import type { Bindings, User, Space } from '../types';

const spaces = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

/**
 * 공간 목록 — V44 §2/§5: 정렬 로직 전면 재설계
 *
 * 정렬 규칙(사용자 명시):
 *  1. 공용 미팅룸 (type='meeting_room' AND tenant_scope IS NULL/'') — name ASC
 *  2. 테넌트 전용 미팅룸 (type='meeting_room' AND tenant_scope = 사용자의 테넌트) — name ASC
 *  3. 라운지/Recharging Zone 등 그 외 (type != 'meeting_room') — display_order ASC, 항상 맨 뒤
 *
 * → 이름이 'Meeting Room A' 같은 정확 매칭에 의존하지 않으므로
 *   사용자가 룸 이름을 자유롭게 바꿔도 정렬이 무너지지 않음.
 *   와일리(WYLIE) 전용 5F Room 등은 공용 룸 다음 / 라운지 앞 위치 보장.
 *
 * tenant_scope 정규화: NULL 또는 '' (빈 문자열) 둘 다 "공용"으로 취급
 *   (PATCH 변칙으로 일부 DB row가 ''로 저장된 케이스 흡수)
 */
spaces.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    `SELECT * FROM spaces
     WHERE tenant_scope IS NULL
        OR tenant_scope = ''
        OR tenant_scope = ?
     ORDER BY display_order ASC`
  ).bind(user.tenant_id).all<Space>();

  const all = (result.results || []) as Space[];

  // tenant_scope 정규화: '' 도 공용으로 간주
  const isPublic = (s: Space) => !s.tenant_scope || s.tenant_scope === '';
  const isMeetingRoom = (s: Space) => s.type === 'meeting_room';

  // 1) 공용 미팅룸 — name ASC
  const publicRooms = all
    .filter(s => isMeetingRoom(s) && isPublic(s))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  // 2) 테넌트 전용 미팅룸 — name ASC
  const tenantRooms = all
    .filter(s => isMeetingRoom(s) && !isPublic(s))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  // 3) 그 외 (라운지/Recharging Zone 등) — display_order ASC
  const tail = all
    .filter(s => !isMeetingRoom(s))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const sorted = [...publicRooms, ...tenantRooms, ...tail];

  return c.json({ spaces: sorted });
});

/** 공간 생성 (관리자) — V5: tenant_scope 옵션 지원 / V44: 빈 문자열을 NULL로 정규화 */
spaces.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const body = await c.req.json<Partial<Space> & { tenant_scope?: string | null }>();
  if (!body.name) return c.json({ error: '공간명을 입력해 주세요.' }, 400);

  // V44: tenant_scope 정규화 — '' 또는 undefined → NULL
  const normalizedScope =
    body.tenant_scope === undefined || body.tenant_scope === null || body.tenant_scope === ''
      ? null
      : body.tenant_scope;

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
    normalizedScope
  ).run();

  return c.json({ ok: true, id: result.meta.last_row_id });
});

/** 공간 수정 (관리자) — V5: tenant_scope 변경 지원 / V44: 빈 문자열 NULL 정규화 */
spaces.patch('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const id = Number(c.req.param('id'));
  const body = await c.req.json<Partial<Space> & { tenant_scope?: string | null }>();

  const existing = await c.env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(id).first<Space>();
  if (!existing) return c.json({ error: '공간을 찾을 수 없습니다.' }, 404);

  // V44: tenant_scope 정규화 — '' 도 NULL 로 저장 (DB 변칙 데이터 차단)
  let nextScope: string | null;
  if (body.tenant_scope === undefined) {
    // 변경 안 함 — 기존 값 유지하되 빈 문자열이면 NULL 로 정화
    const cur = (existing as any).tenant_scope;
    nextScope = !cur || cur === '' ? null : cur;
  } else {
    nextScope = !body.tenant_scope || body.tenant_scope === '' ? null : body.tenant_scope;
  }

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
    nextScope,
    id
  ).run();

  return c.json({ ok: true });
});

/**
 * 공간 삭제 (관리자) — V44 §4: FOREIGN KEY constraint 회피
 *
 * 이전 버그: UPDATE reservations SET status='cancelled' 로 두면
 *   reservations.space_id REFERENCES spaces(id) (NO CASCADE) 가
 *   잔존 row를 막아서 spaces DELETE 실패 (D1_ERROR: FOREIGN KEY constraint failed)
 *
 * 해결: 관련 예약을 실제로 DELETE 해서 외래키 제약을 풀어줌
 *   reservation_attendees 는 reservation_id ON DELETE CASCADE 이므로
 *   자동 정리됨 (별도 DELETE 불필요).
 */
spaces.delete('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);

  const id = Number(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(id).first<Space>();
  if (!existing) return c.json({ error: '공간을 찾을 수 없습니다.' }, 404);

  // V44 §4: 안전한 순서 — 자식 row(예약) 먼저 삭제 후 spaces 삭제
  //   reservation_attendees 는 CASCADE 라 자동 정리됨
  await c.env.DB.prepare('DELETE FROM reservations WHERE space_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM spaces WHERE id = ?').bind(id).run();

  return c.json({ ok: true });
});

export default spaces;
