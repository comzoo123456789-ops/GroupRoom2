import { Hono } from "hono";
import type { Env } from "./types";
import { resolveOrgId } from "./lib/session";
import { auth } from "./routes/auth";
import { dev } from "./routes/dev";
import { rooms } from "./routes/rooms";
import { reservations } from "./routes/reservations";
import { members } from "./routes/members";
import { calendar } from "./routes/calendar";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "grouproom", at: Date.now() }),
);

// 실시간 현황판 WebSocket → 조직별 RoomHub(DO)로 포워딩
app.get("/api/live/ws", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.text("no org", 404);
  const id = c.env.ROOM_HUB.idFromName(orgId);
  const stub = c.env.ROOM_HUB.get(id);
  return stub.fetch(new Request("https://do.internal/ws", c.req.raw));
});

app.route("/api/auth", auth);
app.route("/api/dev", dev);
app.route("/api/rooms", rooms);
app.route("/api/reservations", reservations);
app.route("/api/members", members);
app.route("/api/calendar", calendar);

app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

export default app;
export { RoomHub } from "./durable/RoomHub";
