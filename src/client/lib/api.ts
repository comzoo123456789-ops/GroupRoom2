import type { Reservation, RoomLive, User, Organization, RoomKind } from "../../shared/types";

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
  me: () => req<{ user: User | null; org: Organization | null }>("/api/auth/me"),
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
