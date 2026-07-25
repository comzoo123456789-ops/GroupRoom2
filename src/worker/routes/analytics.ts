import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, resolveOrgId } from "../lib/session";

export const analytics = new Hono<{ Bindings: Env }>();

const DAY_START = 8; // 운영 시작시(로컬)
const DAY_END = 22; // 운영 종료시
const OPEN_HOURS = DAY_END - DAY_START;

interface Row {
  starts_at: number;
  ends_at: number;
  room_id: string;
  room_name: string;
  room_color: string;
  department: string | null;
}

// 이용 분석 집계 (KPI · 회의실 가동률 · 요일×시간 히트맵 · 부서별 · 일별)
analytics.get("/", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const me = await currentUser(c);
  if (!me) return c.json({ error: "로그인이 필요합니다." }, 401);

  const days = Math.min(90, Math.max(7, Number(c.req.query("days") ?? 30)));
  const to = Date.now();
  const from = to - days * 86400_000;

  const active = await c.env.DB.prepare(
    `SELECT r.starts_at, r.ends_at, r.room_id,
            rm.name AS room_name, rm.color AS room_color, u.department AS department
       FROM reservations r
       JOIN rooms rm ON rm.id = r.room_id
       JOIN users u ON u.id = r.user_id
      WHERE r.org_id = ? AND r.status IN ('confirmed','checked_in')
        AND r.starts_at >= ? AND r.starts_at < ?`,
  )
    .bind(orgId, from, to)
    .all<Row>();

  const cancelled = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM reservations
      WHERE org_id = ? AND status = 'cancelled' AND starts_at >= ? AND starts_at < ?`,
  )
    .bind(orgId, from, to)
    .first<{ n: number }>();

  const roomRows = await c.env.DB.prepare(
    `SELECT id, name, color FROM rooms WHERE org_id = ? AND active = 1 ORDER BY sort, name`,
  )
    .bind(orgId)
    .all<{ id: string; name: string; color: string }>();

  // 영업일(월~금) 수 — 가동률 분모
  let bizDays = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(to - i * 86400_000).getDay();
    if (d !== 0 && d !== 6) bizDays++;
  }
  const availPerRoom = Math.max(1, bizDays * OPEN_HOURS);

  const rows = active.results;
  let totalMin = 0;
  const roomAgg = new Map<string, { hours: number; count: number }>();
  const deptAgg = new Map<string, { count: number; min: number }>();
  const dailyAgg = new Map<string, { count: number; min: number }>();
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    new Array(OPEN_HOURS).fill(0),
  );

  for (const r of rows) {
    const min = Math.max(0, (r.ends_at - r.starts_at) / 60000);
    totalMin += min;

    const ra = roomAgg.get(r.room_id) ?? { hours: 0, count: 0 };
    ra.hours += min / 60;
    ra.count += 1;
    roomAgg.set(r.room_id, ra);

    const dept = r.department || "미지정";
    const da = deptAgg.get(dept) ?? { count: 0, min: 0 };
    da.count += 1;
    da.min += min;
    deptAgg.set(dept, da);

    const sd = new Date(r.starts_at);
    const key = `${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`;
    const dd = dailyAgg.get(key) ?? { count: 0, min: 0 };
    dd.count += 1;
    dd.min += min;
    dailyAgg.set(key, dd);

    const hourIdx = Math.min(OPEN_HOURS - 1, Math.max(0, sd.getHours() - DAY_START));
    heatmap[sd.getDay()][hourIdx] += 1;
  }

  const rooms = roomRows.results.map((rm) => {
    const a = roomAgg.get(rm.id) ?? { hours: 0, count: 0 };
    return {
      id: rm.id,
      name: rm.name,
      color: rm.color,
      hours: Math.round(a.hours * 10) / 10,
      count: a.count,
      utilizationPct: Math.min(100, Math.round((a.hours / availPerRoom) * 100)),
    };
  });

  const departments = [...deptAgg.entries()]
    .map(([dept, v]) => ({ dept, count: v.count, hours: Math.round((v.min / 60) * 10) / 10 }))
    .sort((a, b) => b.count - a.count);

  // 일별: 오래된→최신 순으로 채움(빈 날 0)
  const daily: { date: string; count: number; hours: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(to - i * 86400_000);
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const v = dailyAgg.get(key) ?? { count: 0, min: 0 };
    daily.push({ date: key, count: v.count, hours: Math.round((v.min / 60) * 10) / 10 });
  }

  const totalHours = totalMin / 60;
  const avgUtil =
    rooms.length > 0
      ? Math.round(rooms.reduce((s, r) => s + r.utilizationPct, 0) / rooms.length)
      : 0;
  const cancelledN = cancelled?.n ?? 0;
  const cancelRate =
    rows.length + cancelledN > 0
      ? Math.round((cancelledN / (rows.length + cancelledN)) * 100)
      : 0;

  return c.json({
    days,
    totals: {
      reservations: rows.length,
      hours: Math.round(totalHours * 10) / 10,
      avgDurationMin: rows.length ? Math.round(totalMin / rows.length) : 0,
      cancelRate,
      utilizationPct: avgUtil,
    },
    rooms,
    heatmap,
    hourStart: DAY_START,
    departments,
    daily,
  });
});
