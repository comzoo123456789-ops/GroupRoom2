# 메이트리그라운드 (Mateground) — V7 완결본

WYLIE/LUSH 통합 예약 관리 플랫폼. Cloudflare Pages + Hono + D1(SQLite).

## 프로젝트 개요
- **목표**: 멀티 테넌트(WYLIE/LUSH) 회의실/공간 예약을 관리자가 직접 운영하는 사내 통합 플랫폼
- **주요 기능**: 공간 예약(반복/일괄 수정), 일/월 뷰 타임라인, 부서·직책 마스터, 멤버 관리(엑셀 일괄 등록), 인사이트 대시보드, 테넌트별 공간 격리, 최초 로그인 비밀번호 강제 변경, 모바일 반응형 UI(V7 통합본 — 카드 UI 전환, sticky 해제, 반복 예약 분기 모달)

## 🆕 V8 패치 1 (최신 — GNB 가독성 + 사이드바 인디케이터 + 원클릭 모달)

V8 리브랜딩 직후 발견된 가독성/UX 이슈 4건을 정밀 보정. 기존 데이터(멤버 205명·공간 8개) 및 모든 이벤트 핸들러 100% 보존.

### §1 — GNB 헤더 텍스트 진한 화이트 강제 (가독성 불능 오류 해결)
- **문제**: 헤더가 `#0f2647` Deep Sapphire로 어두워지면서 기존 어두운 텍스트 색이 묻혀 [메이트리그라운드/홈/공간/인사이트/관리] 메뉴가 거의 보이지 않음
- **해결**: 헤더 영역 전체 텍스트를 `#ffffff !important` + `opacity: 1` + `font-weight: 600` 강제
  - `.nav-brand`, `.nav-brand *`, `.nav-user-name`, `.nav-link` 일괄 적용
  - hover 시에도 색 변화 없이 `rgba(255,255,255,0.10)` 배경만 변동 → 텍스트 가독성 유지
  - 활성 탭(`.is-active`)은 라벤더 배지(#dfe7f7) 위에 딥 네이비(#0f2647) 텍스트로 고대비 확보
  - 브랜드 바 아이콘 3개도 흰색 통일 (3번째만 라벤더 톤 포인트)

### §2 — 관리자 사이드바 active 탭 투명화 (네이비 블록 제거)
- **문제**: 좌측 메뉴([일반]/[멤버]/[부서·직책]/[공간]) 클릭 시 `background: var(--ink)` 즉 `#0f1c2e` 차콜 단색 블록이 메뉴를 통째로 덮어 글자 가독성 저하 + 미니멀 인상 훼손
- **해결**: 진한 단색 배경을 완전 투명으로 리셋하고 좌측 3px 라인 인디케이터로 대체
  - `.admin-side-link.is-active { background: transparent; color: #1a365d; font-weight: 700; border-left: 3px solid #1a365d; border-radius: 0 }`
  - 비활성 상태도 `border-left: 3px solid transparent`로 폭 유지 → 클릭 시 글자 점프 방지
  - hover는 라벤더 틴트(`#f4f7fc`) + 라벤더 라인 → 자연스러운 단계감
  - 모바일(≤768px): 가로 스크롤 사이드바에서는 `border-bottom: 3px solid #1a365d`로 인디케이터 방향 전환

### §3 — 타임라인 일정 슬롯 더블클릭 → 원클릭 단일 트리거 (app.js)
- **문제**: 기존 예약 블록(`.timeline-event`) 클릭 시 모달이 안 뜨고 더블클릭해야 진입 — 모바일 터치 UX에 부적합
- **해결**: `public/static/app.js` line 787에서 트리거 교체 (단 한 줄 수정)
  ```js
  // AS-IS
  onclick: (e) => { e.stopPropagation(); /* 빈 핸들러 */ },
  ondblclick: (e) => { e.stopPropagation(); openReservationDetail(r); },
  // TO-BE
  onclick: (e) => { e.stopPropagation(); openReservationDetail(r); },
  ```
- **드래그 호환성**: 새 예약 생성은 빈 셀 드래그(`onDragUp` → `openReservationModal`)로 분리되어 있어 클릭 트리거와 충돌 0
- **결과**: 모든 디바이스에서 일정 블록 1번 탭/클릭으로 즉시 상세 모달 진입

### §4 — 곡률·그림자 미니멀 규격 유지 검증
- `*` 셀렉터에 `box-shadow: none !important` 전역 강제 (V8 본편에서 기적용)
- `border-radius` 모든 컴포넌트 2~4px 직각 (원형 아바타·점은 화이트리스트로 50% 유지)
- V8 패치 1 추가분에서도 사이드바 active를 `border-radius: 0`(완전 직선)으로 강조하여 일관성 유지

### ✅ 보존 검증
- `dist/_worker.js` 빌드 사이즈: **85.52 kB** (V8 본편 대비 동일 — JS는 단 한 줄만 수정, 모듈 구조 무변경)
- Playwright `/login` 콘솔 메시지: **0건**
- `dblclick` 잔존 검사: `grep -c "dblclick" public/static/app.js` → **0**
- 멤버 205명 · 공간 8개 · 모든 예약 일정 · M:N 참석자 데이터 무변경

---

## V8 비주얼 리브랜딩 (직전 — Deep Sapphire Minimal)

기능/이벤트 핸들러는 **단 한 줄도 건드리지 않은 채** `public/static/styles.css` 끝에 ~530줄의 테마 오버레이 레이어를 추가하여 시각 아이덴티티를 전면 차별화.

### 🎨 디자인 토큰 재정의
| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 시그니처 컬러 | Action Blue `#0066cc` | **Deep Sapphire `#1a365d`** |
| 베이스 캔버스 | 회백색 `#f5f5f7` | **Lavender Mist `#f4f7fc` / 액센트 `#dfe7f7`** |
| 잉크 텍스트 | `#1d1d1f` | **Charcoal Ink `#0f1c2e`** (네이비 톤) |
| Border Radius | 5~18px (둥근 볼륨감) | **2~4px 직각 미니멀** (`*` 셀렉터 강제) |
| Box Shadow | `0 4px 24px` 입체 | **전면 제거** → 1px 헤어라인 보더 |

### 🧩 21개 컴포넌트 영역 일괄 개편
1. 전역 보호막(`* { box-shadow: none; border-radius: 4px; }` + 원형 화이트리스트)
2. 베이스 캔버스(라벤더 미스트)
3. 글로벌 네비(Deep Sapphire 헤더, 화이트 텍스트, 라벤더 액티브)
4. 카드/패널(1px 헤어라인 + 호버 시 네이비 보더)
5. 버튼(primary/secondary/ghost 3종 — 4px 직각, 단색 액센트)
6. 입력폼(포커스 시 라벤더 링 `0 0 0 2px #dfe7f7`)
7. 모달(차콜 네이비 백드롭, 푸터 라벤더 톤)
8. 타임라인(네이비 액티브 바, 라벤더 호버)
9. 홈 hero / 미니 캘린더(라벤더 배경 + 네이비 헤더)
10. 앞으로의 일정 행(헤어라인 디바이더, 호버 라벤더)
11. 역할/상태 배지(8개 변형 — owner/attendee/pending/accepted/declined 등)
12. 참석자 태그/드롭다운
13. 초대함 카드(좌측 3px 네이비 인디케이터)
14. 디테일 모달(예약자 영역 라벤더 배경 + 좌측 인디케이터로 시각 분리)
15. 테이블(라벤더 헤더, 헤어라인 로우)
16. 탭/세그먼티드 컨트롤(언더라인 only)
17. 토스트(차콜 네이비 단색)
18. 스크롤바(라벤더 톤)
19. 링크/포커스 가시화
20. 모바일(≤768px) 추가 밀도 압축
21. 그라데이션·블러 일괄 제거(시각적 복제 인상 차단)

### ✅ 기능 보존 검증
- 빌드: `dist/_worker.js 85.52 kB` (직전 커밋과 **byte 단위 동일** — JS 무변경 증명)
- Playwright `/login` 로드: **콘솔 메시지 0건**
- 모든 이벤트 리스너(click/submit/change), DOM 핸들러, 모달·드래그·자동완성 로직 **무변경**
- 신규 스타일은 모두 `!important` + 후행 정의로 기존 규칙을 안전하게 덮어쓰는 오버라이드 패턴

---

## V7 고도화 최종 (직전 — M:N 참석자 시스템 + 초대 수락/거절)

회의 예약을 **예약자 1명 → 참석자 N명** 구조로 확장. 초대받은 참석자가 수락하면 본인의 캘린더(`/upcoming`, 공간 타임라인)에 실시간으로 자동 연동됩니다.

### §1 — DB: `reservation_attendees` M:N 매핑 테이블 신설
- **마이그레이션**: `migrations/0004_v7_reservation_attendees.sql`
- **스키마**:
  ```sql
  CREATE TABLE reservation_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING','ACCEPTED','DECLINED')),
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (reservation_id, member_id)
  );
  CREATE INDEX idx_resv_attendees_member ON reservation_attendees (member_id, status);
  CREATE INDEX idx_resv_attendees_reservation ON reservation_attendees (reservation_id);
  ```

### §2 — 백엔드 API (총 6개 엔드포인트)
| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/reservations` | **확장**: 본문에 `attendee_ids: number[]` 수신 → 예약 INSERT 후 `c.env.DB.batch()`로 PENDING 행 일괄 삽입(자기 자신·중복 자동 제외). 응답에 `invited` 카운트 추가 |
| `GET` | `/api/reservations` | **확장**: `attendees_count` / `accepted_count` 서브쿼리 컬럼 추가. `?mine=1` 필터가 `owner OR EXISTS(attendee ACCEPTED)`로 확장 |
| `GET` | `/api/reservations/upcoming` | **확장**: `my_role` CASE 컬럼(`OWNER`/`ATTENDEE`) + 같은 OR 필터 적용 → 수락한 초대 일정이 본인 캘린더에 즉시 노출 |
| `GET` | `/api/reservations/invitations` | **신규**: 현재 사용자의 PENDING 초대 목록만 반환(주최자/공간/시간 조인 포함) |
| `GET` | `/api/reservations/:id` | **신규**: 상세(`{reservation, attendees[], my_role, my_invitation_status}`) — 모달용 |
| `POST` | `/api/reservations/:id/respond` | **신규**: `{action: 'ACCEPT'\|'DECLINE'}` → `status` + `responded_at` 갱신 |

추가로 `GET /api/members/search`를 자동완성용으로 강화:
- 빈 쿼리(`q=`) 허용 → 상위 N건 반환
- LIKE 대상 확장: `name + department + position`
- 자기 자신(`id != ?`) 자동 제외, `?limit=` 쿼리 파라미터 지원

### §3 — 프론트엔드 UI 3개 영역

**(a) 예약 등록 모달 — 참석자 멀티 셀렉트**
- `buildAttendeesSection()` + 10개 헬퍼 함수(autocomplete, debounce 150ms, outside-click 닫기)
- 입력창에 이름/부서/직책 일부 → 드롭다운 아바타+이름+소속 표기
- 선택 시 `[● 이름 ×]` 태그 형태로 누적, X 버튼으로 개별 제거
- 제출 시 `attendee_ids: [...]`로 함께 전송, 토스트에 `초대 N명` 표시

**(b) 예약 상세 모달 — 예약자/참석자 명확 분리**
- 상단 `.detail-owner-row`: 예약자(주최자) 아바타 + 이름 + 테넌트
- 그 아래 `.detail-attendees-list`: 참석자 1명당 한 행으로 아바타+이름+부서/직책 + 상태 배지
  - 상태 배지 컬러: PENDING(앰버), ACCEPTED(그린), DECLINED(레드)
- 본인이 PENDING 초대자인 경우 `.invite-action-banner`에 **[수락] [거절]** 버튼 표시
  - 클릭 → `respondInvitation()` → 토스트 + 홈/타임라인 자동 새로고침

**(c) 홈 — 초대함 + 일정 카드 역할 배지**
- `renderHome`에서 `Promise.all([/upcoming, /invitations])` 병렬 호출
- 초대 PENDING ≥ 1건이면 hero 아래 `.invites-section` 노출 (배지에 카운트)
- `.invite-card`마다 주최자 정보 + 시간/장소 + **[수락][거절][상세]** 버튼
- '앞으로의 일정' 각 행에 `role-badge.is-owner(주최)` / `is-attendee(참석)` 표기
- 직전 패치의 `white-space: nowrap` 시간 룰을 참석 일정에도 동일 적용

### §4 — E2E 검증 결과 (관리자 ↔ 강남욱 시나리오, 모두 ✅)
1. 관리자 로그인 → `POST /api/reservations`에 `attendee_ids: [48, 203]` → `{ok:true, ids:[84], invited:2}`
2. DB `reservation_attendees`: 2행 PENDING 정상 생성
3. 강남욱(id=48) 로그인 → `GET /invitations` → 예약 84 PENDING 노출
4. `POST /84/respond {action:'ACCEPT'}` → `status:'ACCEPTED'`, `responded_at` 기록
5. `GET /upcoming` → 예약 84가 `my_role:'ATTENDEE'`, `attendees_count:2`로 즉시 등장 — **실시간 캘린더 연동 작동**
6. `GET /84` → `attendees[]`에 강남욱(ACCEPTED) + 강다현(PENDING) 동시 반환
7. 테스트 데이터 정리 완료

---

## V7 완결본 후속 패치 (직전 — 헤더 롤백 + 홈 일정 한 줄)

### §1 — 헤더 메뉴 버튼 스타일 원상복구 (ROLLBACK)
- **문제**: 직전 라운드에 `.nav-link / .nav-avatar / .nav-brand` 자체에 `#dfe7f7` 라벤더 블루를 강제 적용해 다크 글로벌 네비 위 메뉴 버튼이 본래 디자인 톤을 잃었음
- **해결**: 개별 메뉴 버튼의 자체 색만 정확히 복원
  - `.nav-link { background: transparent !important; }`, hover `rgba(255,255,255,0.05)`, active `rgba(255,255,255,0.1)` — 오리지널 그대로
  - `.nav-avatar` 28×28 / `.nav-user-name` 흰색 88% / `.nav-brand` 14px 600 — 오리지널 복원
- **유지 항목**: Pretendard 전역 서체(`html/body/...`)는 그대로 유지 — 글로벌 룰이라 헤더 자체 색과 충돌 없음
- **검증**: 서빙되는 styles.css에 `background-color: #dfe7f7` 강제 룰 **0건**

### §2 — 홈 '앞으로의 일정' 시간/제목 레이아웃 최적화
- **문제**: `02:00 - 08:00` 시간대가 좁은 폭에서 `02:00 -` / `08:00`으로 두 줄로 꺾이며 가독성 저하
- **해결**:
  - 전 해상도 공통 `.upcoming-row .time { white-space: nowrap !important; font-variant-numeric: tabular-nums; flex-shrink: 0; }` — 시간 꺾임 절대 방지
  - 모바일(≤768px): `.upcoming-row { display: flex; flex-direction: column }` — 시간(13px) 한 줄 → 제목(15px·500) 한 줄 위·아래 스택
  - `word-break: break-word` 사용 (`break-all`은 한글 한 자씩 끊겨 가독성 ↓)
- **결과**: 어떤 폭에서도 시간이 한 줄로 곧게 연결, 제목이 그 아래 줄로 자연스럽게 안착

---

## V7 완결본 (직전 — 캘린더·공간헤더·서체)

### §1 — 홈 배너 'JUL 17' 고정 캘린더 아이콘 → 동적 미니 캘린더 위젯
- **문제**: 홈 화면 hero 영역의 `📅` 이모지가 OS에 따라 'JUL 17'이 박힌 모양으로 렌더되어 6월 10일에도 'JUL 17'로 표시
- **해결**: 이모지 자체를 제거하고 `dayjs().format('M월') / format('D')` 데이터로 동적 캘린더 위젯 생성
- **마크업**: `.home-cal-badge > .cal-badge-month(상단 빨간 헤더) + .cal-badge-day(중앙 큰 숫자)`
- **결과**: 시스템 날짜에 따라 실시간 갱신 (예: "6월 / 10")

### §2 — 모바일 공간 타임라인 헤더 'Meeting Room A/B/C' 두 줄 분리
- **문제**: 모바일(≤768px)에서 "Meeting Room A" 헤더의 알파벳 식별자가 ellipsis로 잘려 사용자가 어느 룸인지 식별 불가
- **해결**: 공간명을 마지막 공백 기준으로 **prefix(Meeting Room) + suffix(A)** 두 토큰으로 분할 렌더
  - 데스크톱: 한 줄로 `prefix suffix` 표기
  - 모바일: 줄1=prefix(11px·회색·축소), 줄2=suffix(14px·진한 네이비·bold)
- **영문 표기 유지**: `Lounge`, `Recharging Zone`, `Meeting Room A~E` 등 백엔드 DB의 영문을 100% 그대로 사용 (한글화 금지 규정 준수)
- **단일 토큰 케이스**(`Lounge`, `5층 회의실`)는 suffix만 강조 표시

### §3 — 헤더 네비 Pretendard 전역 서체 + 라벤더 블루(#dfe7f7) 배경
- **Pretendard 전역 적용**: `pretendardvariable-dynamic-subset.min.css` CDN 로드 + `:root --font-pretendard` 변수로 `html/body/button/input/select/textarea`에 강제 바인딩
- **메뉴 컴포넌트 배경**: `.global-nav .nav-links .nav-link { background-color: #dfe7f7 }` — 활성 탭은 `#b9c9eb`, hover는 `#cfdaf0`
- **텍스트/아이콘 색상은 변경 금지**: 다크 톤 그대로 유지하여 고대비 확보 (요구사항 명시)
- **폰트 스펙**: `font-size: 15px / font-weight: 600 / letter-spacing: -0.02em` — 자간 좁혀 시인성↑
- **아바타**: 36×36 / 13px / 700 — 살짝 확대 + 굵게

---

## V7 최종본 (직전 라운드 — 모달·드롭다운 마감)

### §1 — 공간 타임라인 PC 레이아웃 + 자동 정렬 알고리즘
- **`white-space: nowrap` + `min-width 160px(데스크톱) / 130px(모바일)`** — 공간명 한 줄 출력 보장
- **백엔드 자동 정렬**(`src/api/spaces.ts`):
  - `PRIMARY_ORDER = ['Meeting Room A', 'B', 'C', 'D', 'E']` — 알파벳 순 전면 배치
  - `PINNED_TAIL = ['Lounge', 'Recharging Zone']` — 항상 맨 우측 고정
  - 신규 룸(예: `5층 회의실`)은 PRIMARY와 PINNED_TAIL 사이에 자동 삽입
- **검증(WYLIE)**: `Meeting Room A → B → C → D → E → 5층 회의실 → Lounge → Recharging Zone` ✅

### §2 — 아바타 클릭 즉시 로그아웃 버그 수정 → 드롭다운 메뉴
- `onclick: handleLogout` 직접 바인딩 제거 → `toggleUserDropdown()`로 컨텍스트 메뉴 노출
- 메뉴 구성: **내 정보 · 비밀번호 변경 · 로그아웃** (3 항목)
- 외부 클릭 시 자동 닫힘: `document.addEventListener('click', onceCloseUserDropdown, { once: true })`
- 신규 함수: `toggleUserDropdown / closeUserDropdown / onceCloseUserDropdown / openMyPageModal / openChangePasswordModal`

### §3 — 멤버 등록 모달 전면 개편
- **백드롭 클릭 닫힘 비활성화** — 실수로 닫는 사고 방지
- **비밀번호 입력란 삭제** — 백엔드가 `user1234` 자동 할당 (`is_first_login=1`로 강제 변경 유도)
- **폼 구조 재배치**: 이름 → 이메일 → (부서 50% : 직책 50% = `.form-row-2col`) → 권한
- 안내 배너: "초기 비밀번호는 `user1234`로 자동 설정됩니다"

### §6 — `dayjs.locale('ko')` 진입점 강제
- `waitAndBoot()`에서 앱 부팅 직전에 글로벌 로케일 한국어로 고정 → 'JUL/AUG' 같은 영문 월 오노출 차단

---

## V7 통합본 (PC/모바일 동시 고도화)

### §1 — 관리 페이지 상단 타이틀/설명 모바일 전면 숨김
- 모바일(≤768px)에서 `.page-header.is-admin-header { display: none }` 강제 → 화면 30%를 차지하던 "관리 / 회사 정보를 입력하고…" 영역 사라짐
- 결과: 사용자가 관리 모드 진입 즉시 [일반/멤버/부서·직책/공간] 서브탭이 최상단에 노출
- 적용 페이지: 멤버, 공간, 부서/직책, 일반(4개 admin 페이지 모두)

### §2 — 멤버 리스트 빌딩 식별자 아바타 모바일 숨김 + 좌측 정렬 강화
- 멤버 카드의 `.member-card-avatar`(아바타 동그라미)를 모바일에서 `display: none`
- 이름/이메일을 카드의 맨 좌측 끝으로 밀착 (`padding-left: 0`)
- 이름·이메일에 `text-overflow: ellipsis` 적용 — 좁은 폭에서도 한 줄 유지

### §3 — 관리 서브 메뉴 탭 gap/padding 컴팩트화
- 탭 버튼 간격 `gap: 4px`, 내부 패딩 `7px 12px`, 폰트 `13px`
- 아이콘-텍스트 간격 `gap: 5px` → 한 줄에 [일반/멤버/부서·직책/공간] 4개 모두 노출
- 가로 스크롤은 여전히 가능(`overflow-x: auto`)하되 일반적으로 드래그 불필요

### §4 — +생성하기/+공간 추가 버튼 nowrap + 공간 페이지 카드 UI
- `btn-compact-mobile` 클래스 신설: 모바일에서 `padding: 8px 12px`, `font-size: 13px`, **`white-space: nowrap`**, `flex-shrink: 0` 강제 → 글자 깨짐 방지
- 공간 페이지에도 듀얼 렌더링(`.space-table-desktop` + `.space-cards-mobile`) 도입
  - 모바일 카드: [색상칩 + 공간명 + 유형·인원 + 권한 뱃지] / [3개 제한·색상 메타] / [수정·삭제 액션]
- 관리 메뉴 sticky/fixed는 모바일에서 `position: relative !important; top: auto !important` 강제 해제 → 본문과 함께 스크롤

### §5 — 반복 예약 제어 시스템 고도화 (UI 문구 + 일괄 로직)
- **취소 분기 모달** `openRecurringDeleteScopeModal()`:
  - `[해당 일정 취소]` → `DELETE /api/reservations/:id?scope=single` (단건)
  - `[이후 반복 일정 삭제]` → `DELETE /api/reservations/:id?scope=future` (선택 일자 포함 이후 일괄)
  - `[전체 반복 일정 삭제]` → `DELETE /api/reservations/:id?scope=all` (과거+미래 전체) — 적색 강조
- **수정 분기 모달** `openRecurringEditScopeModal()`:
  - `[해당 일정만 수정]` → `PATCH /api/reservations/:id` (기존)
  - `[이후 모든 반복 일정에 적용]` → `PATCH /api/reservations/:id?update_scope=future` (시간·장소·제목 일괄 갱신, 사전 충돌 검증 트랜잭션)
- 일반(단건) 예약일 때는 모달 생략, 기존 confirm 흐름 유지

### §6 — 전역 모달 width 92%, max-width 480px 통일
- 모바일에서 모든 `.modal`이 `width: 92% !important; max-width: 480px !important; max-height: 92vh` 강제
- 푸터 버튼은 `flex: 1 1 auto; white-space: nowrap` → 좁은 화면에서도 텍스트 잘리지 않음

### V7 통합본 E2E 검증 (모두 통과)
| 검증 | 방법 | 결과 |
|---|---|---|
| 빌드 | `npm run build` | ✅ `_worker.js 80.81 kB` |
| 정적 자산 식별자 | 서빙된 `/static/app.js`·`/static/styles.css` grep | ✅ V7 통합본 식별자 19종 모두 노출 |
| 로그인 페이지 | Playwright Console | ✅ 0 error |
| 반복 예약 PATCH `?update_scope=future` | API E2E (3건 일괄 갱신) | ✅ `{"ok":true,"updated":3,"scope":"future"}` |
| 반복 예약 DELETE `?scope=future` | API E2E (3건 일괄 취소) | ✅ `{"ok":true,"cancelled":3,"scope":"future"}` |
| 반복 예약 DELETE `?scope=all` | API E2E (전체 취소) | ✅ 백엔드 라우트 정상 라우팅 |

## V7 누적 기능 (1차 — 이전 턴 적용)

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
- **Last Updated**: 2026-06-10 (V8 패치 1 — GNB 화이트 강제 + 사이드바 인디케이터 + 일정 원클릭)

## 검증 결과 (V7 완결본 E2E)
| 시나리오 | 결과 |
|---|---|
| **§1** `home-cal-badge` 마크업 + `today.locale('ko').format('M월')` 동적 바인딩 | ✅ |
| **§1** 📅 이모지 완전 제거 (renderHome에서 string '📅' 부재 확인) | ✅ |
| **§2** `splitSpaceName()` 함수로 마지막 공백 기준 prefix/suffix 분리 | ✅ |
| **§2** `.space-name-prefix` / `.space-name-suffix` 듀얼 마크업 + 미디어 쿼리 두 줄 전환 | ✅ |
| **§3** Pretendard CDN 로드(renderer.tsx) + `--font-pretendard` 전역 변수 | ✅ |
| **§3** `.nav-link { background-color: #dfe7f7 }`, active/hover 톤 분리 | ✅ |
| 빌드 `dist/_worker.js 81.30 kB` | ✅ |
| 식별자 검증: app.js 6종(cal-badge-month/day, space-name-prefix/suffix, home-cal-badge, today.locale), styles.css 6종 | ✅ |
| Playwright /login 콘솔 에러 0건 | ✅ |

---

## 🆕 V10 통합 패치 (2026-06-10)

### §1 [원형 보존]
- 기존 데이터 100% 보존: users 208 / spaces 9 / reservations 33 (조회 기준)
- 모든 기존 이벤트 핸들러(click/submit/change) 유지 — 추가만 발생, 제거 없음

### §2 [GNB 텍스트 — opacity 1 강제]
- `.global-nav .nav-link / :hover / .is-active` 모두 `opacity:1 !important; color:#fff !important; font-weight:600 !important;`
- 활성 탭: 라벤더 배지(#dfe7f7) + 딥 네이비(#0f2647) 글자색으로 컨트라스트 유지

### §3 [모바일 사이드바 아이콘 노출]
- `@media (max-width:768px)` 에서 `.admin-side-link i { display:inline-flex !important; visibility:visible !important; opacity:1 !important; }`
- PC와 동일하게 [일반], [멤버], [부서/직책], [공간] 아이콘 가시

### §4-1 [인사이트 어드민 가드]
- **백엔드**: `src/auth.ts`에 `requireAdmin` 미들웨어 신설 → `src/index.tsx`에서 `/api/insights/*` + `/insights` 둘 다 보호
- **프론트엔드**:
  - 데스크탑 GNB의 `navLinksNode`에서 `isAdmin &&` 게이트
  - 모바일 드로어 `navItem('insights', ...)` 게이트
  - SPA 라우터 `case 'insights'`에서 비-관리자 → `/home` 리다이렉트
- E2E 검증: 멤버 `GET /api/insights/overview` → **HTTP 403** ✅, 멤버 `GET /insights` → **HTTP 302 → /home** ✅

### §4-2 [엑셀 다운로드]
- 인사이트 우상단 [엑셀 다운로드] 버튼
- 라이브러리: 기존 로드된 `xlsx@0.18.5` (V6-3 멤버 업로드용) 재활용
- 탭별 멀티시트 워크북:
  - 개요 탭: 리포트 정보 / 요약 / 인기 공간 / 시간대 히트맵
  - 내역 탭: 예약 내역 (8컬럼)
  - 통계 탭: 노쇼 집계 / 요일별 / 예약 방식 / 수용 인원 / 공간별
- 파일명: `mateground_insight_${tab}_${YYYYMMDD_HHmm}.xlsx`
- 현재 적용된 공간 필터(`space_ids`)와 기간이 시트 1(리포트 정보)에 메타로 기록됨

### §5 [공간 필터 — 인사이트]
- 우상단 멀티셀렉트 드롭다운 (전체 선택 / 모두 체크 / 개별 체크박스 + 색상 도트)
- 백엔드: `resolveSpaceFilter()` 헬퍼 — `?space_ids=1,3,5` 쿼리스트링 → `AND r.space_id IN (?,?,?)` SQL 단편 + 바인딩
- 3개 엔드포인트(/overview, /history, /stats) 모두 동일 필터 적용
- 클라이언트: 체크 변경 시 `InsightState.spaceIds` 갱신 → `renderInsights()` 호출 → 리스트와 그래프가 동시에 재페치
- E2E 검증: `?space_ids=1` 호출 시 `popular_spaces`에 Meeting Room A만 1건 ✅

### §6 [색상 팔레트 시스템]
- 어드민 > 일반 탭에 색상 팔레트 카드 신규 추가 (`buildColorPaletteCard()`)
- 공간별 컬러 입력 + 20색 프리셋 스와치 + [되돌리기]/[저장] 액션
- 저장 시 변경된 공간만 `PATCH /api/spaces/:id` 일괄 호출 → DB(D1) `spaces.color` 갱신
- 모든 예약 블록은 SQL JOIN으로 `space_color`를 받으므로 다음 캘린더 진입 시 자동 반영
- 저장 후 `renderAdminGeneral()` 재호출로 UI도 즉시 동기화
- E2E 검증: `PATCH /api/spaces/1 {color:"#ff8800"}` → `{ok:true}` → 재조회 시 `#ff8800` 반영 ✅

### §7 [상단 리사이즈 핸들 — 시작 시간 조정]
- 예약 블록 상단에 `.ev-resize-handle-top` 8px 영역 신설 (커서 `ns-resize`)
- 드래그 위로 → `start_time` 감소, `end_time`은 고정
- **가드 1**: 같은 공간의 이전 예약(`endMin <= curStartMin`)의 최대 `endMin` 이하로는 못 내려감 (겹침 방지)
- **가드 2**: 오늘 날짜인 경우 현재 시각 이전(`now.hour()*60 + now.minute()`)으로는 못 내려감 (과거 시간 방지)
- **가드 3**: `end_time - 30분` 이상으로는 못 올라감 (최소 30분 보장)
- 30분 스냅 + 변경 없을 시 위치 원복
- 백엔드: 기존 `PATCH /api/reservations/:id`가 이미 `start_time` 지원 (line 414-423)
- E2E 검증: 예약 20:00-21:00 → `PATCH {start_time:"19:30"}` → DB에서 19:30-21:00 반영 ✅

### §6/§7 보존 원칙
- §6: 별도 마이그레이션 불필요 — 기존 `spaces.color TEXT DEFAULT '#0066cc'` 컬럼 그대로 활용
- §7: 기존 하단 리사이즈 핸들(`.ev-resize-handle`) 및 드래그-신규-예약 흐름 100% 그대로 유지 — 상단 핸들만 **추가**

### 빌드/검증 산출물
| 항목 | 값 |
|---|---|
| `dist/_worker.js` | 86.98 kB (V8 패치1 대비 +1.46 kB) |
| `public/static/app.js` | 158,183 bytes / 3,707 lines |
| `public/static/styles.css` | 116,097 bytes / 4,580 lines |
| `src/api/insights.ts` | 216 lines (resolveSpaceFilter + 3 endpoints with `r.space_id IN`) |
| `src/auth.ts` | 78 lines (+requireAdmin) |
| `src/index.tsx` | 66 lines (insight middleware chain) |
| Vite 빌드 시간 | 1.30s ✅ |
| TypeScript 컴파일 오류 | 0건 ✅ |
| Playwright `/login` 콘솔 메시지 | 0건 ✅ |

### V10 E2E 검증 매트릭스
| 시나리오 | 결과 |
|---|---|
| §4-1 비로그인 → /api/insights/overview | HTTP 401 ✅ |
| §4-1 admin → /api/insights/overview | HTTP 200 ✅ |
| §4-1 member → /api/insights/overview | HTTP 403 `Forbidden — admin only` ✅ |
| §4-1 member → /insights (페이지) | HTTP 302 → /home ✅ |
| §5 admin → /api/insights/overview?space_ids=1 | popular_spaces에 Meeting Room A 1건만 ✅ |
| §6 admin → PATCH /api/spaces/1 {color:"#ff8800"} | `{ok:true}` + 재조회 시 색 반영 ✅ |
| §7 admin → PATCH /api/reservations/86 {start_time:"19:30"} | `{ok:true,updated:1}` + DB에 19:30 반영 ✅ |
| 데이터 보존 (users 208 / spaces 9 / reservations 33) | ✅ |

---

## 🆕 V11 통합 패치 (2026-06-10) — 메이트리빌딩 디자인 개편 (회사 정보 소거 반영)

### §1 [원형 보존 절대 원칙]
- DB 구조 100% 유지 (users / spaces / reservations / tenants 테이블 스키마 무손상, 신규 컬럼 1개만 추가)
- 기존 click/submit/change 핸들러 전수 보존 — 모든 변경은 **추가** 또는 **시그니처 호환 교체**

### §2 [GNB 글자 흐림 완전 차단] 🚨 사용자 긴급 제보 대응
- **사용자 제보**: "홈, 공간, 인사이트, 관리를 누르면 흐릿하게 보이는 문제"
- **원인**: V8/V10 누적 패치층에서 `.is-active { color:#0f2647 }` 딥 네이비가 흐림으로 인지됨
- **해결**: `styles.css` 4580~4728줄에 **최종 오버라이드 블록** 추가
  - `.global-nav .nav-link` + `.is-active`/`.active`/`.selected`/`:hover`/`:focus`/`:focus-visible` + `href*=` 셀렉터 **모든 상태**에서 `color:#fff !important; opacity:1 !important; font-weight:700 !important;` 강제
  - 자식 요소(`i`, `span`)까지 화이트 강제
  - 시각 피드백은 **`::after` 가상 요소 하단 인디케이터**로 이동 (호버: 반투명 화이트, active: 솔리드 화이트)
- 결과: 어떤 상태(클릭/포커스/호버/활성)에서도 메뉴 텍스트가 흐려지지 않음

### §3-1 [회사 정보 카드 완전 소거]
- 어드민 > 일반 페이지에서 [회사 정보] 카드 마크업 영구 삭제
- 잔존 검증: `grep -i "회사 정보"` → V11 주석 2건 + admin-members 서브타이틀 1건(무관)만 남음

### §3-2 [디바이스 카드 제거 + 멤버/공간 2분할 그리드]
- [디바이스] 요약 카드 영구 삭제
- `.summary-card-grid-container { grid-template-columns: repeat(2, 1fr); gap:16px; }` 적용
- [멤버] [공간] 두 카드가 1:1 균등 2열로 정렬

### §3-3 [테넌트별 일정 컬러 팔레트 신설] 🆕
- **위치**: 기존 [공간 색상 팔레트] 바로 윗단에 [일정 컬러 팔레트] 섹션 신설
- **마이그레이션**: `migrations/0005_v11_tenant_schedule_color.sql`
  - `ALTER TABLE tenants ADD COLUMN schedule_color TEXT NOT NULL DEFAULT '#0066cc';`
  - WYLIE 시드값 `#0066cc`, LUSH 시드값 `#1d1d1f`
- **백엔드**: `src/api/tenants.ts` 신설 (75줄)
  - `GET /api/tenants` — 인증된 사용자 누구나 (CSS 변수 동기화 목적)
  - `PATCH /api/tenants/:id` — 관리자 전용, 화이트리스트 `['WYLIE','LUSH']`, HEX 정규식 검증, **단일 행 UPDATE로 격리 보장**
- **프론트엔드 격리 설계**:
  - `buildSchedulePaletteCard(tenants)` — [와일리 전용 picker] / [러쉬코리아 전용 picker] 마크업 수준 분리
  - `onChangeWylie` 핸들러는 `PATCH /api/tenants/WYLIE`만 호출, `onChangeLush`는 `PATCH /api/tenants/LUSH`만 호출 — 데이터 바인딩 완전 격리
  - 실시간 반영: `document.documentElement.style.setProperty('--wylie-schedule-color', color)` 즉시 적용
- **CSS 변수 시스템**:
  - `:root { --wylie-schedule-color: #0066cc; --lush-korea-schedule-color: #1d1d1f; }`
  - `.timeline-event[data-tenant-id="WYLIE"]` / `.tenant-wylie` → `background-color: var(--wylie-schedule-color) !important`
  - `.timeline-event[data-tenant-id="LUSH"]` / `.tenant-lush` → `background-color: var(--lush-korea-schedule-color) !important`
- **부팅 시 동기화**: `boot()` 진입 시 `GET /api/tenants` 1회 호출 → `applyTenantColorVars(tenants)`로 CSS 변수 갱신
- **이벤트 마크업**: `buildEventEl()`이 `data-tenant-id`와 `tenant-wylie/lush` 클래스를 모든 예약 블록에 부착

### §4 [상단 리사이즈 핸들 — 방향성 가드 강화]
- **사용자 제보**: "09:00 일정을 08:30으로 앞당기려고 윗부분 드래그 → 종료 시간이 줄어들며 블록 찌그러짐"
- **근본 해결**: `direction: 'top' | 'bottom'` 명시적 파라미터 바인딩
  - `resizeState.direction = 'bottom'` / `resizeTopState.direction = 'top'` 명시
  - 각 move 핸들러에서 `direction !== 'top'` / `'bottom'` 가드로 핸들 혼선 차단
- **종료 시간 좌표 동결(frozenBottom)**: mousedown 시점에 `originalTop + originalHeight`를 캡처하여 `resizeTopState.frozenBottom`에 저장
  - `onResizeTopMove`에서 `newHeight = frozenBottom - newTop` 공식 사용 → **end_time 좌표 수학적 불변 보장**
- **셀렉터 격리**: 하단 핸들 캡처 시 `closest('.ev-resize-handle:not(.ev-resize-handle-top)')` 사용 → 상단 핸들 클릭이 하단 로직으로 새지 않음
- **3중 가드 유지**:
  - 가드 1 (겹침): 같은 공간 이전 예약 `endMin` 이하 진입 금지
  - 가드 2 (과거): 오늘 날짜 시 현재 시각 이전 진입 금지
  - 가드 3 (최소): `end_time - 30분` 이상 금지

### V11 빌드/검증 산출물
| 항목 | 값 |
|---|---|
| `dist/_worker.js` | 88.03 kB (V10 대비 +1.05 kB) |
| `public/static/styles.css` | 4,728 lines (V10 대비 +148 lines) |
| `public/static/app.js` | 8개 위치 수정 + 2개 신규 함수 (buildSchedulePaletteCard, applyTenantColorVars) |
| `src/api/tenants.ts` | 75 lines (신규) |
| `src/index.tsx` | 70 lines (tenantsApi 라우트 등록) |
| `migrations/0005_v11_tenant_schedule_color.sql` | 신규 (ALTER + 2 UPDATE) |
| `db/database_dump.sql` | 501 lines (schedule_color 컬럼 포함) |
| Vite 빌드 시간 | 922ms ✅ |
| TypeScript 컴파일 오류 | 0건 ✅ |
| Playwright `/login` 콘솔 메시지 | 0건 ✅ |

### V11 E2E 검증 매트릭스
| 시나리오 | 결과 |
|---|---|
| §2 GNB nav-link 모든 상태에서 #fff + opacity 1 + 700 강제 | CSS 라인 4580+ 확인 ✅ |
| §3-1 회사 정보 카드 잔존 검사 (`grep`) | 마크업 0건 (주석/무관 서브타이틀만) ✅ |
| §3-2 디바이스 카드 잔존 검사 + 2열 그리드 적용 | ✅ |
| §3-3 admin → PATCH /api/tenants/WYLIE {schedule_color:"#7c3aed"} | `{ok:true, id:"WYLIE", schedule_color:"#7c3aed"}` ✅ |
| §3-3 격리 검증: WYLIE 변경 후 LUSH 미변동 (#1d1d1f 유지) | ✅ |
| §3-3 member → GET /api/tenants | HTTP 200 (CSS 동기화 허용) ✅ |
| §3-3 member → PATCH /api/tenants/WYLIE | HTTP 403 `관리자만 접근할 수 있습니다.` ✅ |
| §4 direction 파라미터 바인딩 + frozenBottom 캡처 | 코드 검증 완료 ✅ |
| §4 `:not(.ev-resize-handle-top)` 셀렉터로 핸들 격리 | ✅ |
| 데이터 보존 (users 207 active / spaces 9 / reservations 17 / tenants 2) | ✅ |

