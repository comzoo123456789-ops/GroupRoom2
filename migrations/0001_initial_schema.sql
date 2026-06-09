-- 테넌트(회사) 테이블
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0066cc',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 사용자(임직원) 테이블 - 멀티 테넌트
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending', 'inactive'
  avatar_color TEXT DEFAULT '#7a7a7a',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 공간(자원) 테이블
CREATE TABLE IF NOT EXISTS spaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'meeting_room', 'common_space'
  capacity INTEGER DEFAULT 0,
  color TEXT DEFAULT '#0066cc',
  count_in_limit INTEGER DEFAULT 1, -- 3개 제한 카운트 포함 여부 (1=포함, 0=제외)
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 반복 예약 규칙 테이블
CREATE TABLE IF NOT EXISTS recurring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  end_type TEXT NOT NULL, -- 'date', 'count'
  end_date TEXT,
  end_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 예약 테이블
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  space_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '새로운 일정',
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  start_time TEXT NOT NULL, -- 'HH:MM'
  end_time TEXT NOT NULL, -- 'HH:MM'
  attendees TEXT, -- JSON array of user ids or emails
  recurring_rule_id INTEGER,
  created_by_admin INTEGER DEFAULT 0, -- 어드민 권한으로 생성된 예약 (제한 우회)
  status TEXT DEFAULT 'confirmed', -- 'confirmed', 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (space_id) REFERENCES spaces(id),
  FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules(id)
);

-- 세션 테이블 (JWT 대안 - 간단한 토큰 기반)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_reservations_date_space ON reservations(date, space_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_id ON reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
