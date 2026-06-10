/**
 * 인사이트 API
 * - GET /overview : 개요 (요약 카드 + 히트맵 + 인기 공간)
 * - GET /history  : 내역 (예약 로그 / 필터)
 * - GET /stats    : 통계 (노쇼, 요일별, 예약방식, 수용인원별)
 *                   metric=time(시간 합산, 분) | count(건수)
 *                   range=7|30|90|180|365|custom (custom일 때 start/end 필요)
 */
import { Hono } from 'hono';
import type { Bindings, User } from '../types';

const insights = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

const DURATION_EXPR = `(
  (CAST(substr(end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(end_time, 4, 2) AS INTEGER))
  - (CAST(substr(start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(start_time, 4, 2) AS INTEGER))
)`;

function resolveRange(c: any): { start: string; end: string; days: number } {
  const range = (c.req.query('range') || '30').toString();
  const today = new Date().toISOString().slice(0, 10);
  if (range === 'custom') {
    const start = c.req.query('start') || today;
    const end = c.req.query('end') || today;
    const ms = new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime();
    return { start, end, days: Math.max(1, Math.round(ms / 86400000) + 1) };
  }
  const days = Math.max(1, parseInt(range, 10) || 30);
  const startD = new Date();
  startD.setUTCDate(startD.getUTCDate() - (days - 1));
  return { start: startD.toISOString().slice(0, 10), end: today, days };
}

/**
 * V10 §5: 공간 필터 — `space_ids=1,3,5` 형태의 CSV 쿼리 파라미터를 파싱.
 *   - 비어 있거나 모든 공간이 선택된 경우 null 반환 (필터 미적용 의미)
 *   - 반환된 sqlFragment 는 항상 "AND ..." 절. 빈 필터이면 빈 문자열.
 */
function resolveSpaceFilter(c: any): { ids: number[]; sqlFragment: string; binds: number[] } {
  const raw = c.req.query('space_ids');
  if (!raw) return { ids: [], sqlFragment: '', binds: [] };
  const ids = String(raw).split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return { ids: [], sqlFragment: '', binds: [] };
  const placeholders = ids.map(() => '?').join(',');
  return { ids, sqlFragment: ` AND r.space_id IN (${placeholders})`, binds: ids };
}

/** ───────────── 개요 (기존 화면 호환) — V10 §5 공간 필터 적용 ───────────── */
insights.get('/overview', async (c) => {
  const { start, end, days } = resolveRange(c);
  const sf = resolveSpaceFilter(c);

  const avg = await c.env.DB.prepare(`
    SELECT AVG(${DURATION_EXPR}) as avg_minutes
    FROM reservations r
    WHERE r.status = 'confirmed' AND r.date BETWEEN ? AND ?${sf.sqlFragment}
  `).bind(start, end, ...sf.binds).first<{ avg_minutes: number }>();

  // 인기 공간: 공간 필터가 있어도 전체 공간 비교 차트가 유의미하므로 필터 미적용
  // (단, 호출자가 명시한 공간만 표시되도록 IN 적용)
  const popularSql = sf.ids.length > 0
    ? `SELECT s.id, s.name, s.color, COUNT(r.id) as count
       FROM spaces s
       LEFT JOIN reservations r ON r.space_id = s.id AND r.status = 'confirmed' AND r.date BETWEEN ? AND ?
       WHERE s.id IN (${sf.ids.map(()=>'?').join(',')})
       GROUP BY s.id ORDER BY count DESC LIMIT 5`
    : `SELECT s.id, s.name, s.color, COUNT(r.id) as count
       FROM spaces s
       LEFT JOIN reservations r ON r.space_id = s.id AND r.status = 'confirmed' AND r.date BETWEEN ? AND ?
       GROUP BY s.id ORDER BY count DESC LIMIT 5`;
  const popular = await c.env.DB.prepare(popularSql).bind(start, end, ...sf.binds).all<{ id: number; name: string; color: string; count: number }>();

  const heatmapRaw = await c.env.DB.prepare(`
    SELECT
      CAST(strftime('%w', r.date) AS INTEGER) as weekday,
      CAST(substr(r.start_time, 1, 2) AS INTEGER) as hour_start,
      CAST(substr(r.end_time, 1, 2) AS INTEGER) as hour_end,
      CAST(substr(r.end_time, 4, 2) AS INTEGER) as end_min
    FROM reservations r
    WHERE r.status = 'confirmed' AND r.date BETWEEN ? AND ?${sf.sqlFragment}
  `).bind(start, end, ...sf.binds).all<{ weekday: number; hour_start: number; hour_end: number; end_min: number }>();

  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const row of heatmapRaw.results || []) {
    const realEnd = row.end_min > 0 ? row.hour_end + 1 : row.hour_end;
    for (let h = row.hour_start; h < realEnd && h < 24; h++) {
      heatmap[row.weekday][h]++;
    }
  }

  const total = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM reservations r
    WHERE r.status = 'confirmed' AND r.date BETWEEN ? AND ?${sf.sqlFragment}
  `).bind(start, end, ...sf.binds).first<{ count: number }>();

  return c.json({
    avg_minutes: Math.round(avg?.avg_minutes || 0),
    popular_spaces: popular.results || [],
    heatmap,
    total: total?.count || 0,
    period_days: days,
    start, end,
    space_ids: sf.ids,
  });
});

/** ───────────── 내역 (예약 로그) — V10 §5 공간 필터 적용 ───────────── */
insights.get('/history', async (c) => {
  const user = c.get('user');
  const { start, end } = resolveRange(c);
  const sf = resolveSpaceFilter(c);
  const onlyTenant = c.req.query('tenant') === 'mine';

  let q = `
    SELECT r.id, r.date, r.start_time, r.end_time, r.title, r.purpose, r.status, r.created_by_admin,
           u.name as user_name, u.avatar_color, u.tenant_id, t.name as tenant_name,
           s.name as space_name, s.color as space_color
    FROM reservations r
    JOIN users u ON u.id = r.user_id
    JOIN tenants t ON t.id = r.tenant_id
    JOIN spaces s ON s.id = r.space_id
    WHERE r.date BETWEEN ? AND ?
  `;
  const binds: any[] = [start, end];
  if (onlyTenant) {
    q += ' AND r.tenant_id = ?';
    binds.push(user.tenant_id);
  }
  if (sf.sqlFragment) {
    q += sf.sqlFragment;
    binds.push(...sf.binds);
  }
  q += ' ORDER BY r.date DESC, r.start_time DESC LIMIT 500';

  const rows = await c.env.DB.prepare(q).bind(...binds).all();
  return c.json({ history: rows.results || [], start, end, space_ids: sf.ids });
});

/** ───────────── 통계 (metric 스위치 적용) — V10 §5 공간 필터 적용 ───────────── */
insights.get('/stats', async (c) => {
  const { start, end, days } = resolveRange(c);
  const metric = (c.req.query('metric') || 'count').toString(); // 'count' | 'time'
  const value = metric === 'time' ? `SUM(${DURATION_EXPR})` : 'COUNT(*)';
  const sf = resolveSpaceFilter(c);

  // 1) 노쇼 집계 (status=cancelled를 노쇼로 가정) — confirmed vs cancelled
  const noshow = await c.env.DB.prepare(`
    SELECT r.status, ${value} as v
    FROM reservations r
    WHERE r.date BETWEEN ? AND ?${sf.sqlFragment}
    GROUP BY r.status
  `).bind(start, end, ...sf.binds).all<{ status: string; v: number }>();
  const noshowMap: Record<string, number> = { confirmed: 0, cancelled: 0 };
  for (const r of noshow.results || []) noshowMap[r.status] = r.v || 0;

  // 2) 요일별 예약 현황 (0=일, 6=토)
  const weekday = await c.env.DB.prepare(`
    SELECT CAST(strftime('%w', r.date) AS INTEGER) as wd, ${value} as v
    FROM reservations r
    WHERE r.status = 'confirmed' AND r.date BETWEEN ? AND ?${sf.sqlFragment}
    GROUP BY wd
  `).bind(start, end, ...sf.binds).all<{ wd: number; v: number }>();
  const weekdayArr = [0, 0, 0, 0, 0, 0, 0];
  for (const r of weekday.results || []) weekdayArr[r.wd] = r.v || 0;

  // 3) 예약 방식 현황 (admin vs member, recurring 여부)
  const method = await c.env.DB.prepare(`
    SELECT
      CASE WHEN r.recurring_rule_id IS NOT NULL THEN '반복'
           WHEN r.created_by_admin = 1 THEN '관리자'
           ELSE '일반'
      END as kind,
      ${value} as v
    FROM reservations r
    WHERE r.status = 'confirmed' AND r.date BETWEEN ? AND ?${sf.sqlFragment}
    GROUP BY kind
  `).bind(start, end, ...sf.binds).all<{ kind: string; v: number }>();
  const methodMap: Record<string, number> = { '일반': 0, '관리자': 0, '반복': 0 };
  for (const r of method.results || []) methodMap[r.kind] = r.v || 0;

  // 4) 수용 인원별 이용률 (공간 capacity 구간)
  const capRows = await c.env.DB.prepare(`
    SELECT s.capacity, ${value} as v
    FROM reservations r
    JOIN spaces s ON s.id = r.space_id
    WHERE r.status = 'confirmed' AND r.date BETWEEN ? AND ?${sf.sqlFragment}
    GROUP BY s.capacity
    ORDER BY s.capacity
  `).bind(start, end, ...sf.binds).all<{ capacity: number; v: number }>();

  // 5) 공간별 사용 비율 (필터 미적용 시 전체, 적용 시 선택된 공간만)
  const bySpaceSql = sf.ids.length > 0
    ? `SELECT s.id, s.name, s.color, ${value} as v
       FROM spaces s
       LEFT JOIN reservations r ON r.space_id = s.id AND r.status = 'confirmed' AND r.date BETWEEN ? AND ?
       WHERE s.id IN (${sf.ids.map(()=>'?').join(',')})
       GROUP BY s.id ORDER BY v DESC`
    : `SELECT s.id, s.name, s.color, ${value} as v
       FROM spaces s
       LEFT JOIN reservations r ON r.space_id = s.id AND r.status = 'confirmed' AND r.date BETWEEN ? AND ?
       GROUP BY s.id ORDER BY v DESC`;
  const bySpace = await c.env.DB.prepare(bySpaceSql).bind(start, end, ...sf.binds).all<{ id: number; name: string; color: string; v: number }>();

  return c.json({
    metric,
    start, end, days,
    noshow: noshowMap,
    weekday: weekdayArr,
    method: methodMap,
    capacity: capRows.results || [],
    by_space: bySpace.results || [],
    space_ids: sf.ids,
  });
});

export default insights;
