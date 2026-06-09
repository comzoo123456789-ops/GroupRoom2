-- 테넌트 (회사) 데이터
INSERT OR IGNORE INTO tenants (id, name, color) VALUES
  ('WYLIE', '와일리', '#0066cc'),
  ('LUSH', '러쉬코리아', '#1d1d1f');

-- 공간(자원) 시드 - 7개
-- 미팅룸 5개 (3개 제한 카운트 포함)
INSERT OR IGNORE INTO spaces (id, name, type, capacity, color, count_in_limit, display_order) VALUES
  (1, 'Meeting Room A', 'meeting_room', 8, '#ef4444', 1, 1),
  (2, 'Meeting Room B', 'meeting_room', 8, '#f59e0b', 1, 2),
  (3, 'Meeting Room C', 'meeting_room', 8, '#10b981', 1, 3),
  (4, 'Meeting Room D', 'meeting_room', 8, '#0066cc', 1, 4),
  (5, 'Meeting Room E', 'meeting_room', 8, '#8b5cf6', 1, 5),
  (6, 'Lounge', 'common_space', 80, '#7a7a7a', 0, 6),
  (7, 'Recharging Zone', 'common_space', 1, '#7a7a7a', 0, 7);

-- 관리자 계정 (password: admin1234 -> SHA256)
INSERT OR IGNORE INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color) VALUES
  ('WYLIE', 'admin@wylie.co.kr', 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270', '문병훈', '와일리_커버넌스', 'GA', '+82 10-1234-5678', 'admin', 'active', '#facc15'),
  ('LUSH', 'admin@lush.co.kr', 'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270', '강서진', '러쉬코리아_경영지원', 'Manager', '+82 10-2345-6789', 'admin', 'active', '#10b981');

-- 와일리 일반 멤버 (password: user1234 -> SHA256)
INSERT OR IGNORE INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color) VALUES
  ('WYLIE', 'hgpark@wylie.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '박호근', '와일리_신성장사업본부', 'GM', '+82 10-7795-7323', 'member', 'active', '#facc15'),
  ('WYLIE', 'djohn@wylie.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '오동주', '경영전략실', '그로스레드', '+82 10-9559-2984', 'member', 'active', '#f97316'),
  ('WYLIE', 'dnchoi@wylie.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '최다녀', '와일리_커버넌스', 'GA', '+82 10-9764-8987', 'member', 'active', '#10b981'),
  ('WYLIE', 'shlee3@wylie.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '이상호', '와일리_컨버전스1팀', 'GA', '+82 10-2375-1410', 'member', 'active', '#8b5cf6'),
  ('WYLIE', 'shpark4@wylie.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '박수정', '와일리_플랫폼운영', 'GA', '+82 10-3780-9608', 'member', 'active', '#ec4899');

-- 러쉬코리아 일반 멤버
INSERT OR IGNORE INTO users (tenant_id, email, password, name, department, position, phone, role, status, avatar_color) VALUES
  ('LUSH', 'branch@lush.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '봉서진', '러쉬코리아', '-', '+82 10-9168-7281', 'member', 'active', '#10b981'),
  ('LUSH', 'jpark@lush.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '박지수', '러쉬 마케팅', 'Lead', '+82 10-1234-1111', 'member', 'active', '#0066cc'),
  ('LUSH', 'ckim@lush.co.kr', '831c237928e6212bedaa4451a514ace3174562f6761f6a157a2fe5082b36e2fb', '김채영', '러쉬 영업', 'Senior', '+82 10-2222-3333', 'member', 'active', '#facc15');

-- 샘플 예약 데이터 (오늘 + 향후 일정)
INSERT OR IGNORE INTO reservations (tenant_id, user_id, space_id, title, date, start_time, end_time, created_by_admin, status) VALUES
  ('WYLIE', 1, 1, '[PPD] 유동원 컨설팅', date('now'), '10:40', '12:00', 1, 'confirmed'),
  ('WYLIE', 3, 4, '신규 사업 미팅', date('now'), '14:00', '15:30', 0, 'confirmed'),
  ('LUSH', 2, 2, '주간 정기회의', date('now'), '09:00', '10:00', 1, 'confirmed'),
  ('LUSH', 7, 6, '브랜드 컨퍼런스', date('now'), '13:00', '17:00', 0, 'confirmed'),
  ('WYLIE', 1, 5, '월간 전사 회의', date('now', '+1 day'), '15:00', '17:00', 1, 'confirmed'),
  ('WYLIE', 4, 3, '디자인 리뷰', date('now', '+1 day'), '11:00', '12:00', 0, 'confirmed'),
  ('LUSH', 7, 7, '리차징', date('now', '+2 day'), '14:00', '14:30', 0, 'confirmed');
