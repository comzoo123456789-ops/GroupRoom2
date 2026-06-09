-- V5 마이그레이션
-- 1) REQ-AUTH-01: 공간(spaces)에 tenant_scope 컬럼 추가
--    NULL = 모든 테넌트 공개 (기본)
--    'WYLIE' = WYLIE 전용 (LUSH 사용자는 조회 불가)
--    'LUSH'  = LUSH 전용 (필요 시 사용)
ALTER TABLE spaces ADD COLUMN tenant_scope TEXT DEFAULT NULL;

-- 2) REQ-SEC-01: 최초 로그인 시 비밀번호 강제 변경 플래그
--    1 = 강제 변경 필요, 0 = 정상
ALTER TABLE users ADD COLUMN is_first_login INTEGER NOT NULL DEFAULT 0;

-- 마스터 관리자는 이미 비밀번호를 알고 있으므로 0 유지
UPDATE users SET is_first_login = 0 WHERE email = 'admin@wylie.co.kr';
