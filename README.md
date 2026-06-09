# 메이트리그라운드 (Mateground) — V4

WYLIE/LUSH 통합 예약 관리 플랫폼. Cloudflare Pages + Hono + D1(SQLite).

## 프로젝트 개요
- **목표**: 멀티 테넌트(WYLIE/LUSH) 회의실/공간 예약을 관리자가 직접 운영하는 사내 통합 플랫폼
- **주요 기능**: 공간 예약, 일/월 뷰 타임라인, 부서·직책 마스터, 멤버 관리, 인사이트 대시보드

## 접속 URL
- **로컬 개발**: http://localhost:3000
- **공개 URL**: (GetServiceUrl 결과 — 본 세션: https://3000-iylt8ni2z01kxtgymrr7e-02b9cc79.sandbox.novita.ai)
- **마스터 관리자**: `admin@wylie.co.kr` / `admin1234`

## V4 신규 기능 (현재 구현 완료)

### 1. 멤버/조직 (Master Data)
- **하드코딩 더미 멤버 5명 전면 제거** — 초기 상태는 `admin@wylie.co.kr` (마스터 관리자) 1명만 존재
- **전화번호 필드 전면 삭제** (API/UI/DB 모두)
- **'초대하기' → '생성하기'** 버튼 변경 (관리자가 직접 멤버 생성)
- **[부서/직책 관리] 신규 탭** — 좌(부서)/우(직책) Split View, 인라인 추가/수정/삭제
- 멤버 생성/수정 폼의 부서·직책 드롭다운이 위 마스터 데이터에서 동적 로드

### 2. 공간 CRUD
- 관리자 페이지에서 공간 추가/수정/삭제 (펜·휴지통 아이콘)
- 공간명 변경이 타임라인 헤더에 실시간 반영
- 공간 삭제 시 관련 예약 자동 취소 처리

### 3. 타임라인 UX
- **일간(Day) / 월간(Month) 뷰 토글** — 캘린더 그리드, 일요일/토요일 색상 구분, 오늘 강조
- **'내 일정' 필터** — 내가 만든 + 참석자 포함 예약만 표시
- **대시보드 → /spaces 라우팅** — 시간 클릭 시 해당 시간으로 스크롤 포커스
- **블록 리사이즈** — 종료 시간 모서리 드래그로 즉시 PATCH
- **더블클릭으로 시간 수정 모달** — 제목/날짜/시간/공간 직접 편집

### 4. 인사이트 (3탭 + Chart.js)
- **[개요]** — 평균 회의 시간, 총 예약 수, 가동 공간 비율, 인기 공간, 요일·시간 히트맵
- **[내역]** — 기간 내 예약 전체 로그 (날짜/시간/공간/제목/예약자/소속/상태)
- **[통계]** — Chart.js 도넛/막대 차트 4종 (노쇼·요일별·예약방식·수용인원별) + 공간별 사용량 막대 리스트
- **기간 프리셋**: 7 / 30 / 90 / 180 / 365일 / 사용자 지정
- **메트릭 스위치**: `예약 시간 누적` ↔ `일정 개수` (통계 탭)

### 5. 비즈니스 로직
- 1인당 동시 진행 중 회의실 예약 **3개 제한** 유지
- 관리자(`role=admin`) 우회 가능 (Admin Bypass)
- 마지막 admin 삭제 방지

## API 엔드포인트
- `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/logout`
- `GET /api/spaces` · `POST /api/spaces` · `PATCH /api/spaces/:id` · `DELETE /api/spaces/:id`
- `GET /api/reservations?date&space_id&mine=1` · `POST /api/reservations` · `PATCH /api/reservations/:id` · `DELETE /api/reservations/:id`
- `GET /api/members` · `POST /api/members` · `PATCH /api/members/:id` · `DELETE /api/members/:id` (관리자)
- `GET /api/org/departments` · `POST /api/org/departments` · `PATCH /api/org/departments/:id` · `DELETE /api/org/departments/:id`
- `GET /api/org/positions` · `POST /api/org/positions` · `PATCH /api/org/positions/:id` · `DELETE /api/org/positions/:id`
- `GET /api/insights/overview?range=7|30|90|180|365|custom[&start&end]`
- `GET /api/insights/history?range=...&tenant=mine`
- `GET /api/insights/stats?range=...&metric=count|time`

## 데이터 모델
- **tenants** (WYLIE / LUSH)
- **users** (tenant_id, email, password SHA-256, name, department, position, role, status, avatar_color)
  - V4: `phone` 컬럼 제거됨 (마이그레이션 0002에서 무시, API에서 미사용)
- **spaces** (tenant 공용, type, capacity, color, count_in_limit, display_order)
- **reservations** (tenant_id, user_id, space_id, date, start_time, end_time, title, attendees, recurring_rule_id, status, created_by_admin)
- **recurring_rules** (반복 예약 룰)
- **sessions** (token, user_id, expires_at)
- **departments** (tenant_id, name) — V4 신규
- **positions** (tenant_id, name) — V4 신규

## 사용 가이드 (관리자 워크플로우)
1. `/login`에서 `admin@wylie.co.kr` / `admin1234` 로그인
2. **[관리 → 부서/직책]** 에서 운영할 부서·직책을 먼저 등록
3. **[관리 → 멤버]** 에서 '생성하기'로 사용자 직접 생성 (부서/직책 드롭다운에서 선택)
4. **[관리 → 공간]** 에서 회의실/공용 공간 CRUD
5. **[공간]** 에서 일/월 뷰 전환, '내 일정' 필터, 빈 슬롯 클릭으로 예약 생성, 블록 드래그로 시간 수정
6. **[인사이트]** 에서 개요/내역/통계 탭으로 운영 데이터 확인

## 기술 스택
- **Backend**: Hono v4 (TypeScript), Cloudflare Workers, D1 (SQLite)
- **Frontend**: Vanilla JS SPA, dayjs (ko locale), Chart.js, Font Awesome, Inter font
- **Auth**: SHA-256 + 세션 토큰 (HttpOnly 쿠키)
- **Build**: Vite v6 + @hono/vite-cloudflare-pages
- **Process**: PM2 (wrangler pages dev --d1=webapp-production --local)

## 개발 명령
```bash
# 빌드
npm run build

# 로컬 실행 (PM2)
pm2 start ecosystem.config.cjs
pm2 restart webapp
pm2 logs webapp --nostream

# DB
npx wrangler d1 migrations apply webapp-production --local
npx wrangler d1 execute webapp-production --local --file=./seed.sql
npx wrangler d1 execute webapp-production --local --command="SELECT * FROM users"
```

## 배포
- **Platform**: Cloudflare Pages
- **Status**: 로컬 개발 환경 (배포 진행 시 별도 안내)
- **Last Updated**: 2026-06-09 (V4)
