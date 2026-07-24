import { Hono } from "hono";
import type { Env } from "../types";
import { resolveOrgId } from "../lib/session";
import { getRoomsLive, mapRoom } from "../lib/live";

export const rooms = new Hono<{ Bindings: Env }>();

// 룸 목록
rooms.get("/", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const rs = await c.env.DB.prepare(
    `SELECT * FROM rooms WHERE org_id = ? AND active = 1 ORDER BY sort, name`,
  )
    .bind(orgId)
    .all();
  return c.json({ rooms: rs.results.map((r) => mapRoom(r as never)) });
});

// 실시간 현황 (룸 + 현재/다음 예약 + 상태)
rooms.get("/live", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const live = await getRoomsLive(c.env, orgId);
  return c.json({ rooms: live, at: Date.now() });
});
