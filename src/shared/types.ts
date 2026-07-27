// 클라이언트 ↔ 워커 공유 도메인 타입

export type Role = "admin" | "member";
export type RoomKind = "meeting" | "common";
export type ReservationStatus =
  | "confirmed"
  | "cancelled"
  | "checked_in"
  | "no_show";

// 실시간 현황판에서 계산하는 룸의 현재 상태
export type LiveStatus = "available" | "busy" | "soon";

// 예약 첨부파일 (KV 저장, 업로드 24시간 후 자동 삭제)
export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: number;
  expiresAt: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
  timezone: string;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  avatarColor: string;
}

export interface Room {
  id: string;
  orgId: string;
  floorId: string | null;
  name: string;
  kind: RoomKind;
  capacity: number;
  color: string;
  amenities: string[];
  plan: { x: number; y: number; w: number; h: number };
  sort: number;
  active: boolean;
}

export interface Reservation {
  id: string;
  orgId: string;
  roomId: string;
  userId: string;
  title: string;
  purpose: string | null;
  startsAt: number; // unix epoch ms (UTC)
  endsAt: number;
  status: ReservationStatus;
  checkedInAt: number | null;
  createdByAdmin: boolean;
  recurringId?: string | null; // 반복 시리즈 id (반복 예약이면)
  videoUrl?: string | null; // 화상회의 링크(있으면 블록에 표시)
  attendeeCount?: number; // 초대된 참석자 수(주최자 제외)
  acceptedCount?: number; // 수락한 참석자 수
}

// 회의 상세(에디터에서 조회)
export interface ReservationDetail {
  agenda: string | null;
  videoUrl: string | null;
  notes: string | null;
}

// 시작 전 리마인더용 다가오는 회의
export interface UpcomingMeeting {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  videoUrl: string | null;
  roomName: string;
}

// 현황판 응답: 룸 + 현재상태 + 지금/다음 예약
export interface RoomLive extends Room {
  status: LiveStatus;
  current: Reservation | null;
  next: Reservation | null;
}

// 계정 상태
export type UserStatus = "active" | "invited" | "inactive";

// 임직원 디렉터리(참석자 검색·멤버 관리)
export interface Member {
  id: string;
  name: string;
  email: string;
  department: string | null;
  avatarColor: string;
  role: Role;
  status: UserStatus;
}

// 멤버 목록 응답
export interface MembersResponse {
  members: Member[];
  total: number;
  departments: { name: string; n: number }[];
}

// 예약 참석자
export type AttendeeStatus = "pending" | "accepted" | "declined";
export interface Attendee {
  userId: string;
  name: string;
  email: string;
  department: string | null;
  avatarColor: string;
  status: AttendeeStatus;
}

// 내 초대함 항목
export interface Invitation {
  reservationId: string;
  title: string;
  startsAt: number;
  endsAt: number;
  roomName: string;
  roomColor: string;
  organizerName: string;
  myStatus: AttendeeStatus;
}

// 이용 분석
export interface Analytics {
  days: number;
  totals: {
    reservations: number;
    hours: number;
    avgDurationMin: number;
    cancelRate: number;
    utilizationPct: number;
  };
  rooms: { id: string; name: string; color: string; hours: number; count: number; utilizationPct: number }[];
  heatmap: number[][]; // [weekday 0=일..6=토][hourIndex]
  hourStart: number;
  departments: { dept: string; count: number; hours: number }[];
  daily: { date: string; count: number; hours: number }[];
}

export interface ApiError {
  error: string;
}

// Durable Object가 브로드캐스트하는 실시간 메시지
export type LiveEvent =
  | { type: "hello"; at: number }
  | { type: "reservation.changed"; roomId: string; at: number }
  | { type: "tick"; at: number };
