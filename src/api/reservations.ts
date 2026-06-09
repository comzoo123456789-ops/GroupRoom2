import { Hono } from 'hono';
import type { Bindings, User, Reservation, Space } from '../types';

const reservations = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

/** 시간이 겹치는지 확인 (HH:MM 형식) */
function timeOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** 날짜 더하기 (YYYY-MM-DD 형식) */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** 특정 날짜/시간/공간에 충돌 예약이 있는지 확인 */
async function findConflicts(
  db: D1Database,
  date: string,
  startTime: string,
  endTime: string,
  spaceId: number,
  excludeId?: number,
) {
  const res = await db.prepare(`
    SELECT r.*, s.name as space_name FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    WHERE r.date = ? AND r.space_id = ? AND r.status = 'confirmed'
      AND r.start_time < ? AND r.end_time > ?
      ${excludeId ? 'AND r.id != ?' : ''}
  `).bind(...(excludeId ? [date, spaceId, endTime, startTime, excludeId] : [date, spaceId, endTime, startTime])).all<Reservation>();
  return res.results || [];
}

/** 회사별 3개 미팅룸 제한 검증 (어드민이 아닐 때만) */
async function checkRoomLimit(
  db: D1Database,
  tenantId: string,
  date: string,
  startTime: string,
  endTime: string,
  newSpaceId: number,
): Promise<{ ok: boolean; count: number }> {
  // 같은 회사, 같은 날, 시간이 겹치는, count_in_limit=1 미팅룸 예약 카운트
  const rows = await db.prepare(`
    SELECT DISTINCT r.space_id
    FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    WHERE r.tenant_id = ? AND r.date = ? AND r.status = 'confirmed'
      AND s.count_in_limit = 1
      AND r.start_time < ? AND r.end_time > ?
  `).bind(tenantId, date, endTime, startTime).all<{ space_id: number }>();

  const spaceIds = new Set((rows.results || []).map(r => r.space_id));
  spaceIds.add(newSpaceId);

  // 새로 예약하려는 공간이 count_in_limit=1인 미팅룸이 아니면 제한 미적용
  const space = await db.prepare('SELECT count_in_limit FROM spaces WHERE id = ?').bind(newSpaceId).first<{ count_in_limit: number }>();
  if (!space || space.count_in_limit !== 1) {
    return { ok: true, count: spaceIds.size };
  }

  return { ok: spaceIds.size <= 3, count: spaceIds.size };
}

/** 예약 목록 - 날짜 범위 조회 (모든 사용자가 통합 타임라인 공유) */
reservations.get('/', async (c) => {
  const user = c.get('user');
  const date = c.req.query('date');
  const start = c.req.query('start');
  const end = c.req.query('end');
  const mine = c.req.query('mine') === '1'; // V4: 내 일정 필터

  let query = `
    SELECT r.*, u.name as user_name, u.avatar_color as user_avatar_color, u.tenant_id as user_tenant_id,
           s.name as space_name, s.color as space_color, t.name as tenant_name
    FROM reservations r
    JOIN users u ON u.id = r.user_id
    JOIN spaces s ON s.id = r.space_id
    JOIN tenants t ON t.id = r.tenant_id
    WHERE r.status = 'confirmed'
  `;
  const binds: any[] = [];

  if (date) {
    query += ' AND r.date = ?';
    binds.push(date);
  } else if (start && end) {
    query += ' AND r.date >= ? AND r.date <= ?';
    binds.push(start, end);
  }

  if (mine) {
    // 본인이 개설자이거나 참석자로 등록된 예약 (attendees는 JSON 배열 / 이메일 포함 가능)
    query += ' AND (r.user_id = ? OR r.attendees LIKE ? OR r.attendees LIKE ?)';
    binds.push(user.id, `%"${user.email}"%`, `%"${user.id}"%`);
  }

  query += ' ORDER BY r.date ASC, r.start_time ASC';

  const result = await c.env.DB.prepare(query).bind(...binds).all<Reservation>();
  return c.json({ reservations: result.results || [] });
});

/** 다가오는 내 예약 (홈 대시보드용) */
reservations.get('/upcoming', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(`
    SELECT r.*, s.name as space_name, s.color as space_color, u.avatar_color as user_avatar_color, u.name as user_name
    FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    JOIN users u ON u.id = r.user_id
    WHERE r.user_id = ? AND r.status = 'confirmed'
      AND (r.date > date('now') OR (r.date = date('now') AND r.end_time > strftime('%H:%M', 'now', 'localtime')))
    ORDER BY r.date ASC, r.start_time ASC
    LIMIT 50
  `).bind(user.id).all<Reservation>();
  return c.json({ reservations: result.results || [] });
});

/** 예약 생성 */
reservations.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    space_id: number;
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    attendees?: string[];
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      end_type: 'date' | 'count';
      end_date?: string;
      end_count?: number;
    };
    force?: boolean; // 충돌 발생 시 충돌 일자 제외하고 진행
  }>();

  const { space_id, title, date, start_time, end_time, attendees, recurring, force } = body;

  if (!space_id || !date || !start_time || !end_time) {
    return c.json({ error: '필수 정보가 누락되었습니다.' }, 400);
  }
  if (start_time >= end_time) {
    return c.json({ error: '시작 시간은 종료 시간보다 빨라야 합니다.' }, 400);
  }

  const isAdmin = user.role === 'admin';

  // 반복 예약인 경우 날짜 목록 생성
  const dates: string[] = [];
  if (recurring) {
    let current = date;
    const limit = recurring.end_type === 'count' ? (recurring.end_count || 1) : 365;
    const endDate = recurring.end_type === 'date' ? recurring.end_date : null;

    for (let i = 0; i < limit; i++) {
      if (endDate && current > endDate) break;
      dates.push(current);
      if (recurring.frequency === 'daily') current = addDays(current, 1);
      else if (recurring.frequency === 'weekly') current = addDays(current, 7);
      else if (recurring.frequency === 'monthly') current = addMonths(current, 1);
    }
  } else {
    dates.push(date);
  }

  // 충돌 검증
  const conflictDates: string[] = [];
  const limitFailDates: string[] = [];

  for (const d of dates) {
    const conflicts = await findConflicts(c.env.DB, d, start_time, end_time, space_id);
    if (conflicts.length > 0) {
      conflictDates.push(d);
      continue;
    }
    // 어드민이 아닌 경우 3개 제한 검증
    if (!isAdmin) {
      const limit = await checkRoomLimit(c.env.DB, user.tenant_id, d, start_time, end_time, space_id);
      if (!limit.ok) {
        limitFailDates.push(d);
      }
    }
  }

  // 단일 예약에서 제한 초과 시 즉시 에러
  if (!recurring && limitFailDates.length > 0) {
    return c.json({
      error: '해당 시간대 회사 최대 예약 가능 개수(3개)를 초과했습니다.',
      type: 'LIMIT_EXCEEDED',
    }, 409);
  }
  if (!recurring && conflictDates.length > 0) {
    return c.json({
      error: '이미 예약된 시간입니다.',
      type: 'CONFLICT',
      conflicts: conflictDates,
    }, 409);
  }

  // 반복 예약에서 충돌이 있고 force=false 면 충돌 일자 반환
  if (recurring && (conflictDates.length > 0 || limitFailDates.length > 0) && !force) {
    return c.json({
      error: '일부 일자에 충돌이 발생했습니다.',
      type: 'RECURRING_CONFLICT',
      conflicts: conflictDates,
      limit_exceeded: limitFailDates,
    }, 409);
  }

  // 반복 예약 규칙 저장
  let recurringRuleId: number | null = null;
  if (recurring) {
    const ruleResult = await c.env.DB.prepare(
      'INSERT INTO recurring_rules (frequency, end_type, end_date, end_count) VALUES (?, ?, ?, ?)'
    ).bind(recurring.frequency, recurring.end_type, recurring.end_date || null, recurring.end_count || null).run();
    recurringRuleId = ruleResult.meta.last_row_id as number;
  }

  // 실제 예약 생성 (force인 경우 충돌/제한 실패 일자 제외)
  const skipSet = new Set([...conflictDates, ...limitFailDates]);
  const insertDates = dates.filter(d => !skipSet.has(d));

  const createdIds: number[] = [];
  for (const d of insertDates) {
    const res = await c.env.DB.prepare(`
      INSERT INTO reservations (tenant_id, user_id, space_id, title, date, start_time, end_time, attendees, recurring_rule_id, created_by_admin, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `).bind(
      user.tenant_id, user.id, space_id, title || '새로운 일정',
      d, start_time, end_time,
      attendees ? JSON.stringify(attendees) : null,
      recurringRuleId,
      isAdmin ? 1 : 0
    ).run();
    createdIds.push(res.meta.last_row_id as number);
  }

  return c.json({
    ok: true,
    created: createdIds.length,
    ids: createdIds,
    skipped: Array.from(skipSet),
  });
});

/** 예약 수정 */
reservations.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ title?: string; start_time?: string; end_time?: string; date?: string; space_id?: number }>();

  const existing = await c.env.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Reservation>();
  if (!existing) return c.json({ error: '예약을 찾을 수 없습니다.' }, 404);
  if (user.role !== 'admin' && existing.user_id !== user.id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  const newDate = body.date || existing.date;
  const newStart = body.start_time || existing.start_time;
  const newEnd = body.end_time || existing.end_time;
  const newSpaceId = body.space_id || existing.space_id;

  // 시간/공간 변경 시 충돌 재검증
  if (newDate !== existing.date || newStart !== existing.start_time || newEnd !== existing.end_time || newSpaceId !== existing.space_id) {
    const conflicts = await findConflicts(c.env.DB, newDate, newStart, newEnd, newSpaceId, id);
    if (conflicts.length > 0) {
      return c.json({ error: '이미 예약된 시간입니다.', type: 'CONFLICT' }, 409);
    }
    if (user.role !== 'admin') {
      const limit = await checkRoomLimit(c.env.DB, existing.tenant_id, newDate, newStart, newEnd, newSpaceId);
      if (!limit.ok) {
        return c.json({ error: '해당 시간대 회사 최대 예약 가능 개수(3개)를 초과했습니다.', type: 'LIMIT_EXCEEDED' }, 409);
      }
    }
  }

  await c.env.DB.prepare(`
    UPDATE reservations SET title = ?, date = ?, start_time = ?, end_time = ?, space_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(body.title ?? existing.title, newDate, newStart, newEnd, newSpaceId, id).run();

  return c.json({ ok: true });
});

/** 예약 삭제 (취소) */
reservations.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));

  const existing = await c.env.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Reservation>();
  if (!existing) return c.json({ error: '예약을 찾을 수 없습니다.' }, 404);
  if (user.role !== 'admin' && existing.user_id !== user.id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  await c.env.DB.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

export default reservations;
