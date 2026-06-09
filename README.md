# 메이트리그라운드 (Mateground) — V5

WYLIE/LUSH 통합 예약 관리 플랫폼. Cloudflare Pages + Hono + D1(SQLite).

## 프로젝트 개요
- **목표**: 멀티 테넌트(WYLIE/LUSH) 회의실/공간 예약을 관리자가 직접 운영하는 사내 통합 플랫폼
- **주요 기능**: 공간 예약, 일/월 뷰 타임라인, 부서·직책 마스터, 멤버 관리, 인사이트 대시보드, 테넌트별 공간 격리, 최초 로그인 비밀번호 강제 변경

## 접속 URL
- **로컬 개발**: http://localhost:3000
- **공개 URL**: https://3000-iylt8ni2z01kxtgymrr7e-02b9cc79.sandbox.novita.ai
- **WYLIE 관리자**: `admin@wylie.co.kr` / `admin1234`
- **LUSH 관리자**: `admin@lush.co.kr` / `admin1234` *(V5 신규)*

## 🆕 V5 신규 기능

### REQ-AUTH-01 — 테넌트별 공간 접근 권한 격리
- `spaces.tenant_scope` 컬럼 신설 (NULL=모두 공개 / `WYLIE` / `LUSH`)
- `GET /api/spaces`에서 다른 테넌트 전용 공간은 응답에서 제외
- `POST/PATCH /api/reservations`에서 다른 테넌트 전용 공간 예약 시도 시 **403 거부**
- **5층 회의실** (`id=8`, `tenant_scope='WYLIE'`) — LUSH 사용자에게는 보이지 않음
- 관리자 공간 모달에서 접근 권한 셀렉트박스 신설 ("모두 공개 / WYLIE 전용 / LUSH 전용")

### REQ-SEC-01 — 최초 로그인 시 비밀번호 강제 변경
- `users.is_first_login` (INTEGER, 기본 0) 컬럼 신설
- 관리자가 멤버를 생성하면 자동으로 `is_first_login=1` 부여 (POST /api/members)
- 신규 멤버 로그인 시 `/api/auth/me` 응답에 `is_first_login: 1` 포함
- 프론트 부팅 시 가드: `is_first_login=1`이면 **다른 모든 페이지 진입 차단** + 강제 변경 모달 전체화면 오버레이
- `POST /api/auth/change-password` — 본인 비번 변경 + 플래그 자동 해제
- 8자 미만은 400 거부

### REQ-BUG-01 — LUSH 관리자 무한 로딩 해결
- 시드에 `admin@lush.co.kr` 추가 → LUSH 테넌트로 정상 로그인 가능
- 인증 미들웨어는 이미 tenant 차별 없이 동작 (이중 확인)

### REQ-BUG-02 — 신규 공간 동적 표시 (검증)
- 타임라인은 이미 100% `GET /api/spaces` 응답 기반으로 동적 렌더링 (`State.spaces`)
- 신규 공간 추가 시 다음 폴링(3초)에 자동 반영

### REQ-STYL-01 — 모바일 반응형
- `.timeline-scroll` 가로 스크롤 (min-width 900px, `-webkit-overflow-scrolling: touch`)
- `@media (max-width: 768px)`에서 모달 `width: 92%` 강제
- 인사이트 필터바/탭 모바일 최적화

## V4 누적 기능 (요약)
- 하드코딩 더미 멤버 제거, 마스터 admin만 초기 잔존
- 전화번호 필드 제거, '초대하기' → '생성하기' UX
- [부서/직책 관리] 통합 split-view + 멤버 폼 드롭다운 동적 연동
- 공간 CRUD (펜·휴지통 아이콘 + 모달)
- 일/월간 뷰 토글 + '내 일정' 필터 + 대시보드→spaces 라우팅
- 블록 리사이즈 드래그 + 더블클릭 시간 수정 모달
- 인사이트 3탭 (개요/내역/통계) + 기간 프리셋 + 메트릭 스위치 + Chart.js
- 3-room 제한 + Admin Bypass

## API 엔드포인트
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| POST | `/api/auth/login` | 공개 | 로그인 |
| GET  | `/api/auth/me` | 인증 | 본인 정보 (`is_first_login` 포함) |
| POST | `/api/auth/logout` | 인증 | 로그아웃 |
| POST | `/api/auth/change-password` | 인증 | **V5** 본인 비밀번호 변경 (`is_first_login` 자동 해제) |
| GET  | `/api/spaces` | 인증 | **V5** tenant_scope 필터링된 공간 목록 |
| POST/PATCH/DELETE | `/api/spaces[/:id]` | 관리자 | 공간 CRUD (`tenant_scope` 지원) |
| GET  | `/api/reservations?date&space_id&mine=1` | 인증 | 예약 목록 (V4 mine 필터) |
| POST | `/api/reservations` | 인증 | **V5** 예약 생성 (tenant_scope 가드) |
| PATCH/DELETE | `/api/reservations/:id` | 인증/관리자 | 예약 수정/취소 |
| GET  | `/api/members` | 관리자 | 본인 회사 멤버 목록 |
| POST | `/api/members` | 관리자 | **V5** 멤버 생성 (`is_first_login=1` 자동 부여) |
| PATCH/DELETE | `/api/members/:id` | 관리자 | 멤버 수정/삭제 |
| GET/POST/PATCH/DELETE | `/api/org/departments[/:id]` | 인증/관리자 | 부서 CRUD |
| GET/POST/PATCH/DELETE | `/api/org/positions[/:id]` | 인증/관리자 | 직책 CRUD |
| GET | `/api/insights/{overview,history,stats}?range&metric` | 인증 | 인사이트 3종 |

## 데이터 모델
- **tenants** (WYLIE / LUSH)
- **users** (tenant_id, email, password SHA-256, name, department, position, role, status, avatar_color, **is_first_login** [V5])
- **spaces** (name, type, capacity, color, count_in_limit, display_order, **tenant_scope** [V5])
- **reservations** (tenant_id, user_id, space_id, date, start_time, end_time, title, attendees, recurring_rule_id, status, created_by_admin)
- **recurring_rules** / **sessions** / **departments** / **positions**

## 마이그레이션
- `0001_initial_schema.sql` — 기본 스키마
- `0002_v4_departments_positions.sql` — 부서/직책 마스터 테이블
- `0003_v5_tenant_scope_and_first_login.sql` — V5 컬럼 (`spaces.tenant_scope`, `users.is_first_login`)

## 사용 가이드 (관리자 워크플로우)
1. `/login`에서 `admin@wylie.co.kr` 또는 `admin@lush.co.kr` (둘 다 `admin1234`)로 로그인
2. **[관리 → 부서/직책]** 에서 운영할 부서·직책을 먼저 등록
3. **[관리 → 멤버]** 에서 '생성하기'로 사용자 직접 생성
   - 생성된 멤버는 최초 로그인 시 **비밀번호 강제 변경 모달**이 표시되며 변경 전까지 다른 페이지 진입 불가
4. **[관리 → 공간]** 에서 회의실/공용 공간 CRUD
   - **접근 권한** 셀렉트로 'WYLIE 전용 / LUSH 전용 / 모두 공개' 설정 가능 (5층 회의실 사례)
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

# DB 마이그레이션/시드
npx wrangler d1 migrations apply webapp-production --local
npx wrangler d1 execute webapp-production --local --file=./seed.sql

# DB 조회
npx wrangler d1 execute webapp-production --local --command="SELECT email, is_first_login FROM users"
npx wrangler d1 execute webapp-production --local --command="SELECT name, tenant_scope FROM spaces"
```

## 검증 결과 (V5 E2E)
| 시나리오 | 결과 |
|---|---|
| LUSH 관리자 로그인 (BUG-01) | ✅ 200 OK |
| LUSH 사용자의 spaces 응답에 5층 회의실 미포함 | ✅ 7개만 반환 |
| WYLIE 사용자의 spaces 응답에 5층 회의실 포함 | ✅ 8개 반환 |
| LUSH가 5층 회의실 예약 시도 | ✅ 403 차단 |
| WYLIE가 5층 회의실 예약 | ✅ 200 OK |
| 신규 멤버 생성 시 `is_first_login=1` | ✅ |
| 짧은 비번 (<8자) 변경 시도 | ✅ 400 거부 |
| 정상 비번 변경 → `is_first_login=0` 자동 전환 | ✅ |
| 옛 비번 로그인 시도 | ✅ 401 차단 |
| 신규 비번 로그인 | ✅ 200 OK |
| 강제 변경 모달이 다른 페이지 진입 차단 | ✅ Playwright 확인 |

## 배포
- **Platform**: Cloudflare Pages
- **Status**: 로컬 개발 환경
- **Last Updated**: 2026-06-09 (V5)
