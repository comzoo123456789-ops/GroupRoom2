import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, resolveOrgId } from "../lib/session";
import { getRoomsLive, mapRoom, notifyLive } from "../lib/live";
import { newId } from "../lib/crypto";

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

// ---- 관리자 전용 CRUD -----------------------------------------------------

const KINDS = new Set(["meeting", "common"]);
const AMENITIES = new Set(["tv", "whiteboard", "cam"]);

interface RoomInput {
  name?: string;
  kind?: string;
  capacity?: number;
  color?: string;
  amenities?: string[];
  plan?: { x?: number; y?: number; w?: number; h?: number };
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function cleanAmenities(a?: string[]): string[] {
  if (!Array.isArray(a)) return [];
  return [...new Set(a.filter((x) => AMENITIES.has(x)))];
}

// 회의실 생성
rooms.post("/", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (user.role !== "admin") return c.json({ error: "관리자만 가능합니다." }, 403);

  const b = await c.req.json<RoomInput>().catch(() => ({}) as RoomInput);
  const name = b.name?.trim();
  if (!name) return c.json({ error: "회의실 이름을 입력하세요." }, 400);
  const kind = b.kind && KINDS.has(b.kind) ? b.kind : "meeting";
  const capacity = clamp(Number(b.capacity), 1, 500, 4);
  const color = /^#[0-9a-fA-F]{6}$/.test(b.color ?? "") ? b.color! : "#3B5BDB";
  const p = b.plan ?? {};
  const id = newId();

  // 다음 정렬 순서
  const maxSort = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort), -1) AS m FROM rooms WHERE org_id = ?`,
  )
    .bind(user.orgId)
    .first<{ m: number }>();

  await c.env.DB.prepare(
    `INSERT INTO rooms (id, org_id, floor_id, name, kind, capacity, color, amenities, plan_x, plan_y, plan_w, plan_h, sort, active)
     VALUES (?,?, (SELECT id FROM floors WHERE org_id = ? ORDER BY sort LIMIT 1), ?,?,?,?,?,?,?,?,?,?,1)`,
  )
    .bind(
      id,
      user.orgId,
      user.orgId,
      name,
      kind,
      capacity,
      color,
      JSON.stringify(cleanAmenities(b.amenities)),
      clamp(Number(p.x), 0, 92, 8),
      clamp(Number(p.y), 0, 88, 8),
      clamp(Number(p.w), 6, 60, 20),
      clamp(Number(p.h), 6, 60, 18),
      (maxSort?.m ?? -1) + 1,
    )
    .run();

  await notifyLive(c.env, user.orgId, { type: "reservation.changed", roomId: id, at: Date.now() });
  return c.json({ ok: true, id }, 201);
});

// 회의실 수정 (부분 업데이트 — 폼 저장 + 드래그/리사이즈 위치 저장 공용)
rooms.patch("/:id", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (user.role !== "admin") return c.json({ error: "관리자만 가능합니다." }, 403);

  const id = c.req.param("id");
  const exists = await c.env.DB.prepare(
    `SELECT id FROM rooms WHERE id = ? AND org_id = ?`,
  )
    .bind(id, user.orgId)
    .first();
  if (!exists) return c.json({ error: "회의실을 찾을 수 없습니다." }, 404);

  const b = await c.req.json<RoomInput>().catch(() => ({}) as RoomInput);
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof b.name === "string" && b.name.trim()) {
    sets.push("name = ?");
    vals.push(b.name.trim());
  }
  if (b.kind && KINDS.has(b.kind)) {
    sets.push("kind = ?");
    vals.push(b.kind);
  }
  if (b.capacity !== undefined) {
    sets.push("capacity = ?");
    vals.push(clamp(Number(b.capacity), 1, 500, 4));
  }
  if (b.color && /^#[0-9a-fA-F]{6}$/.test(b.color)) {
    sets.push("color = ?");
    vals.push(b.color);
  }
  if (b.amenities !== undefined) {
    sets.push("amenities = ?");
    vals.push(JSON.stringify(cleanAmenities(b.amenities)));
  }
  if (b.plan) {
    if (b.plan.x !== undefined) { sets.push("plan_x = ?"); vals.push(clamp(Number(b.plan.x), 0, 94, 8)); }
    if (b.plan.y !== undefined) { sets.push("plan_y = ?"); vals.push(clamp(Number(b.plan.y), 0, 92, 8)); }
    if (b.plan.w !== undefined) { sets.push("plan_w = ?"); vals.push(clamp(Number(b.plan.w), 6, 70, 20)); }
    if (b.plan.h !== undefined) { sets.push("plan_h = ?"); vals.push(clamp(Number(b.plan.h), 6, 70, 18)); }
  }
  if (!sets.length) return c.json({ error: "변경할 내용이 없습니다." }, 400);

  vals.push(id);
  await c.env.DB.prepare(`UPDATE rooms SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals)
    .run();

  await notifyLive(c.env, user.orgId, { type: "reservation.changed", roomId: id, at: Date.now() });
  return c.json({ ok: true });
});

// 회의실 삭제 (관련 예약도 함께 삭제 — FK CASCADE)
rooms.delete("/:id", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (user.role !== "admin") return c.json({ error: "관리자만 가능합니다." }, 403);

  const id = c.req.param("id");
  const exists = await c.env.DB.prepare(
    `SELECT id FROM rooms WHERE id = ? AND org_id = ?`,
  )
    .bind(id, user.orgId)
    .first();
  if (!exists) return c.json({ error: "회의실을 찾을 수 없습니다." }, 404);

  // 의존 데이터 명시적 정리 (D1 런타임 FK 강제에 의존하지 않음)
  await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM reservation_attendees
        WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id = ?)`,
    ).bind(id),
    c.env.DB.prepare(`DELETE FROM reservations WHERE room_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM rooms WHERE id = ? AND org_id = ?`).bind(id, user.orgId),
  ]);

  await notifyLive(c.env, user.orgId, { type: "reservation.changed", roomId: id, at: Date.now() });
  return c.json({ ok: true });
});
