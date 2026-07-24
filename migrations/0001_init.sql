-- GroupRoom 초기 스키마 (D1 / SQLite)
-- 설계 원칙 (메이트리 대비 개선점):
--   * 시간은 INTEGER(unix epoch, ms)로 저장 → 자정 넘김·멀티데이·충돌계산 정확
--   * 멀티테넌트(organizations) + 화이트라벨 브랜딩을 1일차부터 내장
--   * 실제 체크인/노쇼 상태를 별도 컬럼으로 구분 (취소=노쇼 왜곡 제거)
--   * 회의실에 floor-plan 좌표(x,y,w,h) 내장 → 실시간 현황판(도면) 지원
--   * 비밀번호는 salt + PBKDF2 해시 저장 (worker/lib/password.ts)

PRAGMA foreign_keys = ON;

-- 조직(테넌트). 판매 시 업체 1개 = organization 1개. 화이트라벨 브랜딩 포함.
CREATE TABLE organizations (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,          -- 서브도메인/식별자
  logo_url     TEXT,
  brand_color  TEXT NOT NULL DEFAULT '#3B5BDB',
  timezone     TEXT NOT NULL DEFAULT 'Asia/Seoul',
  created_at   INTEGER NOT NULL
);

-- 사용자
CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member',   -- 'admin' | 'member'
  department     TEXT,
  avatar_color   TEXT NOT NULL DEFAULT '#3B5BDB',
  status         TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'invited' | 'inactive'
  must_reset_pw  INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  UNIQUE (org_id, email)
);
CREATE INDEX idx_users_org ON users(org_id);

-- 세션 (쿠키 토큰)
CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- 층/구역 (도면 배경). 선택적.
CREATE TABLE floors (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  bg_url      TEXT
);
CREATE INDEX idx_floors_org ON floors(org_id);

-- 회의실/공용공간
CREATE TABLE rooms (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  floor_id    TEXT REFERENCES floors(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'meeting',   -- 'meeting' | 'common'
  capacity    INTEGER NOT NULL DEFAULT 4,
  color       TEXT NOT NULL DEFAULT '#3B5BDB',
  amenities   TEXT NOT NULL DEFAULT '[]',        -- JSON 배열: ["tv","whiteboard","cam"]
  -- 도면 상 위치(백분율 0~100 기준). 실시간 현황판에서 사용.
  plan_x      REAL NOT NULL DEFAULT 10,
  plan_y      REAL NOT NULL DEFAULT 10,
  plan_w      REAL NOT NULL DEFAULT 18,
  plan_h      REAL NOT NULL DEFAULT 14,
  sort        INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_rooms_org ON rooms(org_id);

-- 반복 규칙
CREATE TABLE recurring_rules (
  id        TEXT PRIMARY KEY,
  org_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  freq      TEXT NOT NULL,          -- 'daily' | 'weekly' | 'monthly'
  interval_n INTEGER NOT NULL DEFAULT 1,
  end_type  TEXT NOT NULL,          -- 'date' | 'count'
  end_date  INTEGER,
  end_count INTEGER
);

-- 예약
CREATE TABLE reservations (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id        TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  purpose        TEXT,
  starts_at      INTEGER NOT NULL,   -- unix epoch ms (UTC)
  ends_at        INTEGER NOT NULL,   -- unix epoch ms (UTC)
  status         TEXT NOT NULL DEFAULT 'confirmed', -- confirmed|cancelled|checked_in|no_show
  checked_in_at  INTEGER,
  recurring_id   TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
  created_by_admin INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_res_room_time ON reservations(room_id, starts_at, ends_at);
CREATE INDEX idx_res_org_time ON reservations(org_id, starts_at);
CREATE INDEX idx_res_user ON reservations(user_id);

-- 참석자 (다대다)
CREATE TABLE reservation_attendees (
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending|accepted|declined
  PRIMARY KEY (reservation_id, user_id)
);

-- 감사 로그 (기록 + 조회 화면 둘 다 제공 예정)
CREATE TABLE activity_log (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  actor_id    TEXT,
  actor_name  TEXT,
  action      TEXT NOT NULL,        -- create|update|delete|login|checkin ...
  entity_type TEXT NOT NULL,        -- reservation|room|user ...
  entity_id   TEXT,
  summary     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_log_org_time ON activity_log(org_id, created_at);
