# 메이트리그라운드 (Mateground) — V7

WYLIE/LUSH 통합 예약 관리 플랫폼. Cloudflare Pages + Hono + D1(SQLite).

## 프로젝트 개요
- **목표**: 멀티 테넌트(WYLIE/LUSH) 회의실/공간 예약을 관리자가 직접 운영하는 사내 통합 플랫폼
- **주요 기능**: 공간 예약, 일/월 뷰 타임라인, 부서·직책 마스터, 멤버 관리(엑셀 일괄 등록), 인사이트 대시보드, 테넌트별 공간 격리, 최초 로그인 비밀번호 강제 변경, 모바일 반응형 UI (V7 모바일 UX 전면 고도화)

## 🆕 V7 신규 기능 (모바일 UX 전면 고도화)

### V7-1 — 상단 헤더 양 끝 정렬 (좌 로고 / 우 아바타+이름+햄버거)
- 모바일(≤768px) `.global-nav-inner`에 `justify-content: space-between` 적용
- 왼쪽: `.nav-brand` (로고 + "메이트리그라운드", 50vw 최대치, 잘림 방지)
- 오른쪽: `.nav-actions`에 `margin-left: auto`로 우측 끝 밀착
- **사용자 이름 텍스트 신설** (`.nav-user-name`) — 데스크톱에서는 숨김, 모바일에서만 노출 (최대 90px 말줄임)
- 우측 정렬 순서: `이름 → 아바타(28px) → 햄버거 버튼`

### V7-2 — 관리 페이지 모바일 가로 탭 바
- 모바일에서 `.admin-layout`을 `grid-template-columns: 1fr` 로 강제 (세로 분할 해제)
- `.admin-side-nav`를 `display: flex; flex-direction: row; overflow-x: auto; white-space: nowrap`로 가로 한 줄 배치
- `-webkit-overflow-scrolling: touch` + 4px 가로 스크롤바 → 부드러운 터치 스와이프
- 각 탭은 `border-radius: 999px` 알약형 + 활성 탭만 진한 배경(`var(--ink)`)으로 강조
- "메이트리그라운드" side-label은 모바일에서 숨김

### V7-3 — 멤버 테이블/모달/드롭존 모바일 가변 폭 + 카드 UI 전환
- **모달**: `.modal`이 `width: 92%; max-width: 100%`로 가변. 인라인 `max-width: 640px/560px`도 미디어 쿼리로 덮어쓰기
- **모달 푸터**: 모바일에서 버튼 `flex-direction: column`으로 세로 배치 + `width: 100%`
- **드롭존**: `.bulk-dropzone`이 `width: 100%`로 부모 폭에 맞춰 가변
- **멤버 리스트 카드화**: `buildMemberTable()`이 데스크톱 `<table.member-table-desktop>` + 모바일 `<div.member-cards-mobile>` 듀얼 렌더링
  - 데스크톱: 기존 테이블 그대로
  - 모바일: 카드 한 장에 `[아바타+이름+이메일+역할 뱃지] → [부서/직책/상태] → [수정/삭제 액션]` 세로 정렬
  - 가로 스크롤 완전 제거
- **검색**: `filterMemberTable()`이 양쪽(테이블 tr + 카드)을 동시에 필터링 (`data-search` 속성 활용)

### V7-4 — 관리 메뉴 sticky/fixed 모바일 전면 해제
- 기존 `.admin-side-nav { position: sticky; top: 116px }`이 모바일에서 본문을 가리는 문제
- 모바일 미디어 쿼리에서 `.admin-side-nav`에 `position: relative !important; top: auto !important` 강제
- 안전망: `.sub-nav`도 모바일에서 `position: relative !important`로 해제
- 사용자가 페이지를 스크롤하면 관리 탭 바가 자연스럽게 본문과 함께 위로 사라짐

## 접속 URL
- **로컬 개발**: http://localhost:3000
- **공개 URL**: https://3000-iylt8ni2z01kxtgymrr7e-02b9cc79.sandbox.novita.ai
- **WYLIE 관리자**: `admin@wylie.co.kr` / `admin1234`
- **LUSH 관리자**: `admin@lush.co.kr` / `admin1234`

## V6 누적 기능 (요약)

### V6-1 — 캘린더 레이아웃 동적 컬럼 + 5층 회의실 통합
- **문제**: 공간이 7개를 넘으면(예: WYLIE의 8번째 '5층 회의실') CSS 그리드가 `repeat(7, 1fr)` 하드코딩으로 인해 컬럼이 왼쪽 구석에 세로로 깨져 잘려 나옴
- **해결**:
  - `buildTimelineGrid()`에서 `State.spaces.length`에 따라 `grid-template-columns`을 동적으로 인라인 설정 — 데스크톱(≥1280px)은 `repeat(N, minmax(0, 1fr))`, 좁은 화면은 `repeat(N, minmax(130px, 1fr))` + `min-width` 계산값
  - `styles.css`의 `.timeline-grid` fallback은 `auto-fit minmax(130px, 1fr)`로 변경 (하드 7-column 제거)
  - 반응형 `@media (max-width: 1024px)`의 7-column 규칙도 제거 → 항상 JS의 spaces 개수 기반 동적 컬럼 적용
- **LUSH 격리** (V5에서 이미 구현된 백엔드 필터 재검증):
  - LUSH 로그인 시 `/api/spaces` 응답에 5층 회의실(id=8) 미포함 ✅
  - LUSH는 대신 자체 'LUSH 전용 파라다이스룸'(id=9) 노출 → 양쪽 모두 8 컬럼이지만 V6-1 동적 컬럼으로 균일하게 표시

### V6-2 — 모바일 햄버거 메뉴 + 필터 수직 재배치
- **상단 네비게이션 햄버거**:
  - 데스크톱: 기존 가로 nav-links 유지
  - 모바일(≤768px): nav-links 숨김 + `.nav-hamburger` 노출 → 클릭 시 우측에서 슬라이드인 드로어 (`.mobile-nav-overlay` + `.mobile-nav-drawer`)
  - 드로어 구성: 로고/닫기 → 사용자 프로필(아바타+이름+소속) → 메뉴(홈/공간/인사이트/관리) → 로그아웃 버튼
  - 애니메이션: 220ms cubic-bezier transform translate + 백드롭 페이드, ESC/오버레이 클릭/메뉴 선택 시 자동 닫힘
- **공간 페이지 툴바 2단 분리**:
  - 1단(`.tt-row-date`): 날짜 표시 + 이전/오늘/다음/날짜점프
  - 2단(`.tt-row-filters`): 일간/월간/내 일정 + 회사 범례(와일리/러쉬코리아)
  - 모바일에서는 2단의 `flex-direction: column`으로 수직 배치 + 일간/월간/내 일정 버튼이 `flex: 1`로 균등 분할

### V6-3 — 멤버 일괄 생성 엑셀 업로드
- **SheetJS** (`xlsx@0.18.5`) CDN을 `shell.tsx`에 추가 → 모든 페이지에서 `XLSX` 전역 사용 가능
- 멤버 생성 모달의 [일괄 생성] 탭 상단에 **드래그앤드롭 영역** (`.bulk-dropzone`) 추가
  - 영역 클릭으로 파일 선택 다이얼로그 호출
  - 파일 드롭 시 `dragover/dragleave/drop` 이벤트로 시각 피드백 (테두리·배경색 변화)
- **자동 컬럼 매핑** — 한글/영문 alias 자동 인식:
  - `name`: 이름, 성명, 사용자명, name, Name, 담당자, 담당자명 …
  - `email`: 이메일, 이메일주소, 메일, email, e-mail, 계정, 아이디 …
  - `department`: 부서, 소속, 팀, 본부, department, dept, 소속부서 …
  - `position`: 직책, 직급, 직위, 포지션, position, title …
- 파싱 후 `state.bulkRows` 자동 치환 → 미리보기 테이블로 즉시 표시 → 검토 후 [생성하기] 클릭 → `POST /api/members/bulk`
- 마스터에 없는 부서/직책도 보존 (드롭다운에 `(미등록)` 라벨로 추가됨)
- 지원 형식: `.xlsx`, `.xls`, `.csv`

### V6-4 — 홈 → 공간 클릭 정확 이동 + 호버/Ripple
- **버그 원인**: 기존 코드는 `State.date = date; location.href = '/spaces'`로 이동했으나 전체 페이지 리로드 시 `State`가 `date: todayISO()`로 재초기화되어 항상 오늘로 표시됨
- **수정**: `goToSpace()`에서 `sessionStorage.setItem('jumpDate', date)` 저장 후 이동 → `State` 초기화 시점에 `sessionStorage`의 `jumpDate`를 읽어 우선 적용 → `renderSpaces()` 진입 시 한 번 더 읽고 소비(`removeItem`)
- 6월 20일 카드 클릭 → `/spaces`에서 정확히 **2026년 6월 20일** 타임라인 표시 (오늘이 아님)
- 추가로 클릭 시 자동으로 `State.view = 'day'`(일간 뷰)로 전환
- **호버/Ripple 인터랙션** (`.upcoming-row.is-clickable`, `.upcoming-day-label.is-clickable`):
  - `cursor: pointer`
  - 호버: 연한 파랑 배경(`rgba(0,102,204,0.05)`) + 부드러운 음영(`0 2px 10px rgba(0,0,0,0.06)`)
  - 클릭(:active): `transform: scale(0.995)` 미세 압축
  - **Ripple**: `::after` 가상요소 + `radial-gradient` + `background-size` 트랜지션 (1500% 확장)으로 잔물결 효과

## V5 누적 기능 (요약)
- **REQ-AUTH-01**: `spaces.tenant_scope` 컬럼으로 테넌트별 공간 접근 격리 + 예약 가드(403)
- **REQ-SEC-01**: `users.is_first_login` 플래그 + `/api/auth/change-password` + 부팅 가드 모달
- **REQ-BUG-01**: `admin@lush.co.kr` 시드 추가 → LUSH 로그인 정상화
- **REQ-BUG-02**: 신규 공간 동적 표시 (이미 동적이었음 검증)
- **REQ-STYL-01**: 모바일 timeline-scroll + 모달 92%

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
| POST | `/api/auth/change-password` | 인증 | 본인 비밀번호 변경 (`is_first_login` 자동 해제) |
| GET  | `/api/spaces` | 인증 | tenant_scope 필터링된 공간 목록 |
| POST/PATCH/DELETE | `/api/spaces[/:id]` | 관리자 | 공간 CRUD (`tenant_scope` 지원) |
| GET  | `/api/reservations?date&space_id&mine=1` | 인증 | 예약 목록 |
| GET  | `/api/reservations/upcoming` | 인증 | 앞으로의 일정 (홈 화면) |
| POST | `/api/reservations` | 인증 | 예약 생성 (tenant_scope 가드) |
| PATCH/DELETE | `/api/reservations/:id` | 인증/관리자 | 예약 수정/취소 |
| GET  | `/api/members` | 관리자 | 본인 회사 멤버 목록 |
| POST | `/api/members` | 관리자 | 멤버 생성 (`is_first_login=1` 자동 부여) |
| POST | `/api/members/bulk` | 관리자 | **V6** 엑셀 파싱 후 일괄 생성 (배열 입력) |
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
- *V6는 스키마 변경 없음 — 프론트엔드/UX 개선만 적용*

## 사용 가이드 (관리자 워크플로우)
1. `/login`에서 `admin@wylie.co.kr` 또는 `admin@lush.co.kr` (둘 다 `admin1234`)로 로그인
2. **[관리 → 부서/직책]** 에서 운영할 부서·직책을 먼저 등록
3. **[관리 → 멤버]** 에서 '생성하기' 클릭
   - **[개별 생성]** 탭: 한 명씩 폼 입력
   - **[일괄 생성]** 탭: 엑셀(.xlsx) / CSV 파일 **드래그 앤 드롭** → 자동 파싱 → 검토 → 일괄 생성 *(V6 신규)*
   - 생성된 멤버는 최초 로그인 시 **비밀번호 강제 변경 모달**이 표시되며 변경 전까지 다른 페이지 진입 불가
4. **[관리 → 공간]** 에서 회의실/공용 공간 CRUD
   - **접근 권한** 셀렉트로 'WYLIE 전용 / LUSH 전용 / 모두 공개' 설정 가능 (5층 회의실 사례)
5. **[공간]** 에서 일/월 뷰 전환, '내 일정' 필터, 빈 슬롯 클릭으로 예약 생성, 블록 드래그로 시간 수정
6. **[홈]** 의 '앞으로의 일정' 카드 클릭 → 해당 날짜의 공간 타임라인으로 정확히 이동 *(V6 수정)*
7. **모바일 접속** 시 우측 햄버거 메뉴로 모든 네비게이션 접근 가능 *(V6 신규)*

## 기술 스택
- **Backend**: Hono v4 (TypeScript), Cloudflare Workers, D1 (SQLite)
- **Frontend**: Vanilla JS SPA, dayjs (ko locale), Chart.js, **SheetJS(xlsx@0.18.5) [V6]**, Font Awesome, Inter font
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

## 검증 결과 (V7 E2E)
| 시나리오 | 결과 |
|---|---|
| **V7-1** `.nav-user-name` 신설, 모바일 미디어 쿼리에서 `display: inline-block` | ✅ |
| **V7-1** 모바일 `.global-nav-inner { justify-content: space-between }` | ✅ |
| **V7-2** 모바일 `.admin-side-nav { display: flex; flex-direction: row; overflow-x: auto }` | ✅ |
| **V7-2** 알약형 탭(`border-radius: 999px`) + 활성 탭 진한 배경 | ✅ |
| **V7-3** 모바일 `.modal { width: 92%; max-width: 100% }` + 푸터 세로 버튼 | ✅ |
| **V7-3** 멤버 테이블 듀얼 렌더링 (`.member-table-desktop` + `.member-cards-mobile`) | ✅ |
| **V7-3** `filterMemberTable()`이 카드/테이블 양쪽 필터 (`data-search` 속성) | ✅ |
| **V7-4** 모바일 `.admin-side-nav { position: relative !important; top: auto !important }` | ✅ |
| **V7-4** 안전망: `.sub-nav`도 모바일에서 sticky 해제 | ✅ |
| Playwright /admin/members, /admin/spaces, /admin/org, /admin/general 콘솔 에러 0건 | ✅ 4페이지 모두 |
| 서빙되는 app.js에 V7 식별자 12회 / styles.css에 21회 포함 | ✅ |

## 검증 결과 (V6 E2E — 회귀 OK)
| 시나리오 | 결과 |
|---|---|
| WYLIE / spaces 응답 = 8개 (5층 회의실 포함) | ✅ |
| LUSH / spaces 응답에 5층 회의실 미포함 | ✅ |
| SheetJS(xlsx@0.18.5) CDN 로드 | ✅ |
| `jumpDate` sessionStorage 라우팅 패턴 동작 | ✅ |
| Playwright /home, /spaces, /insights, /admin/members 콘솔 에러 0건 | ✅ |

## 배포
- **Platform**: Cloudflare Pages
- **Status**: 로컬 개발 환경 (PM2 + wrangler pages dev)
- **Tech Stack**: Hono + TypeScript + Vanilla JS SPA + D1 + Tailwind(인라인 CSS 변수) + Font Awesome
- **Last Updated**: 2026-06-10 (V7)
