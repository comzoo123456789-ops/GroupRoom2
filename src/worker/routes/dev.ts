import { Hono } from "hono";
import type { Env } from "../types";
import { hashPassword, newId } from "../lib/crypto";
import { resolveOrgId } from "../lib/session";

export const dev = new Hono<{ Bindings: Env }>();

// 데모 임직원 디렉터리 — 참석자 검색/초대용. 비밀번호는 모두 demo1234.
const SEED_EMPLOYEES: { name: string; email: string; dept: string; color: string }[] = [
  { name: "김민준", email: "minjun.kim@demo.com", dept: "개발팀", color: "#3B5BDB" },
  { name: "이서연", email: "seoyeon.lee@demo.com", dept: "디자인팀", color: "#0CA678" },
  { name: "박도윤", email: "doyoon.park@demo.com", dept: "영업팀", color: "#7048E8" },
  { name: "최지우", email: "jiwoo.choi@demo.com", dept: "마케팅팀", color: "#F76707" },
  { name: "정하준", email: "hajun.jung@demo.com", dept: "개발팀", color: "#1098AD" },
  { name: "강서준", email: "seojun.kang@demo.com", dept: "인사팀", color: "#E8590C" },
  { name: "조은우", email: "eunwoo.cho@demo.com", dept: "재무팀", color: "#D6336C" },
  { name: "윤지호", email: "jiho.yoon@demo.com", dept: "개발팀", color: "#2F9E44" },
  { name: "임채원", email: "chaewon.lim@demo.com", dept: "디자인팀", color: "#5C7CFA" },
  { name: "한예준", email: "yejun.han@demo.com", dept: "영업팀", color: "#F03E3E" },
  { name: "오유진", email: "yujin.oh@demo.com", dept: "마케팅팀", color: "#9C36B5" },
  { name: "서지안", email: "jian.seo@demo.com", dept: "경영지원", color: "#0C8599" },
];

/** 조직에 임직원 시드를 멱등하게 채운다(이메일 기준 중복 방지). 추가된 수 반환. */
async function ensureEmployees(env: Env, orgId: string, now: number): Promise<number> {
  const { hash, salt } = await hashPassword("demo1234");
  let added = 0;
  for (const e of SEED_EMPLOYEES) {
    const exists = await env.DB.prepare(
      `SELECT 1 FROM users WHERE org_id = ? AND email = ?`,
    )
      .bind(orgId, e.email)
      .first();
    if (exists) continue;
    await env.DB.prepare(
      `INSERT INTO users (id, org_id, email, name, password_hash, password_salt, role, department, avatar_color, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'member', ?, ?, 'active', ?)`,
    )
      .bind(newId(), orgId, e.email, e.name, hash, salt, e.dept, e.color, now)
      .run();
    added++;
  }
  return added;
}

interface SeedRoom {
  name: string;
  kind: "meeting" | "common";
  capacity: number;
  color: string;
  amenities: string[];
  plan: { x: number; y: number; w: number; h: number };
}

const SEED_ROOMS: SeedRoom[] = [
  { name: "회의실 A", kind: "meeting", capacity: 4, color: "#3B5BDB", amenities: ["tv", "whiteboard"], plan: { x: 6, y: 8, w: 22, h: 26 } },
  { name: "회의실 B", kind: "meeting", capacity: 4, color: "#0CA678", amenities: ["whiteboard"], plan: { x: 6, y: 40, w: 22, h: 26 } },
  { name: "회의실 C", kind: "meeting", capacity: 12, color: "#7048E8", amenities: ["tv", "whiteboard", "cam"], plan: { x: 34, y: 8, w: 30, h: 30 } },
  { name: "회의실 D", kind: "meeting", capacity: 6, color: "#F76707", amenities: ["cam", "tv"], plan: { x: 34, y: 44, w: 30, h: 24 } },
  { name: "회의실 E", kind: "meeting", capacity: 8, color: "#1098AD", amenities: ["tv"], plan: { x: 70, y: 8, w: 24, h: 26 } },
  { name: "라운지", kind: "common", capacity: 20, color: "#E8590C", amenities: [], plan: { x: 70, y: 40, w: 24, h: 26 } },
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
    // 이미 조직이 있으면 임직원 디렉터리만 보강(멱등)
    const added = await ensureEmployees(c.env, existing.id, Date.now());
    return c.json({ ok: true, already: true, orgId: existing.id, employeesAdded: added });
  }

  const now = Date.now();
  const orgId = newId();
  await c.env.DB.prepare(
    `INSERT INTO organizations (id, name, slug, brand_color, timezone, created_at)
     VALUES (?, ?, 'demo', '#703B96', 'Asia/Seoul', ?)`,
  )
    .bind(orgId, "와일리", now)
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

  await ensureEmployees(c.env, orgId, now);

  return c.json({
    ok: true,
    orgId,
    login: { email: "admin@demo.com", password: "admin1234" },
  });
});

// 기존 조직에 임직원 디렉터리만 보강 (멱등). 로그인 시 해당 조직, 아니면 데모.
dev.post("/seed-employees", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const added = await ensureEmployees(c.env, orgId, Date.now());
  return c.json({ ok: true, orgId, employeesAdded: added });
});
