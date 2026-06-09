-- ============================================================
-- 메이트리그라운드 V5 초기 시드
-- 정책:
--  - 멤버: WYLIE 마스터(admin@wylie.co.kr) + LUSH 관리자(admin@lush.co.kr) 2명
--  - 기존 하드코딩 더미 멤버(박호근, 오동주, 최다녀, 이상호, 박수정 등) 제거
--  - 부서/직책은 마스터 데이터로 별도 테이블 관리 (관리자가 직접 등록)
--  - V5: 5층 회의실은 WYLIE 전용 (tenant_scope='WYLIE')
-- ============================================================

-- 테넌트(회사)
INSERT OR IGNORE INTO tenants (id, name, color) VALUES
  ('WYLIE', '와일리', '#0066cc'),
  ('LUSH', '러쉬코리아', '#1d1d1f');

-- 공간(자원) - 7개 (이름은 관리자가 자유롭게 변경 가능)
-- 5층 회의실(WYLIE 전용)은 8번 ID로 별도 추가
INSERT OR IGNORE INTO spaces (id, name, type, capacity, color, count_in_limit, display_order, tenant_scope) VALUES
  (1, 'Meeting Room A', 'meeting_room', 8, '#ef4444', 1, 1, NULL),
  (2, 'Meeting Room B', 'meeting_room', 8, '#f59e0b', 1, 2, NULL),
  (3, 'Meeting Room C', 'meeting_room', 8, '#10b981', 1, 3, NULL),
  (4, 'Meeting Room D', 'meeting_room', 8, '#0066cc', 1, 4, NULL),
  (5, 'Meeting Room E', 'meeting_room', 8, '#8b5cf6', 1, 5, NULL),
  (6, 'Lounge', 'common_space', 80, '#7a7a7a', 0, 6, NULL),
  (7, 'Recharging Zone', 'common_space', 1, '#7a7a7a', 0, 7, NULL),
  (8, '5층 회의실', 'meeting_room', 12, '#0066cc', 1, 8, 'WYLIE');

-- 기존 더미 멤버 전면 삭제 (V4 정책 유지)
DELETE FROM reservations WHERE user_id IN (
  SELECT id FROM users WHERE email NOT IN ('admin@wylie.co.kr', 'admin@lush.co.kr')
);
DELETE FROM sessions WHERE user_id IN (
  SELECT id FROM users WHERE email NOT IN ('admin@wylie.co.kr', 'admin@lush.co.kr')
);
DELETE FROM users WHERE email NOT IN ('admin@wylie.co.kr', 'admin@lush.co.kr');

-- 마스터 관리자 등록
--   password 'admin1234' -> SHA256: ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270
INSERT OR IGNORE INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color, is_first_login) VALUES
  ('WYLIE', 'admin@wylie.co.kr', 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270',
   '마스터 관리자 (WYLIE)', NULL, NULL, NULL, 'admin', 'active', '#0066cc', 0),
  ('LUSH', 'admin@lush.co.kr', 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270',
   '관리자 (LUSH)', NULL, NULL, NULL, 'admin', 'active', '#1d1d1f', 0);

-- 기존 마스터 관리자 이름을 정확히 정정 (이전 시드 산출물 보정)
UPDATE users SET
  name = '마스터 관리자 (WYLIE)',
  is_first_login = 0,
  status = 'active'
WHERE email = 'admin@wylie.co.kr';

UPDATE users SET
  name = '관리자 (LUSH)',
  is_first_login = 0,
  status = 'active'
WHERE email = 'admin@lush.co.kr';

-- 부서/직책 초기 비움 (관리자가 [부서/직책 관리] 탭에서 직접 추가)
DELETE FROM departments;
DELETE FROM positions;
