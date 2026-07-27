-- 부서/직급 마스터 + 사용자 직급 컬럼
CREATE TABLE departments (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, name)
);
CREATE INDEX idx_dept_org ON departments(org_id);

CREATE TABLE positions (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, name)
);
CREATE INDEX idx_pos_org ON positions(org_id);

ALTER TABLE users ADD COLUMN position TEXT;
