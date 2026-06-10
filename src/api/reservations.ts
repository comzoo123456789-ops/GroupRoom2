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

/** 예약 목록 - 날짜 범위 조회 (모든 사용자가 통합 타임라인 공유)
 *  V7 고도화: 공간 타임라인 일정 조회에 참석자 수락(ACCEPTED) 일정도 함께 포함되도록
 *  reservation_attendees JOIN으로 표시할 수 있게 attendees_summary 컬럼 동승. */
reservations.get('/', async (c) => {
  const user = c.get('user');
  const date = c.req.query('date');
  const start = c.req.query('start');
  const end = c.req.query('end');
  const mine = c.req.query('mine') === '1'; // V4: 내 일정 필터

  let query = `
    SELECT r.*, u.name as user_name, u.avatar_color as user_avatar_color, u.tenant_id as user_tenant_id,
           s.name as space_name, s.color as space_color, t.name as tenant_name,
           (SELECT COUNT(*) FROM reservation_attendees ra WHERE ra.reservation_id = r.id) AS attendees_count,
           (SELECT COUNT(*) FROM reservation_attendees ra WHERE ra.reservation_id = r.id AND ra.status = 'ACCEPTED') AS accepted_count
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
    // V7 고도화: 본인이 개설자(user_id) OR 참석자로 ACCEPTED 한 예약
    //   reservation_attendees 정규화 테이블 우선, 레거시 r.attendees JSON 컬럼도 함께 OR 처리
    query += ` AND (
      r.user_id = ?
      OR EXISTS (
        SELECT 1 FROM reservation_attendees ra
        WHERE ra.reservation_id = r.id AND ra.member_id = ? AND ra.status = 'ACCEPTED'
      )
      OR r.attendees LIKE ? OR r.attendees LIKE ?
    )`;
    binds.push(user.id, user.id, `%"${user.email}"%`, `%"${user.id}"%`);
  }

  query += ' ORDER BY r.date ASC, r.start_time ASC';

  const result = await c.env.DB.prepare(query).bind(...binds).all<Reservation>();
  return c.json({ reservations: result.results || [] });
});

/** 다가오는 내 예약 (홈 대시보드용)
 *  V7 고도화 §3: 주최자(user_id) OR 참석자 수락(ACCEPTED) 상태인 일정을 함께 노출.
 *  각 행에 my_role = 'OWNER' | 'ATTENDEE' 플래그를 동승. */
reservations.get('/upcoming', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(`
    SELECT r.*, s.name as space_name, s.color as space_color,
           u.avatar_color as user_avatar_color, u.name as user_name,
           CASE WHEN r.user_id = ? THEN 'OWNER' ELSE 'ATTENDEE' END AS my_role,
           (SELECT COUNT(*) FROM reservation_attendees ra WHERE ra.reservation_id = r.id) AS attendees_count
    FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    JOIN users u ON u.id = r.user_id
    WHERE r.status = 'confirmed'
      AND (r.date > date('now') OR (r.date = date('now') AND r.end_time > strftime('%H:%M', 'now', 'localtime')))
      AND (
        r.user_id = ?
        OR EXISTS (
          SELECT 1 FROM reservation_attendees ra
          WHERE ra.reservation_id = r.id AND ra.member_id = ? AND ra.status = 'ACCEPTED'
        )
      )
    ORDER BY r.date ASC, r.start_time ASC
    LIMIT 50
  `).bind(user.id, user.id, user.id).all<Reservation>();
  return c.json({ reservations: result.results || [] });
});

/** V7 고도화 §3: 받은 초대 목록 (PENDING 상태) — 홈 알림 영역에서 사용 */
reservations.get('/invitations', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(`
    SELECT r.id, r.title, r.date, r.start_time, r.end_time,
           s.name AS space_name, s.color AS space_color,
           ow.id AS owner_id, ow.name AS owner_name, ow.avatar_color AS owner_avatar_color,
           ra.id AS invitation_id, ra.status AS invitation_status, ra.invited_at
    FROM reservation_attendees ra
    JOIN reservations r ON r.id = ra.reservation_id
    JOIN spaces s       ON s.id = r.space_id
    JOIN users ow       ON ow.id = r.user_id
    WHERE ra.member_id = ?
      AND ra.status = 'PENDING'
      AND r.status = 'confirmed'
      AND (r.date > date('now') OR (r.date = date('now') AND r.end_time > strftime('%H:%M', 'now', 'localtime')))
    ORDER BY r.date ASC, r.start_time ASC
  `).bind(user.id).all();
  return c.json({ invitations: result.results || [] });
});

/** V7 고도화 §3: 단건 예약 상세 — 예약자(owner) + 참석자(attendees) 분리 동승 */
reservations.get('/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const r = await c.env.DB.prepare(`
    SELECT r.*, s.name AS space_name, s.color AS space_color,
           u.name AS user_name, u.email AS user_email,
           u.avatar_color AS user_avatar_color, u.department AS user_department, u.position AS user_position
    FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    JOIN users u  ON u.id = r.user_id
    WHERE r.id = ?
  `).bind(id).first<any>();
  if (!r) return c.json({ error: '예약을 찾을 수 없습니다.' }, 404);

  // 다대다 참석자 목록 (PENDING / ACCEPTED / DECLINED 모두)
  const attRes = await c.env.DB.prepare(`
    SELECT ra.id AS invitation_id, ra.status, ra.invited_at, ra.responded_at,
           m.id, m.name, m.email, m.avatar_color, m.department, m.position
    FROM reservation_attendees ra
    JOIN users m ON m.id = ra.member_id
    WHERE ra.reservation_id = ?
    ORDER BY ra.id ASC
  `).bind(id).all<any>();

  // 현재 로그인한 사용자의 참여 상태(있다면)
  const myInvitation = (attRes.results || []).find((a: any) => a.id === user.id) || null;

  return c.json({
    reservation: r,
    attendees: attRes.results || [],
    my_role: r.user_id === user.id ? 'OWNER' : (myInvitation ? 'ATTENDEE' : 'NONE'),
    my_invitation_status: myInvitation?.status || null,
  });
});

/** V7 고도화 §3: 초대 응답 — ACCEPT / DECLINE */
reservations.post('/:id/respond', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ action: 'ACCEPT' | 'DECLINE' }>();
  const action = body.action;
  if (action !== 'ACCEPT' && action !== 'DECLINE') {
    return c.json({ error: '잘못된 action 입니다.' }, 400);
  }
  const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';

  // 본인 초대 레코드 검증
  const inv = await c.env.DB.prepare(
    'SELECT * FROM reservation_attendees WHERE reservation_id = ? AND member_id = ?'
  ).bind(id, user.id).first<any>();
  if (!inv) {
    return c.json({ error: '초대 레코드를 찾을 수 없습니다.' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE reservation_attendees SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(newStatus, inv.id).run();

  return c.json({ ok: true, invitation_id: inv.id, status: newStatus });
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
    attendees?: string[];          // 레거시 JSON 배열 (이메일/문자열) — 하위 호환 유지
    attendee_ids?: number[];       // V7 고도화: 다대다 참석자 user.id 배열
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      end_type: 'date' | 'count';
      end_date?: string;
      end_count?: number;
    };
    force?: boolean; // 충돌 발생 시 충돌 일자 제외하고 진행
  }>();

  const { space_id, title, date, start_time, end_time, attendees, attendee_ids, recurring, force } = body;

  if (!space_id || !date || !start_time || !end_time) {
    return c.json({ error: '필수 정보가 누락되었습니다.' }, 400);
  }
  if (start_time >= end_time) {
    return c.json({ error: '시작 시간은 종료 시간보다 빨라야 합니다.' }, 400);
  }

  // V5 REQ-AUTH-01: tenant_scope 가드 — 다른 테넌트 전용 공간은 예약 차단
  const targetSpace = await c.env.DB.prepare('SELECT * FROM spaces WHERE id = ?').bind(space_id).first<Space & { tenant_scope: string | null }>();
  if (!targetSpace) {
    return c.json({ error: '공간을 찾을 수 없습니다.' }, 404);
  }
  if (targetSpace.tenant_scope && targetSpace.tenant_scope !== user.tenant_id) {
    return c.json({ error: '해당 공간을 이용할 권한이 없습니다.' }, 403);
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

  // V7 고도화: 유효 attendee_ids 산출 — 본인은 자동 제외(예약자는 자동 OWNER)
  const validAttendeeIds: number[] = [];
  if (Array.isArray(attendee_ids) && attendee_ids.length > 0) {
    const filtered = attendee_ids
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n > 0 && n !== user.id);
    if (filtered.length > 0) {
      // 존재하는 user_id만 통과
      const placeholders = filtered.map(() => '?').join(',');
      const okRows = await c.env.DB.prepare(
        `SELECT id FROM users WHERE id IN (${placeholders})`
      ).bind(...filtered).all<{ id: number }>();
      const okIds = new Set((okRows.results || []).map(r => r.id));
      for (const n of filtered) if (okIds.has(n)) validAttendeeIds.push(n);
    }
  }

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
    const newId = res.meta.last_row_id as number;
    createdIds.push(newId);

    // V7 고도화: reservation_attendees 다대다 bulk insert (PENDING 상태로 초대)
    if (validAttendeeIds.length > 0) {
      // D1 batch — 단일 트랜잭션처럼 처리
      const stmts = validAttendeeIds.map(mid =>
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO reservation_attendees (reservation_id, member_id, status) VALUES (?, ?, 'PENDING')"
        ).bind(newId, mid)
      );
      await c.env.DB.batch(stmts);
    }
  }

  return c.json({
    ok: true,
    created: createdIds.length,
    ids: createdIds,
    skipped: Array.from(skipSet),
    invited: validAttendeeIds.length,
  });
});

/**
 * 예약 수정
 * V7 통합본 §5: update_scope=future 지원
 *  - update_scope=future: 해당 예약과 동일 recurring_rule_id를 가진 이후(>= 현재 date) 모든 예약을 일괄 갱신
 *  - 시간/공간 변경은 미래 예약 전체에 동일 오프셋이 아닌 동일 값으로 일괄 적용(요구사항 단순화).
 */
reservations.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const updateScope = c.req.query('update_scope') || 'single'; // 'single' | 'future'
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

  // V5 REQ-AUTH-01: 변경되는 공간의 tenant_scope 검증
  if (newSpaceId !== existing.space_id) {
    const targetSpace = await c.env.DB.prepare('SELECT tenant_scope FROM spaces WHERE id = ?').bind(newSpaceId).first<{ tenant_scope: string | null }>();
    if (targetSpace?.tenant_scope && targetSpace.tenant_scope !== user.tenant_id) {
      return c.json({ error: '해당 공간을 이용할 권한이 없습니다.' }, 403);
    }
  }

  // 단일 수정 — 기존 로직 그대로
  if (updateScope === 'single' || !existing.recurring_rule_id) {
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

    return c.json({ ok: true, updated: 1 });
  }

  // V7 통합본 §5: update_scope=future — 동일 recurring_rule_id, date >= existing.date 인 모든 예약 일괄 갱신
  // 시간/공간/타이틀은 동일 값을 적용. date는 각 예약의 본래 날짜를 유지(반복 시리즈 유지).
  const newTitle = body.title ?? existing.title;
  const futureRows = await c.env.DB.prepare(
    'SELECT id, date FROM reservations WHERE recurring_rule_id = ? AND date >= ? AND status != ?'
  ).bind(existing.recurring_rule_id, existing.date, 'cancelled').all<{ id: number; date: string }>();

  const futureList = (futureRows.results || []) as Array<{ id: number; date: string }>;

  // 충돌 사전 검증 — 새 시간/공간으로 모든 미래 날짜에 대해 미리 체크
  for (const row of futureList) {
    const conflicts = await findConflicts(c.env.DB, row.date, newStart, newEnd, newSpaceId, row.id);
    if (conflicts.length > 0) {
      return c.json({ error: `${row.date} 일정과 충돌합니다. 일괄 수정이 취소되었습니다.`, type: 'CONFLICT' }, 409);
    }
  }

  // 모두 통과 — 일괄 UPDATE
  for (const row of futureList) {
    await c.env.DB.prepare(`
      UPDATE reservations SET title = ?, start_time = ?, end_time = ?, space_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newTitle, newStart, newEnd, newSpaceId, row.id).run();
  }

  return c.json({ ok: true, updated: futureList.length, scope: 'future' });
});

/**
 * 예약 삭제 (취소)
 * V7 통합본 §5: scope 분기 지원
 *  - scope=single (기본): 단건만 취소
 *  - scope=future: 동일 recurring_rule_id, date >= 현재 의 모든 예약 일괄 취소
 *  - scope=all: 해당 recurring_rule_id 의 모든 예약(과거 포함) 일괄 취소
 */
reservations.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const scope = c.req.query('scope') || 'single'; // 'single' | 'future' | 'all'

  const existing = await c.env.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first<Reservation>();
  if (!existing) return c.json({ error: '예약을 찾을 수 없습니다.' }, 404);
  if (user.role !== 'admin' && existing.user_id !== user.id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  // 반복 규칙이 없거나 scope=single 이면 단건만
  if (scope === 'single' || !existing.recurring_rule_id) {
    await c.env.DB.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").bind(id).run();
    return c.json({ ok: true, cancelled: 1, scope: 'single' });
  }

  if (scope === 'future') {
    const result = await c.env.DB.prepare(
      "UPDATE reservations SET status = 'cancelled' WHERE recurring_rule_id = ? AND date >= ? AND status != 'cancelled'"
    ).bind(existing.recurring_rule_id, existing.date).run();
    return c.json({ ok: true, cancelled: result.meta?.changes ?? 0, scope: 'future' });
  }

  if (scope === 'all') {
    const result = await c.env.DB.prepare(
      "UPDATE reservations SET status = 'cancelled' WHERE recurring_rule_id = ? AND status != 'cancelled'"
    ).bind(existing.recurring_rule_id).run();
    return c.json({ ok: true, cancelled: result.meta?.changes ?? 0, scope: 'all' });
  }

  return c.json({ error: '알 수 없는 scope 값입니다.' }, 400);
});

export default reservations;
