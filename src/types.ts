export type Bindings = {
  DB: D1Database;
}

export type Tenant = {
  id: string;
  name: string;
  color: string;
};

export type User = {
  id: number;
  tenant_id: string;
  email: string;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  avatar_color: string;
  /** V5 REQ-SEC-01: 최초 로그인 시 비밀번호 강제 변경 플래그 (1=필요) */
  is_first_login?: number;
};

export type Department = {
  id: number;
  tenant_id: string;
  name: string;
  display_order: number;
};

export type Position = {
  id: number;
  tenant_id: string;
  name: string;
  display_order: number;
};

export type Space = {
  id: number;
  name: string;
  type: 'meeting_room' | 'common_space';
  capacity: number;
  color: string;
  count_in_limit: number;
  display_order: number;
  /** V5: 테넌트 전용 공간 격리. NULL이면 모두 공개. */
  tenant_scope: string | null;
};



export type Reservation = {
  id: number;
  tenant_id: string;
  user_id: number;
  space_id: number;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  attendees: string | null;
  recurring_rule_id: number | null;
  created_by_admin: number;
  status: 'confirmed' | 'cancelled';
  user_name?: string;
  user_avatar_color?: string;
  space_name?: string;
  space_color?: string;
};
