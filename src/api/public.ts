import { Hono } from 'hono';
import type { Bindings } from '../types';

/**
 * V15 §1 — 공개(비로그인) API
 *
 * 로그인 페이지의 "실시간 예약 가능 공용 회의실" 현황판용.
 * 인증 미들웨어를 거치지 않고 접근 가능해야 하므로 별도 라우터로 분리.
 *
 * 정책:
 *  - 대상 공간: 공용(tenant_scope IS NULL) 중 'Meeting Room A~E' 5개만
 *  - 제외 공간: 'Conference Room'(WYLIE 전용), '파라다이스룸'(LUSH 전용), 그 외 Lounge/Recharging Zone
 *  - 가용성 판정: 현재 시간(KST 기준 HH:MM)이 어느 active 예약 [start_time, end_time) 구간에도 들어가지 않으면 "가용"
 */
const publicApi = new Hono<{ Bindings: Bindings }>();

/** 현재 시각(KST)을 HH:MM 형태로 — Cloudflare Workers는 UTC만 신뢰 가능 → +9h 보정 */
function nowKstHHMM(): { date: string; hhmm: string } {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC → KST
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, hhmm: `${hh}:${min}` };
}

/**
 * GET /api/public/available-spaces
 *
 * 응답:
 *   {
 *     now: { date: '2026-06-11', time: '14:30' },
 *     rooms: [
 *       { id, name, capacity, available, next_busy_at, current_end_at }
 *     ]
 *   }
 *
 *   available=true  → 즉시 사용 가능 (next_busy_at에 다음 예약 시작 시각 동봉, 없으면 null)
 *   available=false → 현재 예약 중   (current_end_at에 종료 예정 시각)
 */
publicApi.get('/available-spaces', async (c) => {
  const { date, hhmm } = nowKstHHMM();

  // 1) 공용 공간(tenant_scope IS NULL) 중 Meeting Room A~E만
  const PUBLIC_ROOMS = ['Meeting Room A', 'Meeting Room B', 'Meeting Room C', 'Meeting Room D', 'Meeting Room E'];
  const placeholders = PUBLIC_ROOMS.map(() => '?').join(',');
  const spacesRes = await c.env.DB.prepare(
    `SELECT id, name, capacity FROM spaces
       WHERE name IN (${placeholders})
         AND tenant_scope IS NULL
       ORDER BY name ASC`
  ).bind(...PUBLIC_ROOMS).all<{ id: number; name: string; capacity: number }>();

  const spaces = spacesRes.results || [];
  if (!spaces.length) {
    return c.json({ now: { date, time: hhmm }, rooms: [] });
  }

  // 2) 오늘자 active 예약 일괄 조회
  const spaceIds = spaces.map((s) => s.id);
  const reservRes = await c.env.DB.prepare(
    `SELECT space_id, start_time, end_time
       FROM reservations
       WHERE date = ?
         AND status = 'active'
         AND space_id IN (${spaceIds.map(() => '?').join(',')})
       ORDER BY start_time ASC`
  ).bind(date, ...spaceIds).all<{ space_id: number; start_time: string; end_time: string }>();

  const byRoom = new Map<number, Array<{ start: string; end: string }>>();
  for (const row of reservRes.results || []) {
    if (!byRoom.has(row.space_id)) byRoom.set(row.space_id, []);
    byRoom.get(row.space_id)!.push({ start: row.start_time, end: row.end_time });
  }

  // 3) 가용성 판정
  //   V40 §1: 경계 조건 명확화
  //     - 현재 사용 중: start <= hhmm < end   (시작 시각 포함, 종료 시각 미포함)
  //     - "지금이 종료 시각과 정확히 같은 순간"(예: 10:00, end=10:00) → 가용으로 본다
  //     - 다음 예약: start > hhmm (가까운 시작 시각 하나만)
  //   추가로 디버깅을 위해 raw 예약 목록도 응답에 포함시켜 클라이언트에서 검증 가능
  const rooms = spaces.map((s) => {
    const list = byRoom.get(s.id) || [];
    // start <= hhmm < end 인 예약이 있으면 "사용 중"
    const current = list.find((r) => r.start <= hhmm && hhmm < r.end);
    if (current) {
      return {
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        available: false,
        current_end_at: current.end,
        next_busy_at: null,
        // V40 디버그: 이 회의실의 오늘 예약 전체 목록 (시작순)
        bookings_today: list,
      };
    }
    // 다음으로 가까운 예약 시작 시각
    const next = list.find((r) => r.start > hhmm);
    return {
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      available: true,
      current_end_at: null,
      next_busy_at: next?.start || null,
      bookings_today: list,
    };
  });

  // V40: 캐시 방지 헤더 강화 — 어떤 중간 캐시도 끼지 못하게
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');

  return c.json({ now: { date, time: hhmm }, rooms });
});

export default publicApi;
