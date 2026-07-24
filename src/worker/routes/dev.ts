import { Hono } from "hono";
import type { Env } from "../types";
import { hashPassword, newId } from "../lib/crypto";

export const dev = new Hono<{ Bindings: Env }>();

interface SeedRoom {
  name: string;
  kind: "meeting" | "common";
  capacity: number;
  color: string;
  amenities: string[];
  plan: { x: number; y: number; w: number; h: number };
}

const SEED_ROOMS: SeedRoom[] = [
  { name: "포커스룸 A", kind: "meeting", capacity: 4, color: "#3B5BDB", amenities: ["tv", "whiteboard"], plan: { x: 5, y: 8, w: 20, h: 24 } },
  { name: "포커스룸 B", kind: "meeting", capacity: 4, color: "#0CA678", amenities: ["whiteboard"], plan: { x: 5, y: 36, w: 20, h: 24 } },
  { name: "대회의실", kind: "meeting", capacity: 12, color: "#7048E8", amenities: ["tv", "whiteboard", "cam"], plan: { x: 30, y: 8, w: 35, h: 30 } },
  { name: "화상회의실", kind: "meeting", capacity: 6, color: "#F76707", amenities: ["cam", "tv"], plan: { x: 30, y: 44, w: 35, h: 24 } },
  { name: "라운지", kind: "common", capacity: 20, color: "#1098AD", amenities: [], plan: { x: 70, y: 8, w: 25, h: 30 } },
  { name: "폰부스 1", kind: "meeting", capacity: 1, color: "#E8590C", amenities: [], plan: { x: 70, y: 44, w: 11, h: 12 } },
  { name: "폰부스 2", kind: "meeting", capacity: 1, color: "#E8590C", amenities: [], plan: { x: 84, y: 44, w: 11, h: 12 } },
];

/**
 * 데모 데이터 부트스트랩. demo 조직이 없을 때만 생성 (멱등).
 * 관리자 계정은 워커의 실제 해싱으로 생성 → 로그인 즉시 가능.
 */
dev.post("/bootstrap", async (c) => {
  const existing = await c.env.DB.prepare(
    `SELECT id FROM organizations WHERE slug = 'demo'`,
  ).first<{ id: string }>();
  if (existing) {
    return c.json({ ok: true, already: true, orgId: existing.id });
  }

  const now = Date.now();
  const orgId = newId();
  await c.env.DB.prepare(
    `INSERT INTO organizations (id, name, slug, brand_color, timezone, created_at)
     VALUES (?, ?, 'demo', '#3B5BDB', 'Asia/Seoul', ?)`,
  )
    .bind(orgId, "GroupRoom 데모", now)
    .run();

  const { hash, salt } = await hashPassword("admin1234");
  const adminId = newId();
  await c.env.DB.prepare(
    `INSERT INTO users (id, org_id, email, name, password_hash, password_salt, role, department, avatar_color, status, created_at)
     VALUES (?, ?, 'admin@demo.com', '관리자', ?, ?, 'admin', '운영', '#3B5BDB', 'active', ?)`,
  )
    .bind(adminId, orgId, hash, salt, now)
    .run();

  const floorId = newId();
  await c.env.DB.prepare(
    `INSERT INTO floors (id, org_id, name, sort) VALUES (?, ?, '8F 오피스', 0)`,
  )
    .bind(floorId, orgId)
    .run();

  const roomIds: string[] = [];
  for (let i = 0; i < SEED_ROOMS.length; i++) {
    const r = SEED_ROOMS[i];
    const rid = newId();
    roomIds.push(rid);
    await c.env.DB.prepare(
      `INSERT INTO rooms (id, org_id, floor_id, name, kind, capacity, color, amenities, plan_x, plan_y, plan_w, plan_h, sort, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
    )
      .bind(
        rid, orgId, floorId, r.name, r.kind, r.capacity, r.color,
        JSON.stringify(r.amenities), r.plan.x, r.plan.y, r.plan.w, r.plan.h, i,
      )
      .run();
  }

  // 데모 예약: 대회의실=지금 진행중(busy), 포커스룸A=곧 시작(soon)
  const mkRes = async (roomId: string, title: string, startsAt: number, endsAt: number) => {
    await c.env.DB.prepare(
      `INSERT INTO reservations (id, org_id, room_id, user_id, title, purpose, starts_at, ends_at, status, created_by_admin, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?, 'confirmed', 1, ?, ?)`,
    )
      .bind(newId(), orgId, roomId, adminId, title, null, startsAt, endsAt, now, now)
      .run();
  };
  await mkRes(roomIds[2], "주간 전체회의", now - 25 * 60_000, now + 35 * 60_000);
  await mkRes(roomIds[0], "1:1 미팅", now + 8 * 60_000, now + 38 * 60_000);
  await mkRes(roomIds[3], "고객사 화상 데모", now + 90 * 60_000, now + 150 * 60_000);

  return c.json({
    ok: true,
    orgId,
    login: { email: "admin@demo.com", password: "admin1234" },
  });
});
