import { Hono } from 'hono';
import type { Bindings, User } from '../types';

const insights = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

insights.get('/overview', async (c) => {
  const days = Number(c.req.query('days') || 30);

  // 평균 회의 진행 시간 (분)
  const avg = await c.env.DB.prepare(`
    SELECT AVG(
      (CAST(substr(end_time, 1, 2) AS INTEGER) * 60 + CAST(substr(end_time, 4, 2) AS INTEGER))
      - (CAST(substr(start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(start_time, 4, 2) AS INTEGER))
    ) as avg_minutes
    FROM reservations
    WHERE status = 'confirmed' AND date >= date('now', '-' || ? || ' days')
  `).bind(days).first<{ avg_minutes: number }>();

  // 인기 회의실 TOP 3
  const popular = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.color, COUNT(r.id) as count
    FROM spaces s
    LEFT JOIN reservations r ON r.space_id = s.id AND r.status = 'confirmed' AND r.date >= date('now', '-' || ? || ' days')
    GROUP BY s.id
    ORDER BY count DESC
    LIMIT 5
  `).bind(days).all<{ id: number; name: string; color: string; count: number }>();

  // 요일/시간대별 히트맵 (0=일요일 ~ 6=토요일, 0~23시)
  const heatmapRaw = await c.env.DB.prepare(`
    SELECT
      CAST(strftime('%w', date) AS INTEGER) as weekday,
      CAST(substr(start_time, 1, 2) AS INTEGER) as hour_start,
      CAST(substr(end_time, 1, 2) AS INTEGER) as hour_end,
      CAST(substr(end_time, 4, 2) AS INTEGER) as end_min
    FROM reservations
    WHERE status = 'confirmed' AND date >= date('now', '-' || ? || ' days')
  `).bind(days).all<{ weekday: number; hour_start: number; hour_end: number; end_min: number }>();

  // 7x24 그리드 생성
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const row of heatmapRaw.results || []) {
    const realEnd = row.end_min > 0 ? row.hour_end + 1 : row.hour_end;
    for (let h = row.hour_start; h < realEnd && h < 24; h++) {
      heatmap[row.weekday][h]++;
    }
  }

  // 총 예약 건수
  const total = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM reservations
    WHERE status = 'confirmed' AND date >= date('now', '-' || ? || ' days')
  `).bind(days).first<{ count: number }>();

  return c.json({
    avg_minutes: Math.round(avg?.avg_minutes || 0),
    popular_spaces: popular.results || [],
    heatmap,
    total: total?.count || 0,
    period_days: days,
  });
});

export default insights;
