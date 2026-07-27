import type {
  Reservation,
  RoomLive,
  Organization,
  RoomKind,
  Role,
  MembersResponse,
  UserStatus,
  Attendee,
  AttendeeStatus,
  Invitation,
  ReservationDetail,
  UpcomingMeeting,
  Analytics,
  Attachment,
  OrgMaster,
} from "../../shared/types";

export type MasterKind = "departments" | "positions";

// /api/auth/me 응답의 로그인 사용자
export interface SessionUser {
  userId: string;
  orgId: string;
  role: Role;
  name: string;
  avatarColor: string;
  department: string | null;
  mustResetPw?: boolean;
}

export interface RoomInput {
  name?: string;
  kind?: RoomKind;
  capacity?: number;
  color?: string;
  amenities?: string[];
  plan?: { x?: number; y?: number; w?: number; h?: number };
  policy?: {
    openMin?: number;
    closeMin?: number;
    maxDurationMin?: number;
    maxAdvanceDays?: number;
  };
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
  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: true }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

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
    agenda?: string;
    videoUrl?: string;
    notes?: string;
    recurrence?: {
      freq: "daily" | "weekly" | "monthly";
      interval?: number;
      count?: number;
      until?: number;
    };
  }) =>
    req<{ ok: true; id: string; created?: number; skipped?: number }>("/api/reservations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateReservation: (
    id: string,
    body: {
      startsAt?: number;
      endsAt?: number;
      title?: string;
      roomId?: string;
      agenda?: string;
      videoUrl?: string;
      notes?: string;
    },
  ) =>
    req<{ ok: true }>(`/api/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  reservationDetail: (id: string) =>
    req<{ detail: ReservationDetail }>(`/api/reservations/${id}/detail`),
  upcomingMine: () => req<{ upcoming: UpcomingMeeting[] }>("/api/reservations/mine/upcoming"),
  cancelReservation: (id: string, scope?: "series") =>
    req<{ ok: true }>(`/api/reservations/${id}${scope ? `?scope=${scope}` : ""}`, {
      method: "DELETE",
    }),

  // 캘린더(.ics) URL — 다운로드/구독용
  reservationIcsUrl: (id: string) => `/api/reservations/${id}/ics`,
  myCalendarUrl: () => `/api/calendar/mine.ics`,

  // 임직원 디렉터리(참석자 검색)
  members: (q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return req<MembersResponse>(`/api/members${qs}`);
  },
  // 멤버 관리 목록 (검색·필터·페이지네이션)
  memberList: (params: {
    q?: string;
    dept?: string;
    role?: Role | "";
    status?: UserStatus | "";
    limit?: number;
    offset?: number;
  }) => {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.dept) p.set("dept", params.dept);
    if (params.role) p.set("role", params.role);
    if (params.status) p.set("status", params.status);
    if (params.limit != null) p.set("limit", String(params.limit));
    if (params.offset != null) p.set("offset", String(params.offset));
    return req<MembersResponse>(`/api/members?${p}`);
  },
  createMember: (body: {
    name: string;
    email: string;
    department?: string;
    position?: string;
    role?: Role;
  }) =>
    req<{ ok: true; id: string; tempPassword: string }>("/api/members", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMember: (
    id: string,
    body: { role?: Role; status?: UserStatus; department?: string; position?: string; name?: string },
  ) =>
    req<{ ok: true }>(`/api/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // 조직 마스터 (부서명/직급명 관리)
  orgMasters: () =>
    req<{ departments: OrgMaster[]; positions: OrgMaster[] }>("/api/org/masters"),
  addMaster: (kind: MasterKind, name: string) =>
    req<{ ok: true; id: string; name: string }>(`/api/org/${kind}`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameMaster: (kind: MasterKind, id: string, name: string) =>
    req<{ ok: true }>(`/api/org/${kind}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteMaster: (kind: MasterKind, id: string) =>
    req<{ ok: true }>(`/api/org/${kind}/${id}`, { method: "DELETE" }),
  myRole: () => req<{ userId: string | null; role: Role | null }>("/api/members/me"),

  // 이용 분석
  analytics: (days: number) => req<Analytics>(`/api/analytics?days=${days}`),
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

  // 첨부파일 (업로드 24시간 후 자동 삭제)
  attachments: (reservationId: string) =>
    req<{ attachments: Attachment[] }>(`/api/reservations/${reservationId}/attachments`),
  uploadAttachment: async (reservationId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // FormData 전송 시 Content-Type을 브라우저가 boundary와 함께 자동 설정하도록 헤더 생략
    const res = await fetch(`/api/reservations/${reservationId}/attachments`, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json().catch(() => ({}))) as { attachment?: Attachment; error?: string };
    if (!res.ok) throw new Error(data.error ?? `업로드 실패 (${res.status})`);
    return data.attachment as Attachment;
  },
  deleteAttachment: (reservationId: string, attachmentId: string) =>
    req<{ ok: true }>(`/api/reservations/${reservationId}/attachments/${attachmentId}`, {
      method: "DELETE",
    }),
  attachmentUrl: (reservationId: string, attachmentId: string) =>
    `/api/reservations/${reservationId}/attachments/${attachmentId}/download`,
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
