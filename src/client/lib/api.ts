import type {
  Reservation,
  RoomLive,
  Organization,
  RoomKind,
  Role,
  Member,
  Attendee,
  AttendeeStatus,
  Invitation,
} from "../../shared/types";

// /api/auth/me 응답의 로그인 사용자
export interface SessionUser {
  userId: string;
  orgId: string;
  role: Role;
  name: string;
  avatarColor: string;
  department: string | null;
}

export interface RoomInput {
  name?: string;
  kind?: RoomKind;
  capacity?: number;
  color?: string;
  amenities?: string[];
  plan?: { x?: number; y?: number; w?: number; h?: number };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export const api = {
  me: () =>
    req<{
      user: SessionUser | null;
      org: Organization | null;
    }>("/api/auth/me"),
  login: (email: string, password: string) =>
    req<{ ok: true }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => req<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  bootstrap: () =>
    req<{ ok: true; orgId: string; login?: { email: string; password: string } }>(
      "/api/dev/bootstrap",
      { method: "POST" },
    ),

  roomsLive: () => req<{ rooms: RoomLive[]; at: number }>("/api/rooms/live"),

  createRoom: (body: RoomInput) =>
    req<{ ok: true; id: string }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRoom: (id: string, body: RoomInput) =>
    req<{ ok: true }>(`/api/rooms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteRoom: (id: string) =>
    req<{ ok: true }>(`/api/rooms/${id}`, { method: "DELETE" }),

  reservations: (from?: number, to?: number) => {
    const q = new URLSearchParams();
    if (from) q.set("from", String(from));
    if (to) q.set("to", String(to));
    return req<{ reservations: Reservation[] }>(`/api/reservations?${q}`);
  },
  createReservation: (body: {
    roomId: string;
    title: string;
    purpose?: string;
    startsAt: number;
    endsAt: number;
  }) =>
    req<{ ok: true; id: string }>("/api/reservations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateReservation: (id: string, body: { startsAt?: number; endsAt?: number; title?: string; roomId?: string }) =>
    req<{ ok: true }>(`/api/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  cancelReservation: (id: string) =>
    req<{ ok: true }>(`/api/reservations/${id}`, { method: "DELETE" }),

  // 임직원 디렉터리(참석자 검색)
  members: (q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return req<{ members: Member[] }>(`/api/members${qs}`);
  },
  seedEmployees: () =>
    req<{ ok: true; employeesAdded: number }>("/api/dev/seed-employees", {
      method: "POST",
    }),

  // 참석자
  attendees: (reservationId: string) =>
    req<{ attendees: Attendee[] }>(`/api/reservations/${reservationId}/attendees`),
  setAttendees: (reservationId: string, userIds: string[]) =>
    req<{ ok: true; count: number; added: number; removed: number }>(
      `/api/reservations/${reservationId}/attendees`,
      { method: "PUT", body: JSON.stringify({ userIds }) },
    ),

  // 내 초대함 / RSVP
  invitations: () => req<{ invitations: Invitation[] }>("/api/reservations/inbox"),
  rsvp: (reservationId: string, status: AttendeeStatus) =>
    req<{ ok: true; status: AttendeeStatus }>(`/api/reservations/${reservationId}/rsvp`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
};

/** 실시간 현황 WebSocket 연결. onEvent는 서버 브로드캐스트마다 호출됨. */
export function connectLive(onEvent: () => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;

  const open = () => {
    if (closed) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/api/live/ws`);
    ws.onmessage = () => onEvent();
    ws.onopen = () => {
      retry = 0;
    };
    ws.onclose = () => {
      if (closed) return;
      retry = Math.min(retry + 1, 6);
      setTimeout(open, 500 * 2 ** retry);
    };
    ws.onerror = () => ws?.close();
  };
  open();

  return () => {
    closed = true;
    ws?.close();
  };
}
