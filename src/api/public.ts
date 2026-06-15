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
 * GET /api/public/available-spaces?date=YYYY-MM-DD
 *
 * V42 §2: 임의 날짜 조회 지원
 *   - date 미지정 → 오늘(KST) 기준 "지금 가용한지" 판정
 *   - date 지정 → 그 날짜의 모든 예약 목록을 반환 (회의실별 bookings_today)
 *     · 오늘 < date (미래) : "현재 시각" 개념이 무의미하므로 available=true 로 표시하되,
 *                            bookings_today 의 (start, end) 슬롯들을 모두 응답해서 클라이언트가
 *                            "당일 예약 슬롯들"을 바 형태로 그릴 수 있게 함
 *     · 오늘 == date       : 기존 로직 그대로 (지금 사용 중 / 가용 판정)
 *     · date < 오늘 (과거) : 단순 조회 — 모두 available=false 처럼 표시할 수도 있으나
 *                            기록 조회용으로 bookings_today 만 반환, available 은 항상 true
 *
 * 응답:
 *   {
 *     now: { date: '2026-06-11', time: '14:30' },          // 서버 현재(KST)
 *     query_date: '2026-06-30',                            // 조회한 날짜
 *     is_today: false,                                     // 조회 날짜가 오늘인지
 *     rooms: [
 *       {
 *         id, name, capacity,
 *         available,           // is_today=true일 때만 의미 — 그 외엔 true 고정
 *         current_end_at,      // is_today=true일 때만 유효
 *         next_busy_at,        // is_today=true일 때만 유효
 *         bookings_today: [{ start, end }, ...]
 *       }
 *     ]
 *   }
 */
publicApi.get('/available-spaces', async (c) => {
  const now = nowKstHHMM();
  const queryDate = c.req.query('date') || now.date;
  // 날짜 형식 검증 — YYYY-MM-DD + 실제 유효한 달력 날짜인지 확인
  if (!/^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
    return c.json({ error: '잘못된 날짜 형식입니다. YYYY-MM-DD 로 입력하세요.' }, 400);
  }
  {
    const [y, m, d] = queryDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== m - 1 ||
      dt.getUTCDate() !== d
    ) {
      return c.json({ error: '존재하지 않는 날짜입니다.' }, 400);
    }
  }
  const isToday = queryDate === now.date;
  const hhmm = now.hhmm;

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
    return c.json({ now: { date: now.date, time: hhmm }, query_date: queryDate, is_today: isToday, rooms: [] });
  }

  // 2) 해당 날짜의 유효 예약(confirmed) 일괄 조회
  //   V41 §1: status = 'confirmed' (DB 실제 값과 정확히 일치)
  const spaceIds = spaces.map((s) => s.id);
  const reservRes = await c.env.DB.prepare(
    `SELECT space_id, start_time, end_time, title
       FROM reservations
       WHERE date = ?
         AND status = 'confirmed'
         AND space_id IN (${spaceIds.map(() => '?').join(',')})
       ORDER BY start_time ASC`
  ).bind(queryDate, ...spaceIds).all<{ space_id: number; start_time: string; end_time: string; title: string }>();

  const byRoom = new Map<number, Array<{ start: string; end: string; title: string }>>();
  for (const row of reservRes.results || []) {
    if (!byRoom.has(row.space_id)) byRoom.set(row.space_id, []);
    byRoom.get(row.space_id)!.push({ start: row.start_time, end: row.end_time, title: row.title });
  }

  // 3) 가용성 판정
  //   V40 §1: 경계 조건 명확화 — start <= hhmm < end (시작 포함, 종료 미포함)
  //   V42 §2: 미래/과거 날짜는 가용성 판정 불가 → available=true 고정, bookings 만 반환
  const rooms = spaces.map((s) => {
    const list = byRoom.get(s.id) || [];
    if (!isToday) {
      // 미래/과거 날짜 — 그 날의 예약 슬롯만 반환
      return {
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        available: true,          // 클라이언트는 bookings_today 로 막대그래프 표시
        current_end_at: null,
        next_busy_at: list[0]?.start || null,   // 그 날 첫 예약 시작 시각
        bookings_today: list,
      };
    }
    // 오늘 — 기존 실시간 가용성 판정
    const current = list.find((r) => r.start <= hhmm && hhmm < r.end);
    if (current) {
      return {
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        available: false,
        current_end_at: current.end,
        next_busy_at: null,
        bookings_today: list,
      };
    }
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

  // V40: 캐시 방지 헤더 — 미래 날짜도 누군가 예약하면 즉시 반영돼야 함
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');

  return c.json({
    now: { date: now.date, time: hhmm },
    query_date: queryDate,
    is_today: isToday,
    rooms,
  });
});

export default publicApi;
