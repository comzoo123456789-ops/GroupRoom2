import type { Env } from "../types";
import type {
  LiveEvent,
  LiveStatus,
  Reservation,
  Room,
  RoomLive,
} from "../../shared/types";

// D1 행 → 도메인 타입 매핑 -------------------------------------------------

interface RoomRow {
  id: string;
  org_id: string;
  floor_id: string | null;
  name: string;
  kind: string;
  capacity: number;
  color: string;
  amenities: string;
  plan_x: number;
  plan_y: number;
  plan_w: number;
  plan_h: number;
  sort: number;
  active: number;
}

export function mapRoom(r: RoomRow): Room {
  let amenities: string[] = [];
  try {
    amenities = JSON.parse(r.amenities) as string[];
  } catch {
    amenities = [];
  }
  return {
    id: r.id,
    orgId: r.org_id,
    floorId: r.floor_id,
    name: r.name,
    kind: r.kind === "common" ? "common" : "meeting",
    capacity: r.capacity,
    color: r.color,
    amenities,
    plan: { x: r.plan_x, y: r.plan_y, w: r.plan_w, h: r.plan_h },
    sort: r.sort,
    active: r.active === 1,
  };
}

interface ResRow {
  id: string;
  org_id: string;
  room_id: string;
  user_id: string;
  title: string;
  purpose: string | null;
  starts_at: number;
  ends_at: number;
  status: string;
  checked_in_at: number | null;
  created_by_admin: number;
  attendee_count?: number;
  accepted_count?: number;
}

export function mapReservation(r: ResRow): Reservation {
  return {
    id: r.id,
    orgId: r.org_id,
    roomId: r.room_id,
    userId: r.user_id,
    title: r.title,
    purpose: r.purpose,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status as Reservation["status"],
    checkedInAt: r.checked_in_at,
    createdByAdmin: r.created_by_admin === 1,
    attendeeCount: r.attendee_count ?? 0,
    acceptedCount: r.accepted_count ?? 0,
  };
}

// 현재 상태 계산 ----------------------------------------------------------

const SOON_WINDOW_MS = 15 * 60 * 1000; // 15분 내 시작이면 'soon'

export function computeStatus(
  now: number,
  current: Reservation | null,
  next: Reservation | null,
): LiveStatus {
  if (current) return "busy";
  if (next && next.startsAt - now <= SOON_WINDOW_MS) return "soon";
  return "available";
}

/** 조직의 모든 활성 룸 + 현재/다음 예약 + 상태를 계산 */
export async function getRoomsLive(
  env: Env,
  orgId: string,
  now = Date.now(),
): Promise<RoomLive[]> {
  const rooms = await env.DB.prepare(
    `SELECT * FROM rooms WHERE org_id = ? AND active = 1 ORDER BY sort, name`,
  )
    .bind(orgId)
    .all<RoomRow>();

  // 오늘 하루치 예약만 (현재/다음 판정에 충분)
  const dayStart = now - 12 * 3600_000;
  const dayEnd = now + 24 * 3600_000;
  const res = await env.DB.prepare(
    `SELECT * FROM reservations
      WHERE org_id = ? AND status IN ('confirmed','checked_in')
        AND ends_at > ? AND starts_at < ?
      ORDER BY starts_at`,
  )
    .bind(orgId, dayStart, dayEnd)
    .all<ResRow>();

  const byRoom = new Map<string, Reservation[]>();
  for (const row of res.results) {
    const r = mapReservation(row);
    const arr = byRoom.get(r.roomId) ?? [];
    arr.push(r);
    byRoom.set(r.roomId, arr);
  }

  return rooms.results.map((row) => {
    const room = mapRoom(row);
    const list = byRoom.get(room.id) ?? [];
    const current = list.find((r) => r.startsAt <= now && r.endsAt > now) ?? null;
    const next = list.find((r) => r.startsAt > now) ?? null;
    return { ...room, status: computeStatus(now, current, next), current, next };
  });
}

/** 실시간 이벤트를 조직의 Durable Object 허브로 브로드캐스트 */
export async function notifyLive(
  env: Env,
  orgId: string,
  event: LiveEvent,
): Promise<void> {
  const id = env.ROOM_HUB.idFromName(orgId);
  const stub = env.ROOM_HUB.get(id);
  await stub.fetch("https://do.internal/broadcast", {
    method: "POST",
    body: JSON.stringify(event),
  });
}
