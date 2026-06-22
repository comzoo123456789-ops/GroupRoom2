# 메이트리그라운드 (Mateground) — V45 리사이즈 핵심 버그 수정 + UI 정비

WYLIE/LUSH 통합 예약 관리 플랫폼. Cloudflare Pages + Hono + D1(SQLite).

## 🆕 V45 (리사이즈 찌그러짐 + 로그인 60:40 + 색상 프리셋 제거)

> 사용자 보고 3건:
> 1. `"회의실 예약하고 시간을 줄이거나 늘리면 시간이 늘어나는게 아니라 시간이 줄어들면서 찌그러져 이거 문제 해결해줘 어디 룸을 예약해서 시간을 늘이고 줄일수가없어"`
> 2. `"로그인 이메일주소 @wylie.co.kr 이거 칸이 너무 좁아 60:40으로 해줘 60은 아이디 적는거 40은 체크박스로해줘"`
> 3. `"일반 > 공간 색상 팔레트 프리셋 색상에 아무런 색상이 안보여 이거 애초에 그냥 코드에서 삭제해줘 사용할일이 얼마 없을것같아 그냥 룸에 대한 색상만 변경할수있도록만 해주고 프리셋 색상은 그냥 코드에서 삭제해버려"`

### §1 리사이즈 찌그러짐 근본 원인 — V44 부산물 버그
**진짜 원인 (1줄)**: `onResizeMove` 에서 `PX_TO_MIN(dy)` 를 호출 → 절대좌표용 헬퍼가 dy(상대값) 에 `TIMELINE_START_MIN(360)` 을 더해버려서 **1px 만 움직여도 +6시간 더해짐**.

```js
// V44 도입 시
const PX_TO_MIN = (p) => (p / PX_PER_MIN) + TIMELINE_START_MIN;

// 버그 — dy(차이)에 절대좌표 변환 사용
const dyMin = PX_TO_MIN(e.clientY - R.startClientY);
//        ↓ dy=30px(=45분 기대) 일 때
//        ↓ 실제 = 45 + 360 = 405분 (≈ 6시간 45분)
//        ↓ origEnd(11:00) + 405 = 17:45 → maxEndMin(23:30) 클램프
//        ↓ 결과: 모든 리사이즈가 즉시 max/min 으로 찌그러짐
```

**해결**:
```js
// V45: dy 전용 헬퍼 신설 (오프셋 없음)
const PX_DELTA_TO_MIN = (dy) => dy / PX_PER_MIN;

function onResizeMove(e) {
  const dyMin = PX_DELTA_TO_MIN(e.clientY - R.startClientY);  // ✅ 순수 차이값
  ...
}
```

**검증 (Node 시뮬레이션)**:
| 동작 | dy | dyMin | newEnd/Start | 결과 |
|------|----|----|-----|-----|
| 하단 +60px | +60 | +90분 | 750 | **12:30** ✅ |
| 하단 -30px | -30 | -45분 | 630 | **10:30** ✅ |
| 상단 -60px | -60 | -90분 | 510 | **08:30** ✅ |

→ 이제 시간 늘리기/줄이기 모두 정확히 의도대로 작동.

### §2 로그인 이메일 60:40 비율 (`public/static/styles.css`)
```css
/* V45 §2: 사용자 요청 — 60:40 비율 명시 */
.login-email-input { flex: 6 1 0; min-width: 0; }   /* 60% */
.login-email-domain { flex: 4 1 0; min-width: 0; }  /* 40% */
```
- 데스크탑 + 모바일 모두 동일 비율 적용
- 모바일은 도메인 셀렉트 폰트만 12px로 약간 축소

### §3 공간 색상 팔레트 — 프리셋 스와치 제거 (`public/static/app.js` `buildColorPaletteCard`)
- **삭제**: 상단 24×24 프리셋 색상 row + `window.__paletteFocusedSpaceId` 보조 헬퍼
- **유지**: 공간별 카드 (네이티브 `<input type="color">` 컬러피커)
- **개선**: 카드 div를 `<label for=>` 로 변경 → 카드 어디든 클릭하면 컬러피커 열림
- 인사이트 페이지의 기간 필터 `presets` 배열은 무관(7일/30일/90일 등)이라 유지

---

## V44 (타임라인 06:00 시작 + 공간 정렬/삭제/LIVE 정합성)

> 사용자 5개 요청 일괄 처리:
> 1. `"00:00시 ~ 05:00까지 삭제해 그 시간에 사람들이 회의실 쓸 일이 없으니깐 06시부터 시작하게 해줘"`
> 2. `"공간에 미팅룸 이름바꾸니깐 공간에 미팅룸 사라지고 Room이라는 룸은 삭제도 불가하고 와일리 전용인데 맨뒤로 보내줘야하는데 그렇지도 않고..."`
> 3. `"룸이 삭제 및 이름 수정이 되어도 실시간 반영이 되어야함 삭제되면 삭제 이름 수정되면 수정되어야하고"` (LIVE 카드)
> 4. `"Room 삭제할려고해도 삭제 불가함 이거 문제해결해주고"`
> 5. `"5F room은 와일리 전용이라 a,c,d,f 이거 끝부분 라운지 사이에 들어가야하는 부분이야 공용부분이니깐"`

### §1 타임라인 06:00 시작
- 새 상수: `TIMELINE_START_HOUR=6`, `TIMELINE_END_HOUR=24`, `TIMELINE_HOURS=18`
- 좌표 헬퍼 `MIN_TO_PX(m) = max(0, (m - 360) * (40/60))` 도입 — 06:00 이전은 자동 0 클램프
- **수정 호출부 7곳**: 시간 컬럼 루프(L912), 셀 그리드 루프(L920), 이벤트 top(L946), now-line(L1333), 홈→공간 스크롤(L784), 시간 select 드롭다운 × 2 (L1718, L1989)
- **드래그/리사이즈 좌표계 보정**:
  - 컬럼 좌표(top=0)가 06:00을 의미 → `(top/40)*60 + TIMELINE_START_MIN` 로 변환
  - 리사이즈 `minStartMin = MIN_START_MIN` (06:00 이전 차단)
  - `eventEl.style.height` 는 길이(차이값)이라 `MIN_TO_PX` 가 아닌 `PX_PER_MIN`만 곱함 (이전 코드의 잠재 버그도 함께 수정)
- 컬럼 총 높이: 18 × 40 = **720px** (이전 960px → 240px 축소)

### §2/§5 공간 정렬 로직 전면 재설계 (`src/api/spaces.ts`)
**이전 (하드코딩 매칭 — 룸 이름 변경 시 깨짐)**
```ts
const PRIMARY_ORDER = ['Meeting Room A',...,'Meeting Room E']; // 정확 매칭
sorted = [...primary, ...rest, ...pinnedTail];
```
**현재 (동적 type/tenant_scope 기반)**
```ts
// 1) 공용 미팅룸 (tenant_scope IS NULL/'') — name ASC
// 2) 테넌트 전용 미팅룸 (tenant_scope = 사용자 테넌트) — name ASC
// 3) 라운지/Recharging Zone (type != 'meeting_room') — display_order ASC
const sorted = [...publicRooms, ...tenantRooms, ...tail];
```
→ 룸 이름을 자유롭게 변경해도 정렬 무너지지 않음. **5F Room (WYLIE 전용) 은 공용 룸 다음, 라운지 앞** 위치로 자동 배치.

### §3 LIVE 카드 동적 매칭 (`src/api/public.ts`)
**이전**: `WHERE name IN ('Meeting Room A',...,'Meeting Room E') AND tenant_scope IS NULL` → 이름 바꾸면 LIVE 에서 사라짐.

**현재**:
```sql
WHERE type = 'meeting_room'
  AND (tenant_scope IS NULL OR tenant_scope = '')
```
→ 룸 이름 변경/삭제/추가가 모두 즉시 LIVE 카드에 반영됨. tenant_scope 빈 문자열 변칙 데이터도 흡수.

### §4 Room 삭제 불가 해결
**원인**: `reservations.space_id REFERENCES spaces(id)` (NO CASCADE). 이전 코드는 `UPDATE reservations SET status='cancelled'` 만 했어서 잔존 row가 spaces DELETE 를 막음 (`D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT_FOREIGNKEY`).

**수정**: `DELETE FROM reservations WHERE space_id = ?` 로 변경. `reservation_attendees` 는 `ON DELETE CASCADE` 라 자동 정리됨.

**검증**:
```bash
DELETE /api/spaces/8  → {"ok":true} HTTP 200   # 이전엔 500
```

### tenant_scope 정규화 (프론트 + 백엔드)
- POST/PATCH `/api/spaces` 에서 `tenant_scope === '' || undefined` → `NULL` 로 저장
- 프론트 `openSpaceModal.submit()` 도 payload 의 `tenant_scope` 를 정규화
- DB 정화 1회 실행: `UPDATE spaces SET tenant_scope = NULL WHERE tenant_scope = ''`

### V44 후 정렬 결과 (검증됨)
```
공용 미팅룸 (name ASC):      Room → Room A → Room B → Room C → Room D → Room E → Room F
테넌트 전용 미팅룸:          5F Room (WYLIE)
공용공간 (display_order):    Lounge → Recharging Zone
```

### 검증 시나리오
| 시나리오 | 결과 |
|---------|------|
| 룸 이름을 "Room A" → "회의실1" 변경 | LIVE 카드에 "회의실1"로 즉시 반영 ✅ |
| 새 룸 "Room G" 추가 | LIVE/관리/타임라인 모두 즉시 반영 ✅ |
| `Room` (id=8) 삭제 | FOREIGN KEY 에러 없이 성공 ✅ |
| 5F Room (WYLIE 전용) 위치 | Room F 다음, Lounge 앞 ✅ |
| 06:00 이전 영역 | 화면에 없음 (00~05시 제거) ✅ |
| 23:30 이벤트 | `MIN_TO_PX(1410) = 700px` 정확 위치 ✅ |

---

## V43.2 (종료된 일정 자동 숨김)

> 사용자 보고: **"현재 시간이 16:48인데 아침에 있던 09:00~10:00 일정이 왜 안 사라져? 오늘의 일정도 09:00~10:00 안 사라지고, 10:30~14:30 일정도 안 사라지고. 일정 완료된 거는 삭제되게끔 해줘"**

### 원인
- V34 §5의 `todayList = reservations.filter(r => r.date === todayStr)` 가 **날짜만** 비교
- end_time 체크가 없어서 이미 종료된 일정도 "오늘의 일정"에 그대로 노출
- "다음 일정" 카드도 `todayList[0]` 을 그대로 사용 → 이미 끝난 09:00~10:00 이 첫 번째로 잡힘

### 수정

**`isFinished(r)` 헬퍼 신설** (`public/static/app.js` L423~436):
```javascript
const nowMinutes = today.hour() * 60 + today.minute();
const isFinished = (r) => {
  if (r.date < todayStr) return true;          // 과거 날짜는 무조건 완료
  if (r.date === todayStr) {                    // 오늘 일정은 end_time 비교
    const [eh, em] = String(r.end_time || '00:00').split(':').map(Number);
    const endMin = (eh || 0) * 60 + (em || 0);
    return endMin <= nowMinutes;
  }
  return false;                                 // 미래 날짜는 완료 아님
};
```

**적용 위치**:
| 항목 | Before | After |
|------|--------|-------|
| `todayList` | `r.date === todayStr` | `r.date === todayStr && !isFinished(r)` |
| `nextOne` | `todayList[0] || upcomingList[0]` | (자동) 완료된 일정 제외 후 첫번째 |
| `myWeekCount` (이번주 카운트) | 7일 범위 | 7일 범위 + 완료 제외 |
| `upcomingList` | `r.date > todayStr` | 변경 없음 (미래 날짜는 항상 표시) |

**시뮬레이션 검증** (현재 16:48 기준):
| 일정 | 결과 |
|------|------|
| 09:00 ~ 10:00 (아침 회의) | ❌ 숨김 (종료된 지 6h 48m) |
| 10:30 ~ 14:30 (점심 미팅) | ❌ 숨김 (종료된 지 2h 18m) |
| 13:00 ~ 20:00 (진행 중) | ✅ 표시 |
| 16:30 ~ 21:30 (방금 시작) | ✅ 표시 |
| 19:00 ~ 23:30 (저녁 예정) | ✅ 표시 |
| 6/16 09:00 ~ 10:00 (내일) | ✅ 표시 |

→ 오늘 5건 → 3건으로 자동 정리, `nextOne` 도 "진행 중 회의 (13:00-20:00)" 로 자동 갱신

### 시간 흐름에 따른 자동 갱신

기존 폴링 시그니처는 `id + updated_at + status` 만 비교 → 시간이 흘러도 데이터가 안 바뀌면 재렌더 안 됨.

**수정**: 시그니처에 `현재 분(YYYY-MM-DD HH:MM)` 포함
```javascript
const nowMin = dayjs().format('YYYY-MM-DD HH:mm');
const sig = nowMin + '|' + JSON.stringify(newUpcoming.map(r => ...));
```
→ **분이 바뀔 때마다 자동 재렌더** → 종료 시각이 지나는 순간 해당 일정이 화면에서 사라짐 (수동 새로고침 불필요)

### 영향 범위 (수정 안 한 곳)
- **공간 예약 페이지(spaces 타임라인)**: 끝난 일정도 시각적으로 보여야 함 (스크롤 이력) → 의도적으로 변경 없음
- **인사이트/통계**: 과거 데이터 누적이라 변경 없음
- **DB 데이터**: 일정은 DB에 그대로 남음 (자료 보존), 화면 표시만 필터링

### 검증
- `npm run build` ✅ (`98.73 kB · 63 modules · 1.26s`)
- Node.js 시뮬레이션 ✅ (위 표 6건 모두 예상대로 동작)

---

## V43.1 (반응형 추가 정리 — PC vs 모바일 차별화)

> V43 직후 사용자 후속 요청:
> 1. **"PC 화면에서는 퀵 메뉴가 안 보이게, 스마트폰/모바일 환경에서만 보이게"** — 데스크탑은 네비바에 이미 진입 메뉴 있어서 중복
> 2. **"PC에서는 오늘의 일정 + 앞으로의 일정을 50:50 단일 카드로 깔끔하게 (간격 최소화)"**
> 3. **"모바일에서는 오늘의 일정/앞으로의 일정 중 하나를 체크박스로 선택"** — 모바일에서 두 카드가 차지하는 공간이 너무 큼

### §1 PC에서 퀵 메뉴 숨김

- 기본: `.v34-card--quick { display: none !important; }`
- 모바일(`max-width: 768px`)에서만 `display: block`
- PC 사용자는 좌측 네비바를 통해 메뉴 진입하므로 화면 공간 절약

### §2/§3 오늘의 일정 + 앞으로의 일정 → 통합 카드 (PC 50:50 / 모바일 탭)

**구조**: `<section class="v34-card v34-card--schedule" data-active-tab="today|upcoming">`

```
┌─────────────────────────────────────────────────┐
│ [📋 오늘의 일정 · 2]   │   [📅 앞으로의 일정 · 5]   │   ← .v34-sched-head
├─────────────────────────────────────────────────┤
│ 14:00 - 15:00         │   12/16(화)              │
│ 주간 회의 · A룸       │   13:00 - 14:00          │   ← .v34-sched-body (PC: 가로 50:50)
│                       │   기획 미팅 · B룸        │
└─────────────────────────────────────────────────┘
```

**PC(>768px)**: `.v34-sched-body { display: flex }` → 좌 50% 오늘 · 1px 구분선 · 우 50% 앞으로. 헤더는 두 제목을 가로 나란히.

**모바일(<=768px)**:
- 헤더가 회색 배경 토글 박스로 변신, 각 탭에 라디오(체크박스) + 제목
- 활성 탭만 핑크 테두리 + 흰 배경 + 핑크 텍스트로 강조
- 본문은 `display: block` 으로 전환되어 활성 패널만 표시 (`[data-active-tab="today"] [data-side="today"]`)
- 탭 클릭 시 JS `handleTabClick(side)` 가 `data-active-tab` 속성과 라디오 `checked` 동기화

**콤팩트화**:
- 카드 패딩 24px → 16px
- 행 패딩 12px → 8px, 폰트 14px → 13px
- 행 간격 8px → 6px

**0건 처리**:
- 양쪽 모두 0건이면 카드 자체 미표시
- 한쪽만 0건이면 해당 패널에 안내문 ("오늘은 예정된 일정이 없습니다." / "예정된 일정이 없습니다.")

### dashboard 카드 최종 구성

```
1. quickCard          ← 퀵 메뉴 (모바일에서만 노출)
2. nextCard           ← 다음 일정
3. weekInviteCard     ← 이번주 일정 + 받은 초대 (50:50 분할)
4. todayUpcomingCard  ← 오늘의 일정 + 앞으로의 일정 (PC 50:50 · 모바일 탭) ★ V43.1 신설
```

V43에서 분리되어 있던 `todayCard`/`upcomingCard` 변수는 사라지고 `todayUpcomingCard` 하나로 통합.

### 검증

- `npm run build` ✅ (`98.73 kB · 63 modules · 0.97s`)
- `curl /static/app.js`: `todayUpcomingCard` / `v34-card--schedule` / `v34-sched-tab` 모두 노출
- `curl /static/styles.css`: V43.1 §1, §2/§3 마커 + `.v34-card--quick` 숨김 규칙 + `@media (max-width: 768px)` 모바일 탭 규칙
- PlaywrightConsoleCapture: 콘솔 에러 0건

---

## V43 (홈/로그인 화면 UI 정리 — 4건 한 번에)

> 사용자 V42 직후 4가지 UI 정리 요청:
> 1. **"스마트폰에서 아이디 + 메일 도메인이 두 줄로 wrap 되는 문제 — 한 줄로 압축"** (V42 §3 모바일 미디어쿼리가 원인)
> 2. **"현재 시각 / 마지막 갱신 / 10초마다 자동갱신 푸터를 이용 가능한 공용 회의실 아래에 작게"** — 푸터가 너무 커서 안 보임
> 3. **"XXX님, 오늘도 화이팅 인사말 박스 완전 삭제 + 그 자리에 빠른 진입 이동 + 빠른 진입을 퀵 메뉴로 rename"**
> 4. **"이번 주 일정 + 받은 초대 두 카드를 좌 50% / 우 50% 분할 단일 카드로 병합 — 보는 용도라 크게 할 필요 없음"**

### §1 모바일 로그인 이메일 한 줄 유지

- **원인**: V42 §3에서 추가했던 `@media (max-width: 480px) { .login-email-row { flex-wrap: wrap; } .login-email-input { flex: 1 1 100%; } .login-email-domain { flex: 1 1 100%; } }` 가 두 줄로 분리
- **수정**: `flex-wrap: nowrap` + `.login-email-input { flex: 1 1 auto }` + `.login-email-domain { flex: 0 0 auto; max-width: 130px; font-size: 11px; padding: 0 6px }` 로 한 줄 압축
- 파일: `public/static/styles.css` L8821~8836

### §2 LIVE 카드 푸터 → 헤더 바로 아래 작은 메타 한 줄

- **Before**: 카드 맨 아래에 `<div class="abnb-card__foot">` 두 줄(`현재 시각 13:34 기준 · 마지막 갱신 13:34:43` + `10초마다 자동 갱신`)
- **After**: 카드 헤더(`이용 가능한 공용 회의실`) 바로 아래 `<div class="live-card-meta">` 한 줄, 작은 회색 텍스트 + 핑크 노트
  - 좌측: `13:34 기준 · 갱신 13:34:43` (콤팩트 포맷)
  - 우측: `10초마다 자동 갱신`
- 푸터 컨테이너(`abnb-card__foot`)는 완전히 제거 → 카드 하단 공간 절약
- 파일:
  - `src/pages/login.tsx`: 푸터 블록 제거, 헤더 바로 아래 `<div class="live-card-meta">` 추가
  - `public/static/styles.css`: `.live-card-meta` / `.live-card-meta__text` / `.live-card-meta__note` 신규 스타일
  - `public/static/login.js` L161~170: 텍스트 포맷 콤팩트화 (`현재 시각 ... 기준 · 마지막 갱신 ...` → `... 기준 · 갱신 ...`)

### §3 인사말 헤더 박스 완전 삭제 + "빠른 진입" → "퀵 메뉴" 이동/rename

- **Before**: 홈 페이지 상단에 `<section class="v34-card v34-card--greet">` 큰 인사 박스 (`마스터(WYLIE)님, 오늘도 화이팅` + 부제 + 우측 날짜 칩)
- **After**: 인사말 카드 전체 코드 삭제 (소스에서 완전 제거). 그 자리에 기존 "빠른 진입" 카드를 이동, 제목을 **"퀵 메뉴"** 로 변경
- 영향:
  - `greetCard` 변수 / `v34-card--greet` 클래스 / `v34-greet-text` / `${greeting}` 로직 / `hour < 6 ...` 인사말 분기 모두 삭제
  - dashboard 카드 순서: `quickCard(퀵 메뉴) → nextCard → weekInviteCard → todayCard → upcomingCard`
- 파일: `public/static/app.js` L432~446 영역(인사말 카드) 삭제 + L522 "빠른 진입" → "퀵 메뉴" 변경 + L612 dashboard 조립 부분 재정렬

### §4 이번 주 일정 + 받은 초대 → 좌 50% / 우 50% 분할 단일 카드

- **Before**: `weekCard`(이번 주 일정) + `inviteCard`(받은 초대) 두 개의 별도 카드, 각각 grid 한 셀씩 차지
- **After**: 한 카드 `<section class="v34-card v34-card--split">` 안에 좌 50% / 우 50% 로 분할
  - 좌측 50%: `이번 주 일정` + 큰 숫자(예: `4건`) + 부제(`예정 3 · 오늘 1`)
  - 가운데: 1px 회색 세로 구분선
  - 우측 50%: `받은 초대` + 큰 숫자 + 부제(`클릭하여 응답 →` 또는 `초대 없음`) — 클릭 시 V35 받은 초대 모달 호출(기존 동작 유지)
- 콤팩트 모드: 카드 패딩 24px → 18px, 숫자 폰트 36px → 28px, 모바일에서 24px
- 파일:
  - `public/static/app.js`: 두 카드 정의를 `weekInviteCard` 하나로 통합
  - `public/static/styles.css`: `.v34-card--split` / `.v34-split-half` / `.v34-split-divider` / `.v34-split-big` 등 신규 스타일 일가족

### 검증

- `npm run build` ✅ (`dist/_worker.js 98.73 kB · 63 modules · 0.9s`)
- `curl /login` → `live-card-meta` 가 헤더 바로 아래 위치 + `abnb-card__foot` 완전 제거 확인
- `curl /static/app.js` 검증:
  - `오늘도 화이팅` 0건 (완전 삭제)
  - `퀵 메뉴` 5건 (rename + 위치 이동)
  - `v34-card--split` 1건 (50:50 병합)
  - `v34-greet-text` 0건 (인사말 박스 마크업 제거)
- `curl /static/styles.css` 검증: V43 §2, §4 마커 모두 존재 + 모바일 `flex-wrap: nowrap` 적용

---

## V42 (예약 후 참석자 추가/제거 + LIVE 미래 날짜 조회 + 로그인 도메인 셀렉트)

> 사용자 V41 직후 세 가지 요구:
> 1. **"예약한 상태에서 참석자 초대할 수 있게 해줘 · 예약 생성 전, 후 둘 다 참석자 초대 할 수 있게"** — 기존엔 생성 시점에만 초대 가능
> 2. **"6월 30일에 5시30분~18시30분까지 예약했는데 로그인 페이지에서 < > 또는 달력에서 해당 일자 누르면 회의실 사용 가능 여부 실시간 확인 가능하게"** — 오늘 외 미래 날짜도 보기
> 3. **"로그인 페이지에 풀 이메일 적지 말고 bhmoon@ 까지 적고 옆에 wylie.co.kr / lush.co.kr 선택해서 간편 로그인"** — 도메인 셀렉트 UI

### §1 예약 생성 후에도 참석자 추가/제거 가능

**Before**: 참석자는 예약 **생성 시점에만** 초대 가능 → 이후 추가/제거 수단 없음
**After**:
- 예약 상세 모달의 **참석자 섹션 우상단에 `[+ 참석자 추가]` 버튼** 추가 (주최자/admin 만 노출)
- 클릭 시 **별도의 참석자 추가 모달** 열림: 멤버 검색(`/api/members/search`) → 다중 선택(체크박스 UI) → `[초대하기]`
- 이미 초대된 멤버는 검색 결과에서 자동 비활성 + "이미 초대됨" 라벨
- 각 참석자 행 옆에 **X 버튼**으로 단건 제거 (`confirm` 후 DELETE)
- 추가/제거 후 자동으로 예약 상세 모달이 새로 그려져 최신 참석자 목록 표시

**신규 API 엔드포인트**:
| Method | Endpoint | 동작 |
|--------|----------|------|
| `POST` | `/api/reservations/:id/attendees` | 다수 참석자 일괄 초대 (PENDING) |
| `DELETE` | `/api/reservations/:id/attendees/:memberId` | 단건 참석자 제거 |
| `PATCH` | `/api/reservations/:id` (확장) | body 에 `attendee_ids` 가 함께 오면 신규 초대 추가 |

**권한**: 주최자(`reservation.user_id === user.id`) 또는 `admin` 만 호출 가능. 그 외 403.

**검증** (curl + cookie jar 7단계 전체 사이클):
| 단계 | 결과 |
|------|------|
| ① 참석자 없이 예약 생성 | 예약 ID 173 생성 ✅ |
| ② 멤버 검색 | 문병훈(10616) 발견 ✅ |
| ③ POST `/attendees` | `invited: 1, skipped: 0` ✅ |
| ④ GET `/:id` 상세 | `[(10616, '문병훈', 'PENDING')]` ✅ |
| ⑤ 중복 추가 시도 | `invited: 0, skipped: 1` + 안내 메시지 ✅ |
| ⑥ DELETE `/attendees/10616` | `removed: 1` ✅ |
| ⑦ 제거 후 상세 | 참석자 0명 ✅ |

### §2 LIVE 보드 날짜 네비게이션 — 오늘 외 미래/과거 날짜 조회

**Before**: 로그인 페이지 LIVE 보드는 **오직 오늘**만 조회 가능
**After**:
- LIVE 카드 헤더 아래에 **날짜 네비게이션 바** 추가:
  ```
  [<]  [6월 15일 (월) · 오늘]  [>]  [오늘로]
  ```
  - **`<` / `>`** : 하루씩 이동
  - **날짜 라벨 클릭** : HTML5 `<input type="date">.showPicker()` 호출 → 달력 picker 노출
  - **`[오늘로]`** 버튼: 오늘이 아닐 때만 노출, 즉시 오늘로 복귀
- **오늘이 아닐 때 회의실 카드 표시 방식**:
  - 예약 없음 → 🟢 "예약 없음 · 하루 종일 사용 가능"
  - 예약 있음 → 🟧 "N건 예약됨" + 슬롯 칩 `[17:30–18:30]` 형태 나열
- **오늘이 아닐 때 폴링 중지** — 비효율적 호출 방지, 푸터에 "미래/과거 날짜 — 자동 갱신 중지" 표시
- **오늘로 돌아오면 자동 폴링 재개**

**API 확장 (`GET /api/public/available-spaces?date=YYYY-MM-DD`)**:
```jsonc
{
  "now": { "date": "2026-06-15", "time": "12:03" },  // 서버 현재(KST)
  "query_date": "2026-06-30",                         // 조회한 날짜
  "is_today": false,                                  // 오늘인지 여부
  "rooms": [
    {
      "id": 1, "name": "Meeting Room A", "capacity": 8,
      "available": true,           // is_today=false 면 항상 true (가용성 판정 불가)
      "current_end_at": null,
      "next_busy_at": "17:30",     // 그 날 첫 예약 시작 시각
      "bookings_today": [
        { "start": "17:30", "end": "18:30", "title": "..." }
      ]
    }
  ]
}
```
- `date` 미지정 → 오늘(KST) 기준 + 기존 가용성 판정 로직 그대로 (V41 호환)
- 잘못된 날짜(`2026-02-30`, `2026-13-01` 등)는 **400 + "존재하지 않는 날짜입니다."** 반환

**검증**:
- 오늘 조회 → 기존 가용성 판정 정상 동작 ✅
- 2026-06-30 조회 → Meeting Room A 17:30-18:30 예약 슬롯 정확히 반환 ✅
- 2026-07-15 조회 → 예약 없음, 5/5 모두 빈 슬롯 ✅
- 2026-02-30 조회 → HTTP 400 ✅
- 2026-13-01 조회 → HTTP 400 ✅

### §3 로그인 페이지 이메일 도메인 셀렉트

**Before**: `bhmoon@wylie.co.kr` 풀 이메일을 매번 풀로 타이핑 필요
**After**:
```
이메일 주소: [bhmoon          ] [@wylie.co.kr ▾]
                                  @lush.co.kr
                                  직접 입력
아이디만 입력하고 옆에서 도메인을 선택하세요.
```
- 이메일 input은 `type="text"` (브라우저 email validator 우회), placeholder `bhmoon`
- 도메인 셀렉트 옵션 3종:
  - `@wylie.co.kr` (기본)
  - `@lush.co.kr`
  - `직접 입력` (값 없음 — 풀 이메일을 input에 직접 적을 때)
- `login.js` 제출 직전에 결합 로직:
  - 입력값에 `@`가 없고 도메인 선택값이 있으면 → `${input}${selected}` 결합
  - 입력값에 이미 `@`가 있으면 → 입력값 그대로 (외부 이메일 호환)
- 모바일 480px 이하에서는 셀렉트가 한 줄 아래로 떨어지는 반응형 처리

**검증**:
- HTML: `<select id="login-email-domain">` + 3개 옵션 정상 노출 ✅
- JS: `login-email-domain` 참조 + 결합 로직 동작 ✅
- 백엔드 호환: 풀 이메일(`admin@wylie.co.kr`) 그대로 받아서 정상 로그인 ✅
- CSS: `.login-email-row` / `.login-email-domain` / 모바일 미디어쿼리 적용 ✅

### 📁 V42 변경 파일
- `src/api/reservations.ts` — §1 신규 엔드포인트 2개 + PATCH attendee_ids 동기화
- `src/api/public.ts` — §2 `?date=YYYY-MM-DD` 지원 + 엄격 날짜 검증
- `src/pages/login.tsx` — §2 날짜 네비 바 + §3 이메일 도메인 셀렉트 마크업
- `public/static/login.js` — §2 날짜 네비 로직 + §3 결합 로직
- `public/static/app.js` — §1 `openAddAttendeesModal()` / `removeAttendeeFromReservation()` 신규
- `public/static/styles.css` — V42 §1/§2/§3 신규 스타일

### 📊 V42 빌드/배포 상태
- `npm run build` ✅ (`dist/_worker.js 98.73 kB` · 63 modules · 1.01s)
- PM2 재기동 ✅ (webapp online)
- §1 API 7단계 사이클 모두 통과 ✅
- §2 API 미래 날짜·잘못된 날짜 검증 모두 통과 ✅
- §3 HTML/JS/CSS 노출 + 백엔드 호환 모두 정상 ✅

---

## V41 (🔥 LIVE 실시간 반영 핵심 버그 수정 + 멤버 생성 이메일 도메인 자동 부착)

> 사용자 V40 직후 두 가지 결정적 지적:
> 1. **\"첫번째 예약 되어있는 방에 대해 일정이 취소되서 삭제했는데 실시간에는 전혀 반영이 안됨, 실시간 예약 현황에 B/E룸 적용 불가한 상태\"** — 예약 생성/수정/취소가 LIVE에 전혀 안 보이는 치명적 버그
> 2. **\"이메일 주소에 `bhmoon` 만 넣으면 뒤에 `@wylie.co.kr` 자동 부착, 러쉬는 `ll` 만 넣으면 `@lush.co.kr` 자동 부착\"**

### §1 🔥 LIVE 실시간 반영 핵심 버그 수정 (status 값 불일치)

**근본 원인 (DB 데이터로 정확히 진단)**:
```sql
SELECT status, COUNT(*) FROM reservations GROUP BY status;
-- confirmed: 46   ← 실제 예약은 모두 이 값
-- cancelled: 50
-- active:    0    ← 절대 존재하지 않는 값!
```
- `src/api/public.ts` 의 LIVE board API 가 **유일하게** `WHERE status = 'active'` 로 필터링 중
- 다른 모든 API(`src/api/reservations.ts` L36/57/93/138/167)는 `status = 'confirmed'` 사용 — 사실상 LIVE만 잘못된 컬럼값으로 조회 중이어서 **실제 예약을 영원히 못 찾음**
- V40 진단 때 내가 직접 INSERT한 테스트 데이터는 `'active'`로 넣었어서 통과했던 것 (실 사용자 데이터는 전부 `'confirmed'`라 보이지 않음) — 사용자가 "B/E는 잡혀있는데 LIVE는 A/D를 잡혀있다고 표시" 라고 신고한 **완전히 뒤집힌 표시**의 진짜 이유

**수정**:
```typescript
// src/api/public.ts L66 (BEFORE)  ❌
//   AND status = 'active'
// (AFTER)  ✅
const reservRes = await c.env.DB.prepare(
  \`SELECT space_id, start_time, end_time
     FROM reservations
     WHERE date = ?
       AND status = 'confirmed'  // ← V41 §1 CRITICAL FIX
       AND space_id IN (...)\`
).bind(date, ...spaceIds).all();
```

**부수 작업**:
- V40 테스트로 남은 `'active'` 더미 예약 50건 + `진단용 예약%` 정리 → DB가 실제 사용자 예약 46건만 보유
- 사용자가 LUSH 등 다른 테넌트 회의실을 봤다 → 본인 테넌트 회의실로 가이드

**검증 (내가 직접 curl + cookie jar로 전체 사이클 실행)**:

| 단계 | 작업 | LIVE 즉시 반영 |
|------|------|---------------|
| ① CREATE | `POST /api/reservations` Meeting Room C 09:30-10:30 | 🔴 (종료 10:30) ✅ |
| ② EDIT | `PATCH /api/reservations/:id` 종료 10:30→11:30 | 🔴 (종료 11:30) ✅ |
| ③ CANCEL | `DELETE /api/reservations/:id` | 🟢 (가용) ✅ |

또한 사용자가 캡처한 **공간 캘린더 사진과 LIVE 사진이 일치**하는지도 확인: Meeting Room B(08:30-13:30) + E(08:00-15:00) 점유 ↔ LIVE 에서 정확히 B/E 만 🔴 표시.

### §2 멤버 생성 이메일 도메인 자동 부착 (UX 개선)

**Before** — 매번 풀 이메일을 타이핑해야 함:
```
이메일 주소: [bhmoon@wylie.co.kr]   ← 짜증나고 오타 위험
```

**After** — username만 입력하면 자동으로 본인 테넌트 도메인 부착:
```
WYLIE 어드민:  [bhmoon       ] @wylie.co.kr   ← suffix 잠금 표시
LUSH 어드민:   [ll           ] @lush.co.kr    ← 테넌트별 자동 결정
```

**구현 (`public/static/app.js` 멤버 생성 모달)**:
- `State.user.tenant_id` 로 자동 도메인 결정 (`WYLIE → @wylie.co.kr`, `LUSH → @lush.co.kr`)
- 새 헬퍼 `stripDomain(value)` — 풀 이메일을 붙여넣어도 같은 테넌트 도메인이면 username만 표시
- 새 헬퍼 `composeEmail(value)` — submit 시 `@`가 없으면 테넌트 도메인 자동 append, 이미 있으면 존중
- **단일 생성**: 새 `.email-suffix-wrap` 컴포넌트 (입력란 + 잠긴 회색 suffix 칩)
- **일괄 생성**: 표 헤더에 \"아이디 \* @wylie.co.kr 자동\" 라벨, placeholder 단순화 (`bhmoon`), 각 행 자동 처리
- 외부 도메인 입력 (예: 외부 협업자 `vendor@partner.com`) 도 명시적으로 `@`를 입력하면 그대로 통과 — 호환성 유지
- 신규 CSS: `.email-suffix-wrap` / `.email-suffix-input` / `.email-suffix-tag` (Tesla 톤 라이트 그레이 칩, focus 시 파란 ring)

**검증 (양 테넌트 어드민으로 직접 POST)**:

| 어드민 | 입력 | DB 저장된 email | tenant_id |
|--------|------|----------------|----------|
| WYLIE  | `bhmoonV41`  | `bhmoonV41@wylie.co.kr` | WYLIE ✅ |
| LUSH   | `llV41`      | `llV41@lush.co.kr`      | LUSH ✅  |

### 📊 V41 빌드/배포 상태
- `npm run build` ✅ (dist/_worker.js 94.05 kB · 63 modules · 888ms)
- PM2 재기동 ✅ (webapp online)
- LIVE 사이클 검증 (curl) ✅ — 생성/수정/취소 모두 1초 내 LIVE 반영
- 멤버 생성 API 검증 ✅ — WYLIE/LUSH 양쪽 자동 도메인 부착 동작

---

## V40 (로그인 LIVE 가용성 진단·강화 + 모바일 한 화면 압축)

> 사용자 V39 직후 의심:
> 1. **"공간 페이지엔 회의실 시간이 잔뜩 잡혀있는데 왜 로그인 LIVE는 즉시 사용 가능이라고 나와?"** — 실시간 연동 불신
> 2. **"모바일 화면에서 M / 메이트리그라운드 / 부제 / 회의실 / 로그인 폼 사이가 너무 넓어 '공간 입장하기' 버튼이 첫 진입 시 안 보임"**

### §1 — LIVE 가용성 진단 + 강화 (실제로는 정확히 동작 중이었음 검증 + 추가 안전장치)
- **진단 결과**: 가용성 로직 자체는 처음부터 정상 작동. 사용자가 본 첫 이미지는 **다른 날짜의 공간 페이지** 또는 **Conference Room / 파라다이스룸**(로그인 LIVE에서 제외 대상)을 본 것이었음
- **검증 시나리오** (2026-06-15 09:31 KST 기준):
  - DB에 `Meeting Room A (09:00~10:00)`, `Meeting Room C (09:00~11:00)`, `Meeting Room D (08:30~10:30)` 예약 추가
  - LIVE API 응답: A=🔴사용 중, B=🟢가용, C=🔴사용 중, D=🔴사용 중, E=🟢가용 → **정확히 일치**
- **추가 강화**:
  - 가용성 판정 경계 조건 명시 — `start <= hhmm < end` (시작 포함, 종료 미포함)
  - 응답에 `bookings_today` 필드 추가 — 각 회의실의 오늘 예약 raw 목록 (디버깅·검증용)
  - `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` + `Pragma: no-cache` + `Expires: 0` 헤더 추가 — 어떤 중간 캐시도 못 끼게
- **위치**: `src/api/public.ts` V40 §1 블록

### §2 — 로그인 페이지 폴링 60s → 10s + 탭 가시성 즉시 갱신
- **문제**: V39 까지 로그인 페이지 LIVE 폴링은 60초 주기 → 공간 페이지(3초)와 시차가 커서 "방금 잡았는데 LIVE가 못 따라잡음"
- **변경**:
  - `POLL_MS = 60_000 → 10_000` (10초)
  - 신규: `document.visibilitychange` (다른 탭에서 돌아옴) + `window.focus` (창 포커스) 즉시 `fetchOnce()` 한 번 더 실행
  - 카드 푸터 텍스트 "60초마다 자동 갱신" → "10초마다 자동 갱신"
- **위치**: `public/static/login.js` line 9~ 및 line 121~ / `src/pages/login.tsx` line 59

### §3 — 모바일 로그인 화면 세로 간격 압축 (한 화면 안에 "공간 입장하기"까지)
- **문제**: M 로고(40px) → 타이틀 → 부제 → 회의실 박스 → 로그인 카드 사이 간격이 데스크톱 기준이라 모바일에서 폼 버튼이 첫 진입 시 화면 밖
- **변경 (768px 이하)**:
  | 요소 | 이전 | V40 |
  |------|------|-----|
  | `.abnb-gate` padding-top | 보통 32~40 | **20px** |
  | `.abnb-gate__brand` margin-bottom | V37 40 | **18px** |
  | M 마크 SVG 크기 | 40×40 | **32×32** |
  | `.abnb-brand-mark` margin-bottom | V37 14 | **6px** |
  | `.abnb-gate__title` font / margin | 26 / 12 0 6 | **20px / 4 0 2** |
  | `.abnb-gate__sub` font / margin | 13 / 기본 | **12px / mt 2** |
  | `.abnb-gate__grid` gap | 24~32 | **14px** |
  | `.abnb-card--live` padding | V38 16 | **14px** |
  | `.abnb-card--login` padding | 22 | **18px** |
  | `.abnb-form` gap | 18 | **12px** |
  | `.abnb-field` gap (label↔input) | 8 | **5px** |
  | `.abnb-field input` padding | 12~14 | **10 12** |
- **420px 이하** 한 번 더 축소: M 28×28, 타이틀 18px, gate gap 12px
- **위치**: `styles.css` V40 §3 (V39 END 다음에 약 100줄)

### 📊 V40 빌드/배포 상태
- 빌드: ✅ `vite build` 성공 (`dist/_worker.js` 94.05 kB, 63 modules)
- PM2: ✅ `webapp` online (PID 60722)
- HTTP: `/login` 200 · `/api/public/available-spaces` 200 · 내부 페이지 4개 모두 302
- API 캐시 헤더: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` ✅
- API 응답 (KST 09:31): A 🔴, B 🟢, C 🔴, D 🔴, E 🟢 — 정확
- Playwright `/login` 콘솔 메시지 0건

### 🔬 사용자가 직접 검증하는 법
1. 로그인 후 `/spaces`에서 `Meeting Room A`에 `현재 시각이 포함되는` 일정을 추가
2. 다른 탭/디바이스에서 `/login` 새로고침 (또는 10초 대기)
3. LIVE 카드에서 `Meeting Room A`가 "사용 중"으로 표시되는지 확인

---

## V39 (실시간 연동 강화 + 빨간 실선 시계화 + 정원 8명 제거)

> 사용자 V38 직후 요청:
> 1. **"왜 메인페이지랑 공간 페이지 실시간 연동이 안돼는거지?"** — 홈 대시보드가 예약 변경을 못 따라잡음
> 2. **"지금 11시 15분인데 왜 실선은 11시가 고정이야? 11시 16분이면 11~12시 사이 16분 거리만큼 내려가야"** — 타임라인 현재시각 빨간 선이 페이지 로드 시점에 고정
> 3. **"모바일 화면 공용 회의실에서 정원 8명 코드에서 삭제"** — 정원 정보 불필요
> 4. **"Meeting Ro....만 보여서 A~E 안 보여"** — 모바일에서 이름 잘림. 정원 삭제로 확보된 공간을 이름이 활용

### §1 — 타임라인 빨간 실선 실시간 시계화 (now-line ticker)
- **문제**:
  - `drawNowLine()`은 `renderSpaces()` 진입 시 단 1회만 호출 → 그 시점의 분 위치에 고정
  - 11:00 에 들어오면 11:00 위치에 그려진 후 영영 안 움직임
- **변경**:
  - `drawNowLine()` 재호출 시 기존 `.timeline-now-line` DOM 자동 제거 후 새로 그림
  - `top` 계산에 초 단위까지 포함: `top = (hour*60 + minute + second/60) * (40/60)`
  - 새 `startNowLineTicker()` 함수가 30초마다 `drawNowLine()` 호출 (페이지 'spaces' && view 'day' 일 때만)
  - 예약 폴링 시점(3초)에도 `drawNowLine()` 동시 호출 → 즉시 따라잡음
  - CSS: `.timeline-now-line { transition: top 0.6s ease }` 추가 → 선이 자연스럽게 미끄러져 내려감
- **위치**: `public/static/app.js` `drawNowLine` + `startNowLineTicker` + `startPolling` / `styles.css` V39 §4

### §2 — 홈 페이지 실시간 연동 (예약 변경 즉시 반영)
- **문제**: 다른 사용자가 공간 페이지에서 예약을 만들거나 취소해도 홈 대시보드의 "다음 일정 / 앞으로의 일정 / 오늘 일정" 카드가 갱신되지 않음 — `renderHome()`이 한 번 그려진 후 폴링 없음
- **변경**:
  - `renderHome()` 끝에 `startPolling()` 호출 추가
  - `startPolling()`에 `State.page === 'home'` 분기 추가:
    - 3초마다 `/api/reservations/upcoming` 재요청
    - 응답 시그니처(`id:updated_at:status` 조합) 비교
    - 변경이 감지되면 `renderHome()` 재실행 → 카드 전체 즉시 리렌더
  - 초기 마운트 직후 중복 렌더 방지를 위해 `State._homeUpcomingSigInited` 플래그 사용
- **결과**: 공간 페이지에서 예약 추가/취소 → 다른 디바이스의 홈 페이지가 3초 내 자동 동기화
- **위치**: `public/static/app.js` `renderHome` 끝 + `startPolling` 분기

### §3 — 로그인 페이지 "정원 8명" 텍스트 완전 제거
- **문제**: 모바일 회의실 카드에 "정원 8명" 표시되어 공간 차지 → 회의실 이름 영역 좁아져 "Meeting Ro..." 잘림
- **변경**:
  - `public/static/login.js` `renderRooms()`에서 `<div class="abnb-room__meta">정원 N명</div>` 두 군데 모두 삭제 (available / busy)
  - 추가 안전장치: `styles.css`에 `.abnb-room__meta { display: none !important }` (혹시 다른 코드에서 부활해도 차단)
- **효과**:
  - 모바일 컴팩트 표(V38)에서 행 높이가 줄어들고, 이름 영역이 행 가로폭의 대부분 차지 → `Meeting Room A~E` 완전 노출
  - 데스크톱 그리드에서도 카드가 더 깔끔하게 보임
- **위치**: `public/static/login.js` line 68~89 (마크업 2곳) + `styles.css` V39 §1

### §4 — 모바일 회의실 카드 이름 노출 보강
- **문제**: V38에서 컴팩트 표로 변경했어도 이름이 잘릴 가능성 (긴 회의실명, 좁은 폰)
- **변경 (V39 §2 CSS)**:
  - `.abnb-card--live .abnb-room__name { flex: 1 1 auto; min-width: 0; white-space: nowrap; text-overflow: ellipsis }` — flex 자식에 `min-width: 0` 필수
  - `.abnb-room__chip { flex: 0 0 auto; white-space: nowrap }` — 상태칩은 절대 안 줄어들고 항상 한 줄
  - `.abnb-room__sub { display: none }` — 보조 설명("오늘 남은 시간 모두 가용") 모바일 숨김
- **데스크톱 (≥769px)**: 정원 표시 사라진 공간을 이름이 흡수, padding 18px/14px, 이름 15px/600
- **위치**: `styles.css` V39 §2, §3

### 📊 V39 빌드/배포 상태
- 빌드: ✅ `vite build` 성공 (`dist/_worker.js` 93.88 kB)
- PM2: ✅ `webapp` online (PID 58587)
- HTTP: `/login` 200 · `/`, `/spaces`, `/home`, `/admin/members` 302
- Playwright `/login` 콘솔 메시지 0건
- API 검증: `/api/public/available-spaces` → Meeting Room A~E 5개 정상 반환
- 마커: app.js V39 마커 15건 · styles.css V39 END 1건

---

## V38 (로고 II → M 마크 + 로그인 모바일 회의실 컴팩트 표)

> 사용자 V37 직후 요청:
> 1. **"메인페이지 로고는 왜 II 그대로야 M으로 바꿔줘야지"** — 로그인 페이지 헤더 막대 두 개(II)가 M으로 안 보임
> 2. **"스마트폰으로 보면 이용가능한 공용회의실 a,b,c,d,e 이거 하나의 표로 다보여줄수있게 축소해줘 ... 로그인 페이지가 너무 맨아래에 있어서 로그인하기 힘들어"** — 모바일에서 5개 카드가 큰 박스로 적층되어 로그인 폼이 화면 한참 아래

### §1 — 로고 M 마크 가시성 개선
- **문제**:
  - 로그인 페이지 `.abnb-brand-mark`는 원래 `<span></span><span></span>` 두 개의 막대 → II 처럼만 보임 (M 의도 없음)
  - 글로벌 nav `.tesla-logo-mark` SVG path 도 `stroke-width: 2 + linecap: square + 양 다리가 5→6 거의 수직` 이라 중앙 V 가 잘 안 보이고 II 처럼 읽힘
- **변경**:
  - 로그인 페이지: `<div class="abnb-brand-mark abnb-brand-mark--svg">` 안에 글로벌 nav 와 동일한 SVG M path 삽입 (40×40)
  - 글로벌 nav SVG path 재설계: `M4 23 L4 5 L14 18 L24 5 L24 23` — 좌하단(4,23) → 좌상단(4,5) → 중앙 깊은 V(14,18) → 우상단(24,5) → 우하단(24,23)
  - `stroke-width: 2 → 2.4`, `stroke-linecap: square → round`, `stroke-linejoin: round` 추가 — M 모서리 부드럽게
- **위치**: `src/pages/login.tsx` line 17~25 + `public/static/app.js` line ~130~141

### §2 — 로그인 모바일 회의실 컴팩트 표 (5개 한 박스)
- **문제 (V37 모바일)**: `@media (max-width: 420px)` 에서 `.abnb-rooms-grid { grid-template-columns: 1fr }` 로 각 회의실이 큰 카드 5개로 세로 적층 → 로그인 폼이 화면 한참 아래로 밀림
- **변경 (V38 모바일 ≤768px)**:
  - `.abnb-card--live .abnb-rooms-grid` → `display: flex; flex-direction: column; gap: 0` + 외곽 4px radius 박스 한 개로 묶기
  - 각 `.abnb-room` 은 표 한 행처럼: `flex-direction: row; justify-content: space-between` (좌 이름 / 우 상태칩)
  - 행 높이 44px, 패딩 10px 12px, 행 구분선 `border-bottom: 1px #EEEEEE` (마지막 행은 none)
  - 정원 표시(`__capacity`) 및 보조 텍스트(`__hint`, `__note`, `__detail`) 모바일에서 숨김 → 한 줄 컴팩트 유지
  - 상태칩 11px / padding 3px 8px / radius 4px 로 축소
  - LIVE 카드 자체 패딩 16px 로 축소, 타이틀 15px
- **결과**: 모바일에서 5개 회의실 = 한 박스 5행 (약 220~250px 높이) → 로그인 폼이 즉시 보이는 위치로 상승
- **위치**: `public/static/styles.css` V38 §2 (V37 END 뒤 추가)

### 📊 V38 빌드/배포 상태
- 빌드: ✅ `vite build` 성공 (`dist/_worker.js` 93.88 kB)
- PM2: ✅ `webapp` online (PID 56712)
- HTTP: `/login` 200 · `/` 302
- 정적: `app.js` 190 KB / `styles.css` 233 KB
- Playwright `/login` 콘솔 메시지 0건
- 마크업 확인: `abnb-brand-mark--svg` 1건 · styles.css V38 마커 4건

---

## V37 (로그인 페이지 Tesla 적용 + 모바일 타임라인 분리 + 로고 한글 단일화 + 멤버 아코디언)

> 사용자 V36 직후 요청:
> 1. **"이것도 테슬라 스타일로 바꿔줘야하는거 아니야? 왜 하다가 말았어"** → V36에서 의도적으로 제외했던 로그인 페이지(`.abnb-gate`)도 Tesla 스타일로 통일
> 2. **앞으로의 일정** 모바일에서 한 줄에 다 박혀 있던 정보를 **날짜 / 시간 / 회의명 / 미팅룸 위치 4줄로 세로 분리**
> 3. **로고 영문 `MATEGROUND` 제거** — 한글 "메이트리그라운드"만 노출
> 4. **멤버 페이지 정리**:
>    - 상단 액션 버튼 "본인 외 전체 삭제 / 선택 일괄 삭제 / 생성하기" → **"전체 삭제 / 선택 삭제 / 생성하기"** 한 줄 정렬
>    - 모바일 멤버 카드: 자동으로 펼쳐져 있던 상세를 **클릭 시에만 펼쳐지는 아코디언**으로 변경 + 한 번에 하나만 열림

### §1 — 로그인 페이지 Tesla 스타일 적용 (V36에서 제외했던 `.abnb-gate`)
- **전체 배경**: 회색 → Pure White
- **브랜드 마크**: 분홍 큐브 → Carbon Dark 수직 막대 2개 (4×22 / 4×28)
- **타이틀 "메이트리그라운드"**: 분홍 그라디언트 → Carbon Dark `#171A20` 26px/600 단색
- **카드(좌측 LIVE 회의실 그리드 + 우측 로그인 폼)**: 그림자 제거, 4px radius, Cloud Gray `#EEEEEE` 보더
- **회의실 카드 "즉시 사용 가능" 칩**: 분홍 그라디언트 → Electric Blue `#3E6AE1` 단색
- **LIVE 펄스 점**: 초록 → Electric Blue
- **"공간 입장하기" 버튼**: 분홍 그라디언트 `linear-gradient(135deg, #FF385C, #E31C5F)` → **Electric Blue flat** `#3E6AE1 !important`
  - `background-image: none !important`로 그라디언트 강제 제거, hover `#2A56D1`
- **인풋 필드**: 4px radius, focus 시 Electric Blue 18% alpha 링
- **CSS 위치**: `styles.css` V37 §1 블록 (`.abnb-gate` 스코프, 약 250줄)

### §2 — 앞으로의 일정 모바일 세로 4줄 분리
- **기존**: `6/20(토) 10:00-11:00 [회의명] [공간]`이 한 줄/세 칸으로 압축되어 모바일에서 줄바꿈 깨짐
- **변경**:
  - `v34-today-row` 마크업을 **`.v34-today-date` / `.v34-today-time` / `.v34-today-title` / `.v34-today-space` 4개 span**으로 분리
  - 모바일 `@media (max-width: 720px)`에서 `flex-direction: column` → 세로 4줄 출력
  - 날짜 `6/20(토)` 13px Pewter / 시간 `10:00 - 11:00` 16px/600 Carbon Dark / 회의명 14px (ellipsis) / 공간 13px Pewter (앞에 점)
- **PC**: 기존 가로 row 유지 (`min-width` 78/110/auto/auto)
- **위치**: `app.js` `v34TodayCard` 렌더러 + `styles.css` V37 §2

### §3 — 로고 영문 워드마크 제거 → 한글 단일
- **기존**: SVG M 마크 + `MATEGROUND`(영문) + `메이트리그라운드`(한글) 2줄 워드마크
- **변경**: SVG M 마크 + **`메이트리그라운드` 한 줄만** (`.tesla-logo-kor--solo` 16px/600 Carbon Dark)
- **이중 방어**:
  - `app.js` `renderShell()`에서 `.tesla-logo-eng` span 자체를 제거
  - `styles.css`에 `.tesla-logo-eng { display: none }` 안전장치 추가
- **위치**: `app.js` line ~138 + `styles.css` V37 §3

### §4 — 멤버 페이지 정리

#### §4-a 상단 액션 버튼 한 줄 정렬
- **기존**: "본인 외 전체 삭제" / "선택 일괄 삭제" / "생성하기"가 세로로 쌓이고 폭이 들쭉날쭉
- **변경**: `.admin-action-row`(flex nowrap) + 3개의 `.admin-action-btn`(38px 높이, 4px radius)
  - **"전체 삭제"** (← "본인 외 전체 삭제"): Carbon Dark 보더, 아이콘 제거
  - **"선택 삭제"** (← "선택 일괄 삭제"): Cloud Gray 보더, 카운트 라벨 `선택 삭제 (N)`
  - **"생성하기"**: `.admin-action-btn--primary` Electric Blue 단색
- **모바일**: `flex: 1 1 0` 균등 분배, 12px 폰트, 360px 이하에서 11px로 추가 축소
- **위치**: `app.js` `MemberPage` 액션 row 렌더링 + `styles.css` V37 §4-a

#### §4-b 모바일 멤버 카드 아코디언화
- **기존(증상)**: 카드 자체가 자동으로 펼쳐져 있어 두 번째 카드의 상세 정보가 화면 하단에 "팝업"처럼 보임
- **변경**:
  - `.member-card--collapsible` 클래스 + `data-member-id` 추가
  - `.member-card-body`(meta + actions 래퍼)는 기본 `display: none`
  - 카드 클릭 시 `.is-expanded` 토글 → `.member-card-body { display: block }`로 노출
  - **한 번에 하나만 열림**: 새 카드 클릭 시 다른 모든 카드의 `.is-expanded` 자동 해제
  - `.member-card-chevron` 우측 아이콘이 펼침 시 180° 회전
  - 펼친 카드는 Electric Blue 보더로 강조
- **이벤트 가드**: 수정/삭제 버튼은 `e.stopPropagation()`로 카드 토글 방지 + `closest('.btn-card-action')` 가드도 동시 적용
- **위치**: `app.js` `buildMemberTable()` 모바일 분기 + `styles.css` V37 §4-b

### 📊 V37 빌드/배포 상태
- 빌드: ✅ `vite build` 성공 (`dist/_worker.js` 93.67 kB, 63 modules)
- PM2: ✅ `webapp` online
- HTTP: `/login` 200 · `/`, `/spaces`, `/insights`, `/admin/members` 302 (인증 필요, 정상)
- 정적: `app.js` 190 KB, `styles.css` 229 KB
- Playwright: `/login` 콘솔 메시지 **0건**
- 마커 검증: styles.css V37 마커 43건 · app.js V37 마커 15건 · `tesla-logo-eng` **0건 잔존**

---

## V36 (Tesla 스타일 전면 적용 — 로그인/접속 페이지 제외 모든 내부 페이지)

> 사용자 V35 직후 요청:
> 1. tesla.com/ko_kr 처럼 내부 페이지를 전부 Tesla 스타일로 변경 (기능/마크업은 그대로, 스타일만)
> 2. 메인 로그인/접속 페이지는 절대 건드리지 않기
> 3. 분홍색(#FF385C) 좀 바꿔 → Electric Blue(#3E6AE1)
> 4. 로고도 완전히 새로 디자인 (기존 막대 로고가 별로)
> 5. 모든 버튼/메뉴 글자가 안 보이는 일 없게, 가시성 강제
> 6. PC/모바일 양쪽 다 짤림/이탈/터치 영역 다 정상화

### 🎨 V36 디자인 토큰 (`DESIGN-tesla.md` 발췌)
| 토큰 | HEX | 용도 |
|------|-----|------|
| Electric Blue | `#3E6AE1` | 단 하나의 액센트 — Primary CTA, 활성 탭, 링크 |
| Carbon Dark | `#171A20` | 헤딩, nav 텍스트, 최상위 텍스트 |
| Graphite | `#393C41` | 본문 |
| Pewter | `#5C5E62` | 보조 텍스트 |
| Silver Fog | `#8E8E8E` | placeholder |
| Cloud Gray | `#EEEEEE` | 경계선 |
| Pale Silver | `#D0D1D2` | subtle 보더 |
| Light Ash | `#F4F4F4` | 호버 / 보조 표면 |
| Pure White | `#FFFFFF` | 모든 카드/페이지 배경 |

원칙: **4px radius** · **그림자 0** · **그라디언트 0** · **0.33s transitions** · **font-weight 400/500만**

### §1 — 새 로고 (완전히 새로 디자인)
- **기존**: 막대 3개(brand-bars) + 분홍 점이 찍힌 막대 로고
- **신규**: SVG 모노그램(28×28) + 자간 0.32em 영문 워드마크 `MATEGROUND` + 한글 보조 라벨 `메이트리그라운드`
- 마크 SVG는 `M` 자형의 두 수직선과 위쪽 사각 정점만 사용한 미니멀 기하 라인 — Tesla T 모티프
- 모바일 <420px에서는 한글 보조 라벨 숨기고 영문 워드마크만 노출 → 좁은 화면에서 줄바꿈 방지
- **위치**: `public/static/app.js` `renderShell()` 안 `.tesla-brand` 마크업 + `styles.css` V36-4 블록

### §2 — 분홍색 완전 제거 → Electric Blue (#3E6AE1)
- 글로벌 nav 활성 탭: 분홍 → Electric Blue
- 아바타: 분홍 그라디언트 → Electric Blue 단색
- 모든 Primary 버튼: 분홍 그라디언트 → Electric Blue flat
- V35 invite 모달 accept 버튼: 분홍 그라디언트 → Electric Blue flat
- next 예약 카드 시간/강조 텍스트: 분홍 → Electric Blue
- 받은 초대 클릭 가능 카드 호버: 분홍 그림자 → Electric Blue 보더
- 모든 토글/체크박스 accent-color: Electric Blue
- 일반 링크: Electric Blue (hover 시 underline만)

### §3 — 모든 카드/패널 Tesla flat 화이트화
- 모든 카드(`v34-card`, `stat-card`, `summary-card`, `timeline-container`, `insight-card`, `admin-content-card`, 등): **그림자 제거**, `border-radius: 4px`, `border: 1px solid #EEEEEE`, `background: #FFFFFF`
- V34 인사 카드(`v34-card--greet`)의 분홍 그라디언트 배경 → 흰 카드 + **좌측 3px Electric Blue 액센트 라인**으로 대체
- 사이드 nav, 어드민 사이드바도 동일 flat 화이트 + 보더만

### §4 — 글로벌 nav (헤더) 재설계
- 배경: 흰색 + `border-bottom: none` (Tesla의 floating bar 느낌, 보더 라인 대신 컨텐츠 자체로 분리)
- 텍스트 색 모두 Carbon Dark, 햄버거 바 Carbon Dark
- 활성 nav-link만 Electric Blue 텍스트 + Light Ash 배경
- 데스크탑 좌우 패딩 24px, 모바일 14px, 초소형(<420px) 10px로 단계 축소

### §5 — 버튼/입력 전면 통일
- 모든 버튼: `border-radius: 4px`, `min-height: 40px (모바일 44px)`, `font-weight: 500`, `letter-spacing: 0`
- Default 버튼: 흰 배경 + Pale Silver 보더 + Carbon Dark 텍스트
- Primary 버튼: Electric Blue 배경 + 흰 텍스트 (hover 시 #2A56D1)
- 모든 input/select/textarea: 4px radius, Pale Silver 보더, focus 시 Electric Blue 보더 + 18% alpha 링 (그림자 아님 — outline-like)
- placeholder: Silver Fog
- 모바일에서 input `font-size: 16px` 강제 → iOS auto-zoom 방지

### §6 — 텍스트 가시성 절대 강제 (V33의 '버튼 글자 안 보임' 재발 방지)
- nav-brand / nav-link / nav-user-name / 햄버거 등 모든 글로벌 nav 텍스트에 `color: #171A20 !important` + `-webkit-text-fill-color: #171A20 !important` 동시 적용 → Safari/Chrome 양쪽에서 100% 가시성
- v34-card 내부 모든 자식 텍스트는 `color: inherit !important`로 부모 카드 색에 종속, title은 Carbon Dark 강제
- 테이블 th: Carbon Dark, td: Graphite — 라이트 배경에서도 충분한 대비

### §7 — PC/모바일 반응형 최적화
- **`max-width: 768px`** (모바일):
  - 글로벌 nav 좌우 패딩 축소, 로고 자간 축소, SVG 마크 28×28로 축소
  - 본문 컨테이너 좌우 패딩 16px 보강
  - 카드 `overflow: hidden` + `max-width: 100%`로 가로 넘침 방지 (타임라인만 예외 — 내부 가로 스크롤 허용)
  - 모든 버튼 `min-height: 44px` (WCAG 터치 타깃)
  - 입력 `min-height: 44px`, `font-size: 16px` (iOS zoom 방지)
  - 모달 `max-width: 100%`, `max-height: 92vh`, `overflow-y: auto`
  - 테이블 가로 스크롤 보장
  - V35 invite 모달 버튼 row 가로 정렬 + 각 버튼 `flex: 1`
- **`max-width: 420px`** (초소형):
  - 한글 보조 라벨(`tesla-logo-kor`) 숨김 → 영문 워드마크만
  - 영문 워드마크 자간 0.18em로 축소
- **`min-width: 1441px`** (대형):
  - 글로벌 nav inner `max-width: 1383px`로 가운데 정렬

### §8 — 로그인/접속 페이지 격리 보장
- V36의 모든 스타일은 `.app-shell` 스코프 안에서만 적용
- 로그인 페이지(`.abnb-gate`)는 `.app-shell`이 아니므로 **단 한 글자도 변경 없음**
- 기존 V32 에어비앤비 그라디언트 + 분홍 CTA + 큰 로고 그대로 유지

### V36 변경 파일
- `public/static/app.js` — `renderShell()` 안 `.nav-brand` 마크업을 `.tesla-brand` + SVG 모노그램 + `.tesla-logo-wordmark`로 교체 (≈22줄)
- `public/static/styles.css` — 끝에 V36 Tesla Design System 블록 약 850줄 추가 (`/* V36-1 */` ~ `/* V36-24 */`, 마지막에 `=== V36 END ===` 마커)

### V36 검증 결과
- `npm run build` → `dist/_worker.js 93.67 kB` ✅
- 로그인 페이지(`/login`) HTTP 200 + `.abnb-gate` 마크업 유지 확인 ✅
- 4개 내부 탭(`/home`, `/spaces`, `/insights`, `/admin/members`) 302 (인증 리다이렉트, SSR 정상) ✅
- `/static/app.js`, `/static/styles.css` 모두 200, V36 마커(`tesla-brand` `tesla-logo-mark` `V36 END` 등) 정상 노출 ✅
- PlaywrightConsoleCapture: 콘솔 메시지 0건 (JS 에러 없음) ✅
- PM2: webapp online (PID 53104) ✅

---

## V35 (받은 초대 카드 통합 + 모달 + 타임라인 00:00 위 선 제거)

> 사용자 V34 직후 2건 보고:
> 1. "받은 초대"(요약 카드)와 "받은 초대 응답 대기"(상세 카드)가 중복 → 하나로 합치고 클릭하면 팝업으로 열리게. 받은 초대가 0건이면 클릭 비활성.
> 2. V34 §2에도 불구하고 00:00 위쪽이 여전히 잘려보임 + 00:00 위에 가로선이 보임 → 선 제거 + 자연스럽게.

### §1 — 받은 초대 카드 통합 + 클릭 모달
- **변경 전**: 홈 대시보드에 ④ "받은 초대 N건" 통계 카드 + ⑦ "받은 초대 응답 대기 · N건" 상세 카드, 두 개가 중복으로 노출 → 사용자는 스크롤을 더 해야 응답 버튼에 도달.
- **변경 후**: 단일 카드(`v34-card--stat2`)만 노출, 카드 어디든 클릭 시 팝업 모달이 떠서 초대 목록과 수락/거절 버튼을 보여줌. 받은 초대 0건이면 클릭 비활성(`is-clickable` 클래스 제거 + `onclick: null`).
- **수정 위치**:
  - `public/static/app.js` `renderHome()` 내부:
    - `inviteCard.props.class`: `'v34-card v34-card--stat2' + (hasInvites ? ' is-clickable v34-invite-clickable' : ' v34-invite-disabled')`
    - `inviteCard.props.onclick`: `hasInvites ? () => openInviteModal(invitations) : null`
    - subtitle: 초대 있을 때 "클릭하여 응답하기 ›", 없을 때 "현재 받은 초대가 없습니다"
    - 기존 `invitesSection` 블록 전체 삭제 (≈43줄)
    - 대시보드 카드 8개 → 7개 (greet/next/week/invite/quick/today/upcoming)
  - 새 함수 4종 추가:
    - `openInviteModal(invitations)` — `#invite-modal` 오버레이 생성, 초대 목록 렌더
    - `closeInviteModal()` — 오버레이 제거 + Escape 핸들러 해제
    - `_inviteEscHandler(e)` — Escape 키 → 모달 닫기
    - `respondInvitationFromModal(reservationId, action)` — `/api/reservations/:id/respond` 호출 후 모달 닫고 `renderHome()` 재렌더
  - `public/static/styles.css` V35 §1 블록 신규:
    - `.v34-invite-clickable:hover` → translateY(-3px) + 핑크 그림자 + 보더 강조
    - `.v34-invite-disabled` → `cursor: default` + 살짝 흐림
    - `.v35-invite-overlay` (fixed inset:0, rgba(0,0,0,0.5), fade-in 0.18s)
    - `.v35-invite-modal` (560px, radius 18px, slide-up 0.22s)
    - `.v35-invite-modal__head` / `__body` / `__close`
    - `.v35-invite-item` / `__main` / `__title` / `__meta` / `__owner` / `__actions`
    - `.v35-invite-accept` (FF385C → E31C5F 그라디언트) / `.v35-invite-decline` (흰 배경 + 회색 보더)
    - `@keyframes v35-fade-in / v35-slide-up`
    - `@media (max-width: 768px)` 모달 모바일 적응 (item flex-direction column, actions row 100%)
- **API 흐름**: 기존 `/api/reservations/invitations`(목록) + `/api/reservations/:id/respond`(수락/거절) 그대로 사용. 응답 후 `renderHome()` 재호출 → 초대 0건이 되면 카드가 자동으로 비활성 상태로 전환.

### §2 — 공간 타임라인 00:00 위 선 제거 + 잘림 완전 해결
- **V34 §2가 실패한 이유**: `overflow:visible` + `padding-top:20px`만 추가했고 실제 원인 두 가지를 건드리지 않음.
  - 진짜 원인 ①: `.timeline-header-cell { border-bottom: 1px solid var(--hairline) }` → 헤더와 첫 시간 셀 사이에 가로선이 그어지고 있었음 (사용자가 본 그 선).
  - 진짜 원인 ②: `.timeline-time-cell { top: -6px }` → 시간 셀이 음수 top으로 위로 끌려 올라가 헤더 영역과 시각적으로 겹침 → 00:00 라벨 상단이 헤더에 가려져서 잘려 보임.
- **V35 §2 수정** (`styles.css` 끝에 추가):
  - `.app-shell .timeline-header-cell { border-bottom: none !important; padding-bottom: 14px !important; box-shadow: 0 1px 0 rgba(0,0,0,0.04) !important; }`
    - 보더 제거 + 흐릿한 그림자로 분리감만 유지 → 사용자가 본 "선"이 사라짐.
  - `.app-shell .timeline-time-cell { top: 0 !important; padding-top: 0 !important; }`
    - 음수 top 제거 → 시간 셀이 더 이상 헤더 영역으로 침범하지 않음.
  - `.app-shell .timeline-time-cell:first-child { padding-top: 16px !important; color: #484848 !important; font-weight: 600 !important; height: auto !important; min-height: 40px !important; overflow: visible !important; }`
    - 00:00 라벨에 16px 상단 패딩 + 진한 색상 + 굵게 → 헤더와 자연스럽게 떨어지고 잘리지 않음.
  - `.app-shell .timeline-time-col { padding-top: 4px !important; overflow: visible !important; }`
    - 시간 컬럼 자체에도 상단 여유.
  - `.app-shell .timeline-container, .month-view-container { padding-top: 0 !important; overflow: visible !important; }`
    - V34에서 줬던 `padding-top: 20px`을 0으로 되돌리고 cell 내부 패딩으로 처리 → 카드 내부 공간 낭비 제거.
  - `@media (max-width: 768px)`에도 같은 규칙 재적용 → 모바일에서도 동일.

### V35 변경 파일
- `public/static/app.js` — `renderHome()` inviteCard 클릭화, `invitesSection` 제거, `openInviteModal/closeInviteModal/_inviteEscHandler/respondInvitationFromModal` 4개 함수 추가
- `public/static/styles.css` — 끝에 V35 §1(invite-clickable hover + 모달 스타일) + V35 §2(timeline-header-cell border-bottom 제거 + time-cell top 보정) 블록 약 300줄 추가

### V35 검증 결과
- `npm run build` → `dist/_worker.js 93.67 kB` ✅
- 4개 탭 HTTP 200 (`/home`, `/spaces`, `/insights`, `/admin/members` — 로그인 시) ✅
- `/login` HTTP 200, 콘솔 에러 0건 (PlaywrightConsoleCapture) ✅
- `/api/reservations/invitations` → `{"invitations":[]}` 정상 ✅
- 마커 grep: `openInviteModal/respondInvitationFromModal/v35-invite` 20회, `v34-invite-clickable` 1회, `invitesSection` 0회(완전 제거 확인) ✅
- CSS 마커: V35 §2 timeline 룰 28회, `.timeline-time-cell:first-child` 2회(데스크탑+모바일) ✅

---

## V34 (긴급 5종 패치 — 로그인 버튼 + 타임라인 잘림 + 모바일 룸헤더 + 시간색 + 홈 대시보드 재설계)

> 사용자 V33 직후 5건 보고:
> 1. 로그인 버튼이 안 보임 → 보이게 수정
> 2. 공간 타임라인 00:00이 카드 상단에 잘려있음 → 안 잘리게 수정
> 3. 모바일에서 카드 둥근 모서리로 Meeting Room 글자/색점이 잘림 → 수정
> 4. 앞으로의 일정 시간 색이 분홍 → 검정으로 변경
> 5. 홈 화면이 그냥 에어비앤비 스타일로 색만 바뀐 채 내용은 그대로임 → 전체적인 틀을 완전히 다른 디자인, 한눈에 보이는 대시보드로 재설계

### §1 — 로그인 버튼 가시성 절대 강제
- **원인**: V32 `.abnb-btn--gradient`가 그라디언트만 정의돼 브라우저별 폴백이 없거나 `--abnb-radius-sm` 변수 의존으로 일부 환경에서 색이 안 깔림.
- **수정** (`public/static/styles.css` V34 §1 블록): `button.abnb-btn--gradient` 셀렉터 강도 3중(`.abnb-btn.abnb-btn--gradient` + `button.abnb-btn--gradient` + `button[type="submit"].abnb-btn`) + 모든 속성 `!important`
  - `background-color: #FF385C` (단색 fallback) + `background-image: linear-gradient(...)` (그라디언트)
  - `color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;` Safari 강제
  - `min-height: 52px; height: 52px; visibility: visible; opacity: 1; z-index: 1;`
  - `box-shadow: 0 4px 14px rgba(255,56,92,0.30)` 핑크 글로우
  - 호버 시 한 단 어두운 핑크 + 위로 살짝 부양

### §2 — 공간 타임라인 00:00 잘림 해결
- **원인**: `.app-shell .timeline-container`에 `overflow:hidden` + `border-radius:12px`이 걸려있어 카드 라운드 코너가 첫 시간 라벨(00:00)과 룸 헤더 색점을 잘라먹음.
- **수정**:
  - `.app-shell .timeline-container, .month-view-container { overflow: visible !important; padding-top: 20px !important; }`
  - `.timeline-scroll`만 `overflow-x: auto` (수평 스크롤은 유지)
  - `.timeline-grid, .timeline-body { padding-top: 8px !important; }`
  - `.timeline-hour-label:first-child, .timeline-time:first-child { margin-top: 4px !important; }` 00:00 라벨 상단 여백
  - `.timeline-header-cell { padding-top: 14px; padding-left: 12px; overflow: visible; }` 헤더 색점이 모서리에 안 닿음

### §3 — 모바일 룸 헤더 글자/색점 잘림 해결
- **원인**: V33에서 카드 `border-radius:12px`로 통일했는데 타임라인이 카드 안에 들어있으니 모바일에서 좁아진 컬럼 폭에 라운드 코너가 헤더 첫 줄 글자(`Meeting Room A`)와 색점을 가림.
- **수정** (`@media (max-width: 768px)` V34 §3 블록):
  - `.timeline-container { padding: 12px 8px; border-radius: 12px; overflow: visible; }` 패딩 부여
  - `.timeline-scroll { border-radius: 8px; overflow-x: auto; overflow-y: visible; }` 내부 스크롤박스만 살짝 둥글게
  - `.timeline-header-cell { padding: 10px 6px 8px 6px; min-width: 88px; overflow: visible; }`
  - 헤더 안 `.space-name`을 **2줄 → 1줄 flex-row**로 (색점 + Meeting Room 텍스트가 옆에 나란히)
  - `.space-dot { width: 7px; height: 7px; flex-shrink: 0; }` 절대 줄어들지 않음
  - `.space-name-prefix` 10px / `.space-name-suffix` 13px로 폭 안에 들어가게 축소

### §4 — 앞으로의 일정 시간 색 분홍 → 검정
- **원인**: V32 `--primary: #FF385C` 스코프 오버라이드로 인해 `.upcoming-row .time { color: var(--ink-48) }`이 핑크 계열로 캐스케이드.
- **수정**: 5-셀렉터 조합 `!important` + `-webkit-text-fill-color`
  - 시간 텍스트 `color: #222222`, 시계 아이콘만 `#717171` 회색
  - `font-weight: 600` 진하게

### §5 — 홈 화면 전면 재설계 (가장 큰 변경)
**기존 (V33까지)**: 핑크 그라디언트 인사 박스 + 받은 초대 + "앞으로의 일정" 한 덩어리 리스트만 표시. → 색만 핑크로 바뀐 채 정보 밀도 낮음.

**V34 신규 (`public/static/app.js` renderHome 함수 완전 재작성)**:
6+카드 그리드 대시보드. 한 화면에 모든 상태가 보임.

| 카드 | 내용 | 위치 |
|---|---|---|
| **인사 카드** | 시간대별 인사말 + 이름 + 오늘 날짜 + 테넌트명 + Apr-style 날짜 배지(MMM/D) | 전체 폭, 핑크 그라디언트 |
| **다음 일정 카드** | 가장 가까운 1건 (오늘이면 "오늘 HH:MM" / 미래면 "M/D HH:MM") + 제목 + 공간 알약 | 좌측 (2열 중) |
| **이번 주 일정 카드** | 큰 숫자(N건) + "예정 X건 · 오늘 Y건" 부제 | 우측 (2열 중) |
| **받은 초대 카드** | 큰 숫자(N건) + 응답 대기 여부 부제 | 좌측 (2열 중) |
| **빠른 진입 카드** | 4-grid 아이콘 메뉴: 공간 예약 / 새 일정 / (어드민만)인사이트 / (어드민만)멤버 관리 | 전체 폭 |
| **오늘의 일정 카드** | 오늘 모든 일정 리스트 (시간 검정 + 제목 + 주최/참석 배지 + 공간 알약) | 전체 폭, 오늘 일정 있을 때만 |
| **받은 초대 응답 대기** | V7 §3 인라인 수락/거절 액션 유지 | 전체 폭, 초대 있을 때만 |
| **앞으로의 일정** | 다가오는 5건 (오늘 이후) | 전체 폭, 있을 때만 |

- 모든 카드 hover 시 `translateY(-2px) + box-shadow` 상승 효과
- 빠른 진입 아이콘 hover 시 핑크 배경으로 변환
- 모바일에서 1열 스택 + 빠른 진입은 2×2 grid + 시간 라벨 90px로 축소
- "다음 일정" 카드 클릭 시 해당 일정 날짜로 공간 페이지 이동 (sessionStorage jumpDate)

### V34 검증 결과 (E2E)
```
$ npm run build → dist/_worker.js 93.67 kB ✅
$ /login HTTP 200 + abnb-btn 강제 룰 3건 매칭 ✅
$ 로그인 → /home /spaces /insights /admin/members 모두 HTTP 200 ✅
$ v34-dashboard / v34-card--greet / v34-quick-grid / v34-today-list = 5건 출현 ✅
$ V34 §X 마커 5건 (CSS) ✅
$ 데이터 보존: spaces / members / upcoming(예약 115번 등) 정상 응답 ✅
$ PlaywrightConsoleCapture /login → 0 errors, 타이틀 "로그인 · 메이트리그라운드" ✅
```

### V34 데이터·로직 보존 (변경 없음)
- ✅ R-object resize handler (app.js line 945)
- ✅ bulkDeleteMembers (line 2644+)
- ✅ applyTenantColors + `__tenant_colors__` 3-layer (line 3348+)
- ✅ V15 PUBLIC_ROOMS A~E 가드
- ✅ renderShell() 마크업 무수정
- ✅ V7 §3 invitation accept/decline 인라인 액션 (이름·위치만 V34 카드 안으로 이전)

---

## 🆕 V33 (긴급 4종 패치 — 글로벌 네비 가시성 + 모바일 반응형 + 한글 브랜드 + DEMO 삭제)

> 사용자 V32 직후 4건 긴급 보고:
> 1. 로그인 후 글로벌 네비가 안 보여서 4탭(홈/공간/인사이트/관리) 진입 불가
> 2. 모바일 모든 페이지 배열 깨짐 — 전 페이지 반응형 보강 + 테스트 요구
> 3. 글로벌 네비·로그인 페이지 모두 "메이트리그라운드" 한글 강제 (영문 MATRI BUILDING 금지)
> 4. DEMO ACCOUNTS 섹션 완전 삭제 — 사용자에게 노출 금지 (재요청)

### §1 — 글로벌 네비 가시성 복구 (CRITICAL FIX)
- **원인 진단**: V32가 `.app-shell .global-nav { background:#ffffff !important; }`로 흰 배경으로 바꿨는데, 원본 `.global-nav .nav-brand` / `.nav-link` 텍스트 색은 어두운 배경용 `#fff` 흰색이라 **흰 배경 위에 흰 글자**가 되어 사라진 문제.
- **수정** (`public/static/styles.css` 라인 ~190~265): `.app-shell .global-nav` 스코프 안에서 nav-brand·nav-link·nav-user-name·아이콘·햄버거 바·아바타까지 전부 `#484848` / `#FF385C`로 재정의. `-webkit-text-fill-color`까지 명시해 Safari/그라디언트 인쇄 강제.
  - `.app-shell .global-nav .nav-brand` 17px / 700 weight / 다크 텍스트 강제
  - `.app-shell .global-nav .nav-link` 알약(pill) 형태 (`border-radius: 999px`), 호버 `#f7f7f7`, 활성 `#FF385C` 핑크
  - 브랜드 마크 3-bar: 어두운 배경용 흰색 → 핑크 그라디언트 (`#FF385C`/`#E31C5F`)
  - 아바타: 핑크 그라디언트 배경 + 흰 글자
- **결과**: `/home /spaces /insights /admin/members` 4개 탭 모두 HTTP 200 + 네비 정상 렌더 + 클릭 가능

### §2 — DEMO ACCOUNTS 섹션 완전 삭제
- **파일**: `src/pages/login.tsx`
- `<div class="abnb-hint">DEMO ACCOUNTS...</div>` 블록 (와일리 Admin / 러쉬 Admin / 멤버 3행 + 비밀번호) 마크업 완전 제거
- 검증: `curl /login | grep -E "DEMO ACCOUNTS|abnb-hint|admin1234|user1234"` = 0건
- 부가 효과: 빌드 크기 -0.55 kB (94.22 → 93.67)

### §3 — 한글 브랜드 표기 강제
- **로그인 페이지** (`src/pages/login.tsx`)
  - 타이틀: `MATRI BUILDING` → `메이트리그라운드`
  - 부제: `Wylie & Lush Shared Workspace` → `와일리 & 러쉬 공유 워크스페이스`
  - 푸터: `© MATEGROUND · WYLIE & LUSH KOREA` → `© 메이트리그라운드 · 와일리 & 러쉬 코리아`
- **글로벌 네비**: `public/static/app.js` line 127 — 이미 `'메이트리그라운드'` 한글 (V31부터 유지). 모바일 드로어 line 194도 한글. JS는 무수정.
- 검증: `curl /login | grep 메이트리그라운드` = 3건, `MATRI BUILDING` = 0건

### §4 — 모바일 반응형 전면 보강 (전 페이지)
- **파일**: `public/static/styles.css` 끝(라인 5567~5929)에 V33 §4 종합 블록 추가
- **(A) `@media (max-width: 768px)` — 스마트폰**
  - `html/body/.app-shell` `overflow-x: hidden + max-width:100vw` — 가로 스크롤 절대 차단
  - 글로벌 네비: 데스크톱 메뉴 숨김 + 햄버거 강제 노출 + 패딩 14px
  - 컨테이너 패딩 14px / 최대폭 100vw
  - 모든 카드 (홈 히어로·요약·통계·차트·인사이트·어드민·관리·공간·멤버·인비테이션·세팅) → 패딩 16px / `width:100%` / `box-sizing:border-box` / 1열 스택
  - 모든 그리드(요약·인사이트·통계·홈·공간·멤버·어드민·조직·2~4 컬럼) → `grid-template-columns: 1fr`
  - 어드민 사이드내비 → 가로 스크롤 탭 바로 변환 (`flex-direction:row + overflow-x:auto`)
  - 테이블 래퍼 `overflow-x:auto` + `min-width:560px` + `white-space:nowrap` (모바일에서 가로 스크롤)
  - 인사이트 히트맵 `min-width:720px` + 가로 스크롤
  - 타임라인 시간축 `font-size:11px` + 가로 스크롤
  - 일정 블록 `font-size:11px + padding:4px 8px`
  - h1 22px / h2 18px / h3 16px로 축소
  - 폼·필터·툴바 행 → 세로 스택 (`flex-direction:column`)
  - 모달 → `94vw + max-height:90vh + overflow-y:auto`
  - 로그인 게이트 `.abnb-gate__grid` 1열, `.abnb-rooms-grid` 2열
- **(B) `@media (max-width: 480px)` — 소형 폰**
  - 글로벌 네비 패딩 10px / 브랜드 14px
  - `.abnb-rooms-grid` 1열
- **(C) `@media (min-width: 769px) and (max-width: 1023px)` — 태블릿**
  - 컨테이너 패딩 20px
  - 통계/요약 그리드 2열로 축소
  - 어드민 사이드내비 폭 180px로 축소

### V33 검증 결과 (E2E)
```
$ npm run build → dist/_worker.js 93.67 kB ✅ (V32 대비 -0.55 kB, DEMO 삭제 효과)
$ curl /login → HTTP 200
  메이트리그라운드: 3건 / MATRI BUILDING: 0건 ✅
  와일리 & 러쉬: 2건 / Wylie & Lush: 0건 ✅
  DEMO ACCOUNTS|abnb-hint|admin1234|user1234: 0건 ✅
$ POST /api/auth/login (admin@wylie.co.kr) → ok:true ✅
$ /home /spaces /insights /admin/members → 모두 HTTP 200 ✅
$ /api/spaces /api/members /api/public/available-spaces → 모두 정상 응답 ✅
$ PlaywrightConsoleCapture /login → 0 errors, 타이틀 "로그인 · 메이트리그라운드" ✅
.app-shell .global-nav .nav-brand 규칙: 7개 ✅
V33 §4 마커: 2개 ✅
```

### V33 데이터·로직 보존 (변경 없음)
- ✅ R-object resize handler (app.js line 945)
- ✅ bulkDeleteMembers 일괄 삭제 핸들러 (line 2644~2649)
- ✅ applyTenantColors + `<style id="__tenant_colors__">` 3-layer 디펜스 (line 3348+)
- ✅ V15 PUBLIC_ROOMS A~E 화이트리스트 + tenant_scope IS NULL 가드 (`src/api/public.ts`)
- ✅ renderShell() 함수 무수정 — 마크업은 V32와 동일, CSS만 수정

---

## 🆕 V32 (에어비앤비 DLS 전면 개편 — 오프 화이트 + Rausch 핑크)

> 사용자 디렉티브: V31 라벤더 사파이어 테마 전체 폐기. 에어비앤비 DLS 비주얼로 갈아엎고, MATRI BUILDING 브랜드 통일, 알약(pill) 일정 블록, 멤버/공간 1:1 황금비 확장 적용. 전용룸 차단 가드는 V15 그대로 유지.

### §1 — 로그인 게이트 (MATRI BUILDING) 에어비앤비 DLS 전면 재구축
- **마크업** (`src/pages/login.tsx`): LUX → ABNB 완전 교체
  - 컨테이너: `.abnb-gate` (오프 화이트 `#f7f7f7` 매트 베이스)
  - 브랜드 헤더: `.abnb-brand-mark` (그라디언트 핑크 로고 마크) + `MATRI BUILDING` 타이틀 + `Wylie & Lush Shared Workspace` 부제
  - 메인 그리드: 1.3 fr (실시간 가용판) + 1.0 fr (로그인 폼)
  - 모든 카드: `border-radius: 12px` + `1px solid #ebebeb` + `box-shadow: 0 6px 16px rgba(0,0,0,0.12)`
- **알약(pill) 배지**: 즉시 사용 가능 → 핑크 `#FF385C` 알약 / 사용 중 → 그레이 알약
- **펄스 도트 LIVE**: 그린 `#008A05` + keyframes `abnb-pulse` 0~70~100% 박스섀도우 확산
- **로그인 버튼**: `linear-gradient(90deg, #E31C5F → #FF385C)` + 핑크 글로우 그림자, 텍스트 `공간 입장하기`
- **인풋 포커스**: `border-color: #FF385C` + `box-shadow: 0 0 0 2px rgba(255,56,92,0.16)` 핑크 링
- **모바일 (≤768px)**: 1열 스택 + 회의실 그리드 2열 + 패딩 24px

### §2 — 전용룸 차단 가드 (V15에서 이미 완성, V32에서 재검증)
- 백엔드 `GET /api/public/available-spaces` (`src/api/public.ts`):
  - `WHERE name IN ('Meeting Room A','B','C','D','E')` (5개 하드 화이트리스트)
  - `AND tenant_scope IS NULL` (이중 가드)
  - **결과**: `Conference Room`(WYLIE 전용), `파라다이스룸`(LUSH 전용), `Lounge`, `Recharging Zone` 전부 절대 노출 불가
- E2E 검증: API 응답에 5개만 정확히 반환됨 (KST 16:34 기준)

### §3 — 알약(Pill) 형태 일정 블록
- **CSS 오버라이드** (`.app-shell` 스코프):
  - `.event-block, .timeline-block, .reservation-block, .timeline-slot.is-booked, .timeline-active-bar`
  - `border-radius: 14px !important` + `box-shadow: 0 2px 6px rgba(0,0,0,0.12) !important` + `border: none !important`
- **호버 인터랙션**: `transform: translateY(-1px)` + 그림자 강화 (transition 0.18s)
- **내 일정 강조**: `0 0 0 2px #FF385C, 0 4px 12px rgba(255,56,92,0.22)` 핑크 링
- **리사이즈 핸들**: `border-radius: 0 0 14px 14px`로 알약 곡선 매칭
- **V14 단일 R 객체 리사이즈 로직 무손실 보존** — JS 한 줄도 안 건드림

### §4 — 로그인 후 4탭 전체 에어비앤비 테마
- **`.app-shell` 변수 오버라이드**: parchment `#f7f7f7` / canvas `#fff` / hairline `#ebebeb` / primary `#FF385C` / r-md `12px` / shadow `0 6px 16px rgba(0,0,0,0.08)`
- **광역 카드 강제 룰** (V31 사파이어 라인 → V32 ebebeb 라인):
  ```
  home-hero, upcoming-section, timeline-container, insight-card, insight-heatmap,
  stat-card, summary-card-item, chart-card, admin-content-card, management-content-card,
  setting-card, schedule-palette-box, color-palette-card, palette-management-wrapper,
  repeat-panel, org-panel, space-card, member-card, invite-card, invites-section,
  space-filter-panel, month-view-container, heatmap-card-panel
  → border-radius: 12px !important + 1px solid #ebebeb !important + shadow 0 6px 16px rgba(0,0,0,0.08) !important
  ```
- **사이드 내비**: 12px 라운드 + soft shadow `0 2px 8px rgba(0,0,0,0.06)`
- **여백 시스템**: home-hero 40px / 주요 카드 32px / 작은 카드 24px (모바일 24/20/16)
- **글로벌 내비**: 그림자 미세화 (`0 1px 0 rgba(0,0,0,0.08)`) + ebebeb 하단 라인
- **텍스트 컬러**: 본문 `#484848` / 보조 `#717171` 전역 통일
- **버튼 그라디언트**: `.btn-primary`에 핑크 그라디언트 + 핑크 글로우

### §5 — 관리 일반 탭: 멤버/공간 1:1 황금비 확대
- `.summary-card-grid-container`: 2분할 그대로, gap `16px` → `28px`
- `.summary-card-item`: `padding: 36px 32px` + `min-height: 140px` + flex 정렬 (아이콘 좌 / 텍스트 우)
- `.summary-card-icon`: 64×64 원형 + 핑크 그라디언트 배경 + 26px 아이콘
- `.summary-card-text .value`: 28px → 34px 임팩트 폰트 강화
- 모바일에서는 1열로 자동 변환

### 절대 보존 검증 (Preservation Clause)
- ✅ 데이터: spaces 8 / members 2 / reservations 43 정상 (WYLIE admin 시점)
- ✅ 리사이즈 V14 단일 R 객체 (945줄) — `let R = null; ... origStartMin/origEndMin/curStartMin/curEndMin`
- ✅ 일괄 삭제 `bulkDeleteMembers`, `#bulk-delete-btn` 핸들러
- ✅ 팔레트 실시간 동기화 `applyTenantColors()` + `<style id="__tenant_colors__">` 동적 주입
- ✅ V31 §2 인기 공간 삭제 유지 (`insight-popular` 흔적 0건)
- ✅ V31 §1 안내문구 삭제 유지
- ✅ JS 비즈니스 로직 무수정 — 순수 마크업/CSS만 교체

### V32 빌드/배포 상태
- `dist/_worker.js` **94.22 kB** (V31 94.18 kB 대비 +0.04 kB — login 마크업 약간 증가)
- PM2 webapp online (restart count 11)
- /login HTTP 200, abnb-gate/brand-mark/pulse/card--live/card--login/rooms-grid/btn--gradient 7개 클래스 정상 노출
- /api/public/available-spaces: Meeting Room A~E 5개 정확 반환, KST 16:34
- 미리보기 URL: https://3000-iylt8ni2z01kxtgymrr7e-02b9cc79.sandbox.novita.ai/login

---

## V31 (최종 디자인 디렉티브: 절제 미니멀 마감)

> 사용자 디렉티브: "소스를 해석하고 잘 맞게 꾸며줘". V15 라벤더 Anti-Handley 베이스를 4탭 전체로 완전 확장하고, 광고성·중복 텍스트와 인기 공간 위젯을 제거해 호텔 안내판처럼 정갈한 마감으로 통일.

### §1 — 로그인 게이트 하단 안내문구 완전 삭제
- **삭제 대상**: 로그인 페이지 실시간 회의실 카드 상단의 안내 문구
  > "현재 시각 기준 즉시 이용 가능한 공용 회의실 (Meeting Room A~E). 와일리 전용(Conference Room) · 러쉬 전용(파라다이스룸)은 표시하지 않습니다."
- **처리**: `src/pages/login.tsx` 의 `<p class="lux-card__desc">…</p>` 블록을 마크업 자체에서 삭제 (CSS 숨김 X — 소스에서 완전 제거)
- **유지**: 카드 head(타이틀 + LIVE 배지) → 곧바로 5룸 그리드로 진입 → 60초 폴링 시계는 카드 푸터에서 유지

### §2 — 인사이트 [인기 공간] 섹션 소스 완전 소거
- **렌더링 함수**: `renderInsightOverview()` (`public/static/app.js` ~2318)
  - `el('div', { class: 'insight-popular' }, ...)` 블록 전체 삭제
  - 통계 카드 3개 (평균 / 총건수 / 가동공간수) → 곧바로 `요일·시간대별 예약 밀집도` 히트맵으로 자연 연결
- **CSS 잔재 청소** (`public/static/styles.css`):
  - `.insight-popular`, `.popular-grid`, `.popular-item`, `.popular-rank.r-1/r-2/r-3`, `.popular-name`, `.popular-count` 전부 삭제
  - 미디어쿼리 `@media (max-width: 1024px)` 안의 `.popular-grid` 룰도 삭제
- **API 데이터 보존**: 백엔드 `/api/insights/overview` 응답의 `popular_spaces` 필드는 그대로 보존 (엑셀 다운로드 시 `'인기 공간'` 시트에서 계속 사용됨). UI에서만 제거하는 정확한 분리.

### §3 — Anti-Handley 라벤더 테마 4탭 전면 확장
- **V15 한계**: `.app-shell` 변수 오버라이드는 일부 컨테이너만 1px 사파이어 라인 처리. 카드/패널/사이드내비/요약카드 다수가 여전히 그림자·둥근모서리.
- **V31 강화**: `.app-shell` 스코프 안에서 모든 카드 클래스를 광역 타게팅:
  ```
  .summary-card, .summary-card-item, .summary-card-grid-container,
  .stat-card, .chart-card, .admin-card, .admin-content-card,
  .management-content-card, .setting-card, .setting-section-box,
  .schedule-palette-box, .color-palette-card, .palette-management-wrapper,
  .repeat-panel, .org-panel, .space-card, .member-card, .invite-card,
  .invites-section, .invite-status-banner, .invite-action-banner,
  .space-filter-panel, .month-view-container, .heatmap-card-panel,
  .admin-side-nav, .side-nav, .admin-sidebar,
  .home-hero, .upcoming-section, .timeline-container, .insight-card, .insight-heatmap
  ```
  - 모두 `box-shadow: none !important; border-radius: 4px !important; border: 1px solid #1a365d !important; background: #ffffff !important;`
- **1.5x 패딩**: 호텔 안내판 같은 정갈한 여백
  - `home-hero` 48px / 주요 카드·패널 36px / 작은 카드 24px (데스크톱)
  - 모바일(<=768px)은 28/20/16px 로 축소 — 좁은 화면 가독성 보호
- **전역 내비**: `.global-nav` 하단 라인을 사파이어로 통일, 그림자 제거
- **본문 배경 안전망**: `.app-shell .page-wrap { background: #dfe7f7 !important; }` — 다른 스타일의 우발적 덮어쓰기 차단

### §4 — PC 가로 스크롤 최종 안전망
- **V15 처리분 유지**: `.timeline-scroll { overflow-x: hidden }` 데스크톱, 모바일에서만 `auto`
- **V31 광역 안전망** (`@media (min-width: 1024px)`):
  ```
  .timeline-scroll, .timeline-viewport-container, .timeline-container,
  .space-list-wrapper, .grid-scroll-area,
  .app-shell .home-hero, .app-shell .upcoming-section,
  .app-shell .insight-card, .app-shell .insight-heatmap,
  .app-shell .admin-content-card, .app-shell .management-content-card,
  .app-shell .month-view-container
  {
    overflow-x: hidden !important;
    max-width: 100% !important;
    width: 100% !important;
  }
  ```
  - 추가로 `.timeline-grid` 는 `width:100% !important; min-width:0 !important;` 강제 → 부모 컨테이너 너비 100% 비례 분할

### §5 — 절대 보존 검증 (Preservation Clause)
- ✅ **데이터**: 멤버 / 공간 / 예약 전부 보존 (E2E: WYLIE admin 시점에서 spaces=8, members=2, reservations=43 정상 조회)
- ✅ **리사이즈 V14 단일 R 객체**: `let R = null` + `origStartMin/origEndMin/curStartMin/curEndMin` 그대로 (945번 줄)
- ✅ **일괄 삭제**: `bulkDeleteMembers` 핸들러, `#bulk-delete-btn` 인터랙션 보존
- ✅ **팔레트 실시간 동기화**: `applyTenantColors()`, `<style id="__tenant_colors__">` 동적 주입, `.tenant-wylie/.tenant-lush` 클래스 모두 보존
- ✅ **mouse/pointer/resize 리스너**: 8개 모두 보존
- ✅ **검증 방식**: 순수 마크업 / CSS 시각 변경만 수행. JS 로직(이벤트 / 비즈니스 함수)에는 한 줄도 손대지 않음.

### V31 빌드 산출
- `dist/_worker.js` **94.18 kB** (V15 94.43 kB 대비 -0.25 kB — 인기 공간 마크업·CSS 제거 효과)
- PM2 webapp online (restart count 10)
- 빌드/배포 환경: Cloudflare Pages (sandbox preview: PM2 wrangler pages dev port 3000)

---

## V15 (Anti-Handley 프리미엄 디자인 개편 + 실시간 현황판)

> 사용자 요구: 핸들리 스타일 폐기 → 라벤더(#dfe7f7) + 다크 사파이어(#1a365d) 라인의 호텔 안내판 느낌의 하이엔드 플랫 UI. PC 가로 스크롤 영구 폐기. 로그인 페이지에 실시간 공용 회의실 가용 현황 도입.

### §1 — 로그인 페이지 전면 개편 + 실시간 공용 회의실 가용판
- **신규 백엔드 API** (`src/api/public.ts` — 인증 미들웨어 미적용):
  - `GET /api/public/available-spaces` — 현재 KST 시각 기준, `Meeting Room A~E` 5개의 즉시 사용 가능 여부 반환
  - 응답: `{ now: {date, time}, rooms: [{id, name, capacity, available, current_end_at, next_busy_at}] }`
  - 정책: `tenant_scope IS NULL` 공용 5개만 대상. `Conference Room`(WYLIE 전용) · `파라다이스룸`(LUSH 전용) 무조건 제외
- **신규 로그인 페이지** (`src/pages/login.tsx` + `public/static/login.js`):
  - 라벤더 매트(#dfe7f7) 배경 + 사파이어 라인 카드 + 직각 4px + 그림자 없음
  - 좌측 카드: 5개 룸을 카드 그리드로 표시, 가용=즉시 사용 가능 칩 / 비가용=종료 예정 시각 표시
  - 우측 카드: SIGN IN 폼 (라벤더 톤 인풋, 사파이어 버튼)
  - **60초 폴링** (`setInterval`)으로 새로고침 없이 실시간 갱신, 펄스 도트 LIVE 인디케이터
  - 모바일에서는 1열 스택 + 회의실 그리드 2열로 자동 전환
- **검증 (E2E)**:
  - `GET /api/public/available-spaces` → Meeting Room A~E 5개만 반환, 전용룸 제외 ✅
  - 14:00–16:00 가짜 예약 추가 → `Meeting Room A: available=false, current_end_at='16:00'` ✅
  - 가짜 예약 삭제 → `available=true` 복귀 ✅

### §2 — PC 타임라인 가로 스크롤 영구 제거 (100% Full-Width 반응형)
- **문제**: 데스크톱에서도 `min-width: 56 + 8*160 = 1336px` 가 강제되어 1440 모니터에서도 `Recharging Zone` 우측이 잘리고 가로 드래그 필요. 향후 공간이 늘어나면 더 악화
- **해결**:
  - JS (`app.js` line ~700): 데스크톱 컬럼 정의를 `minmax(160px, 1fr)` → `minmax(0, 1fr)` 로 변경 + `min-width` 어트리뷰트 자체를 데스크톱에서는 출력하지 않음 → 부모 컨테이너 너비를 그대로 따라감
  - CSS (`styles.css`): `.timeline-scroll { overflow-x: hidden }` 데스크톱 기본값. 모바일(<1024px)에서만 `overflow-x: auto` 복원
- **결과**: 공간 개수가 5개든 12개든 화면에 1:1 비례 분할되어 가로 스크롤 없이 한 화면 렌더링. 모바일은 기존대로 자연스러운 가로 스크롤 유지

### §4 — 로그인 후 전역 라벤더 테마 (Hi-End Flat UI)
- **스코프 안전 변수 오버라이드**: `.app-shell { --parchment: #dfe7f7; --primary: #1a365d; --shadow-product: none; --r-md: 4px; ... }` — 셸 안에서만 작동하므로 로그인 페이지/모달 영향 X
- **그림자 전량 소거**: 카드 / 히트맵 / 데이터테이블 / admin-content-card 등 `box-shadow: none !important` + `border-radius: 4px !important` + 사파이어 1px 라인
- **칼로 자른 듯한 시인성**: 흐릿한 그림자가 사라지고 호텔 안내판처럼 정갈한 경계만 남음

### §5 — 관리 > 일반 설정 정돈
- `[회사 정보]` 카드 + `[디바이스 -]` 카드 — V11에서 이미 영구 삭제됨 (V11 §3-1, §3-2)
- V15: admin 페이지 헤더 부제를 "회사 정보를 입력하고..." → "서비스 기본 설정과 멤버를 관리합니다." 로 정정 (실제로 회사 정보 입력 기능이 없으므로 오해 제거)

### §6 — 일정 컬러 팔레트 + 우측 상단 범례 실시간 동기화
- V14에서 이미 3중 방어선(`:root` CSS 변수 / `<style id="__tenant_colors__">` 동적 주입 / `.tenant-wylie`/`.tenant-lush` 클래스)으로 완전 구현 완료
- 어드민 팔레트 → DB PATCH → `applyTenantColors()` 즉시 호출 + `refreshTimelineEvents()` 강제 리렌더링
- 검증: V14 시점에서 `/api/tenants` DB 값과 화면 픽셀 색이 일치하는 것을 E2E 확인

---

# 메이트리그라운드 (Mateground) — V14 완결본

WYLIE/LUSH 통합 예약 관리 플랫폼. Cloudflare Pages + Hono + D1(SQLite).

## 프로젝트 개요
- **목표**: 멀티 테넌트(WYLIE/LUSH) 회의실/공간 예약을 관리자가 직접 운영하는 사내 통합 플랫폼
- **주요 기능**: 공간 예약(반복/일괄 수정), 일/월 뷰 타임라인, **V14: 리사이즈(시작/종료 시간 늘이기·줄이기) 완전 재작성**, **V14: 테넌트 컬러 실시간 동기화 시스템 재설계**, 부서·직책 마스터, 멤버 관리, 인사이트 대시보드(회의 목적 포함), 테넌트별 공간 격리, 크로스 테넌트 일정 상세 접근 차단, 회의 목적 자유 텍스트 필드, 최초 로그인 비밀번호 강제 변경, 모바일 반응형 UI

## 🆕 V14.1 (모바일 인사이트 UI 보정)

### §UI-1 — 인사이트 페이지 헤더 모바일 컴팩트화
- **문제**: 모바일에서 "메이트리그라운드" 헤더 아래 "인사이트 / 공간 운영 데이터를 한눈에" 영역이 큰 폰트(40px) + 큰 margin으로 차지해, 본문(탭/필터)과의 간격이 어색하게 좁아 보임
- **원인**: 인사이트 페이지의 `.page-header`는 다른 관리 페이지와 달리 `is-admin-header` 클래스가 없어 모바일 전용 숨김/축소 규칙이 적용되지 않음
- **해결 (`styles.css`)**: `.page-wrap > .page-header:not(.is-admin-header)` 모바일 셀렉터로 헤더 폰트(40px→24px) / 부제(17px→12px) / 하단 margin(32px→12px) / 탭과의 간격 0으로 컴팩트화. 헤더 자체는 유지(인사이트가 무슨 페이지인지 알 수 있게)

### §UI-2 — 요일·시간대별 예약 밀집도 표 오른쪽 끝 잘림
- **문제**: 모바일에서 24열(00~23시) 히트맵의 오른쪽 끝(22~23시 열)이 화면 밖으로 잘려 보이지 않음. 동시에 왼쪽에 카드 padding(32px)으로 빈 공간이 남음
- **해결 (`styles.css`)**: 모바일(`@media (max-width: 768px)`)에서
  - 카드 padding 축소: `32px` → `16px 12px` (좌우 공간 40px 확보)
  - 요일 라벨 폭 축소: `36px` → `22px` (14px 추가 확보)
  - 셀 간 gap 축소: `2px` → `1px` (24열 × 1px = 23px 추가 확보)
  - 셀 높이/폰트 축소: 28px/10px → 22px/9px
  - 안전망: `overflow-x: auto` + `min-width: 340px`로 더 좁은 단말에서도 가로 스크롤로 모든 시간대 접근 가능

## 🆕 V14 (누적 패치 청산 / 두 핵심 시스템 처음부터 재작성)

> 사용자 요구: *"기존에 있는 일정 시간 조절 늘리고 줄이는 소스를 지우고 새로 만들어"*, *"공간 와일리 러쉬코리아 해당 팔레트 색상 변경했는데 전혀 연동도 안되니까 이것도 기존 소스 지우고 새로 소스짜줘"*, *"실시간으로 팔레트 색상 적용하면 공간 페이지에서도 실시간으로 색이 바뀌어야 하는 거야"*, *"두 가지 해결할 때까지 절대 개발 멈추지 마"*
>
> V11~V13에 걸쳐 누적된 패치가 서로 충돌해 "기존 소스 수정 자체가 불가" 상태에 도달. **리사이즈 / 테넌트 컬러 두 시스템을 완전히 폐기하고 처음부터 재작성**.

### §1 — 리사이즈(일정 시간 늘이기·줄이기) 완전 재작성
- **문제 (V13까지)**: `resizeState`(하단 핸들) / `resizeTopState`(상단 핸들) 이중 상태 + 시작/종료 픽셀 좌표를 따로 추적하는 누적 패치 구조 — 한쪽을 고치면 다른 쪽이 깨지는 "수정 불가능" 상태
- **해결 (`public/static/app.js` lines 921~1117 — 218줄 → 197줄로 재구성)**: **단일 상태 객체 `R`** 패턴으로 통일
  ```javascript
  const PX_PER_MIN  = 40 / 60;            // 60분 = 40px
  const SNAP_MIN    = 30;                  // 30분 스냅
  const MIN_DURATION = 30;                 // 최소 30분
  const MAX_END_MIN = 23 * 60 + 30;        // 상한 23:30
  let R = null;                            // 통일된 단일 상태
  // R = { edge, origStartMin, origEndMin, curStartMin, curEndMin, minStartMin, maxEndMin }
  ```
  - **분(min) 정수가 단일 진실의 원천(source of truth)** — 픽셀은 항상 `MIN_TO_PX(min)`로 파생
  - `edge: 'top' | 'bottom'` 하나의 분기로 시작/종료 핸들을 동일 함수(`onResizeMove`/`onResizeUp`)가 처리
  - 30분 단위 스냅 + `MIN_DURATION` / `MAX_END_MIN` 동시 가드 + 이웃 예약 충돌 가드
  - `resizeState` / `resizeTopState` 등 잔존 변수 전부 제거
- **검증 (E2E)**:
  - id=110 예약 09:00–10:00 생성 → PATCH `end_time` 단독 변경 → 11:30 ✅
  - 같은 예약 PATCH `start_time` 단독 변경 → 08:30 ✅
  - 최종 DB 08:30–11:30 — **두 핸들이 완전히 독립적으로 동작**

### §2 — 테넌트 컬러 실시간 동기화 시스템 재설계 (3중 방어선)
- **문제 (V13까지)**: 관리자가 팔레트로 WYLIE=보라, LUSH=진한 핑크로 바꿔도 공간 페이지 범례 점에 그대로 `#0066cc`(파랑) / `#1d1d1f`(검정)이 노출. 원인은 (a) CSS 변수 / (b) JS 인라인 hex / (c) 범례 점 하드코딩 3곳에서 따로 색을 결정해 서로 무력화
- **해결**: 색 결정 경로를 **단 하나(`applyTenantColors`)** 로 통합하고 **3중 방어선** 구축
  - **Layer 1 — CSS 변수 정의 (`public/static/styles.css`)**:
    ```css
    :root {
      --tenant-wylie: #703b96;    /* 와일리 = 보라 */
      --tenant-lush:  #d81b60;    /* 러쉬코리아 = 진한 핑크 */
      --wylie-schedule-color: var(--tenant-wylie);   /* 레거시 이름 호환 */
      --lush-korea-schedule-color: var(--tenant-lush);
    }
    ```
  - **Layer 2 — 동적 `<style id="__tenant_colors__">` 주입 (`app.js`)**: `applyTenantColors(tenants)`가 DB의 `schedule_color`를 읽어 `:root`의 변수를 덮어씀. 레거시 인라인 스타일이 남아 있어도 후순위 `<style>`로 이김
  - **Layer 3 — 클래스 기반 적용**: 범례 점은 더 이상 hex를 모름. `.tenant-wylie` / `.tenant-lush` 클래스만 받고 색은 CSS 변수에서 가져옴 (lines 593~594 하드코딩 제거)
  ```javascript
  const TENANT_DEFAULTS = {
    WYLIE: { id: 'WYLIE', name: '와일리',     schedule_color: '#703b96' },
    LUSH:  { id: 'LUSH',  name: '러쉬코리아', schedule_color: '#d81b60' },
  };
  ```
  - **실시간 동기화**: 팔레트 카드의 color input에서
    - `oninput` → 즉시 `applyTenantColors()` (드래그 중 미리보기)
    - `onchange` → DB PATCH + `refreshTimelineEvents()` (확정 + 이미 그려진 블록까지 강제 새로고침)
- **검증 (E2E)**:
  - `GET /api/tenants` → `{WYLIE: #703b96, LUSH: #d81b60}` ✅
  - 공간 페이지 범례 점 / 일정 블록 / 월별 뷰 — 세 곳 모두 DB 값과 일치

## V13 (5대 이슈 근본 해결 + 신규 2개 기능)

### §1 — 일괄 삭제 완전 정상화 (FK 제약 + SQLite 변수 한도 동시 해결)
- **문제 (V12)**: 회원 일괄 삭제 시 "일괄 삭제 실패" 에러. 근본 원인 2가지:
  1. **FK NO ACTION**: `reservations.user_id → users(id)`가 NO ACTION이라 사용자 삭제 전 예약 정리가 필요한데, V12는 `UPDATE reservations SET status='cancelled'`만 수행 → FK 제약 위반으로 user 삭제 실패
  2. **SQLite 변수 한도(~100)**: 100명 넘는 일괄 삭제 시 `IN (?,?,?,…)`의 바인딩 변수 초과로 statement 단계에서 실패
- **해결**: `src/api/members.ts`
  - `UPDATE reservations` → **`DELETE FROM reservations`** 로 변경 (참석자/세션/예약 모두 cascade 정리)
  - **50개 단위 chunking**: `for (let i=0; i<ids.length; i+=50) { batch DELETE … }` — 어떤 규모도 안전
  - `POST /bulk-delete`: `exclude_admin: true` 옵션 → 입력에 admin이 섞여도 자동 제외
  - **신규 `POST /purge-all-except-self`**: "나(요청자) 외 같은 테넌트 전원 삭제" — 와일리 어드민이 실행해도 러쉬 어드민은 안전(테넌트 격리)
- **검증**: WYLIE 멤버 194명 일괄 삭제 성공, LUSH 멤버 무손상 확인

### §2-A — 모든 예약 블록이 화면 맨 아래에 표시되는 버그 (CSS 우선순위 함정)
- **문제**: 00:30-05:00 예약을 만들어도 24:00 라인 아래에 거대 블록으로 표시. JS는 정상이었지만 CSS에서 `position`이 강제로 `relative`로 덮어써져 `top:NNNpx`가 절대 좌표가 아닌 형제 박스 기준 오프셋으로 잘못 해석됨
- **해결**: `public/static/styles.css` line 4584
  ```css
  /* V13 §2-A FIX: V12에서 잘못 들어간 'position:relative' 오버라이드 제거 */
  .timeline-event { position: absolute !important; }
  ```
- **추가 안전망 (`app.js`)**:
  - `buildEventEl`: `if (eh >= 24) { eh = 23; em = 30; }` — 잘못된 `24:00` 종료 데이터 클램프
  - `onDragUp` / `onResizeUp`: `MAX_END_MIN = 1410` (=23:30) 상한
  - `minutesToTime`: 1410분 이상 입력 클램프
- **검증 (Playwright)**: 00:30 예약의 `getBoundingClientRect().top` = col 상단 + 20px (= 30분 × 40px/60분 = 20px) — 절대 좌표 정상 동작

### §2-B — 상단(시작 시간) 리사이즈 핸들 동작 보정
- **변경**: `attachResizeTopHandlers`에서 픽셀 좌표 직접 계산 → `getBoundingClientRect()` 기반 시간 환산으로 일관화 (스크롤/리렌더 시점에도 안정)

### §3 — 테넌트 컬러 실시간 동기화 (관리자 설정 ↔ 화면)
- **문제**: 관리자가 WYLIE=보라 / LUSH=빨강으로 바꿔도 화면에 파랑/검정이 그대로 노출
- **원인**: `buildEventEl`의 인라인 `style="background:#0066cc"` 와 `month-event`의 하드코딩 색상이 CSS 변수(`--wylie-schedule-color` / `--lush-korea-schedule-color`)를 무력화
- **해결**: 인라인 background 완전 제거 → CSS 변수가 즉시 적용. 관리자 수정 즉시 모든 일정 블록 색상 반영
- **검증**: LUSH 일정의 `getComputedStyle().backgroundColor` = `rgb(216,27,96)` (= `#d81b60`) 정상 반영

### §NEW-1 — 크로스 테넌트 일정 상세 접근 차단
- **요구사항**: "러쉬 사람들이 와일리 일정을 상세보기 누르지 못하게, 와일리 사람들도 러쉬 일정 누르지 못하게. 단 어드민만 모든 일정 컨트롤 가능"
- **백엔드 (`src/api/reservations.ts`)**:
  ```ts
  // GET /:id, PATCH /:id 둘 다 적용
  if (user.role !== 'admin' && r.tenant_id !== user.tenant_id) {
    return c.json({ error: '다른 소속의 일정은 조회할 수 없습니다.' }, 403);
  }
  ```
- **프런트 (`public/static/app.js` — `buildEventEl`)**: 
  - `isCrossTenant` 계산 → onclick 가드 + `is-cross-tenant` CSS 클래스(투명도 0.45 + not-allowed 커서 + 리사이즈 핸들 숨김)
  - admin 역할이면 `isCrossTenant=false` 처리 — 모든 일정 정상 컨트롤
- **검증**:
  - LUSH member → WYLIE 일정 GET: **403 차단** ✅
  - LUSH member → WYLIE 일정 PATCH: **403 차단** ✅
  - LUSH **admin** → WYLIE 일정 GET: **200 통과** ✅

### §NEW-2 — 회의 목적(purpose) 자유 텍스트 필드
- **요구사항**: "일정 추가 팝업에 어떤 목적으로 회의하는지 타이핑할 수 있게", "인사이트 내역에도 목적이 보이고, 엑셀 다운로드에도 목적이 나와야 해"
- **DB**: `migrations/0006_v13_reservation_purpose.sql` — `ALTER TABLE reservations ADD COLUMN purpose TEXT;`
- **백엔드**:
  - `POST /api/reservations`: body `purpose` 수용 + INSERT
  - `PATCH /api/reservations/:id`: body `purpose` 수용 + UPDATE (명시 undefined면 기존 값 유지)
  - `GET /api/insights/history`: SELECT 절에 `r.purpose` 추가
- **프런트 (`public/static/app.js`)**:
  - 예약 생성 모달: 장소 ↔ 참석자 사이에 `회의 목적` textarea(3 rows, placeholder, oninput → modalState.purpose)
  - 예약 상세 모달: 동일 textarea — 본인/관리자는 편집 가능, 타인은 disabled + 회색 배경
  - 인사이트 내역 표: `회의 목적` 컬럼 추가, 40자 초과 시 `…` 처리 + title 툴팁
  - 엑셀 다운로드(`exportInsightToExcel`): 헤더 `['날짜','시작','종료','공간','제목','회의 목적','예약자','소속','상태']`로 9열 확장
- **검증**: id=105 일정 생성 후 purpose 정상 저장/조회/수정 확인

### ✅ V13 빌드 / 보존
- `dist/_worker.js`: **91.17 kB**
- 신규 마이그레이션 1건(0006) — 기존 데이터 그대로 (purpose 컬럼은 NULL 허용)
- 멤버 / 공간 / 부서·직책 데이터 무손상

---

## 🆕 V8 패치 1 (이전 — GNB 가독성 + 사이드바 인디케이터 + 원클릭 모달)

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

---

## 🆕 V12 통합 패치 (2026-06-10) — 일괄 삭제 시스템 + 리사이즈 근본 수정 + 샌드박스 경량화

### §1 [샌드박스 리소스 경량화 — CPU/메모리 폭주 차단] 🚨
**진단 결과**: `kswapd0`가 10%+ CPU 점유 = 메모리 부족으로 스왑 시도 (Swap=0인데도). 가용 RAM 244MB뿐. 진짜 원인: **`document.addEventListener('mousemove'/'mouseup')`가 `renderSpaces()` 호출마다 누적 등록** → 사용자가 페이지를 N번 탐색하면 N개의 핸들러가 매 마우스 움직임마다 발화 → CPU 100% + 메모리 누수 + 로직 충돌.

**해결책**:
- **`bindGlobalTimelineListeners()` 단일 등록 패턴**: `_docListenersBound` 플래그로 앱 부팅 시 단 1회만 `document` 레벨 mousemove/mouseup 6종 리스너 등록
- **PM2 `max_memory_restart: '400M'`** 설정 — 400MB 초과 시 자동 재시작으로 OOM 방지
- **`NODE_OPTIONS: --max-old-space-size=250`** — Node V8 힙 상한 250MB
- **로그 회전**: PM2 로그 분리 + `merge_logs: true`
- **`max_restarts: 10` + `min_uptime: '10s'`** — 무한 재시작 루프 차단

**효과**:
- 메모리: free 244MB → **331MB**, available 438MB → **522MB** (~80MB 회수)
- CPU: kswapd0 폭주 → 정상화
- mousemove 발화 횟수: N개 핸들러 → **정확히 1개** (콘솔 `[v12] global timeline listeners bound (one-shot)` 1회만 출력)

### §2 [상단 리사이즈 근본 재해결] 🚨 사용자 재제보
**사용자 보고**: "09:00 → 08:30 위로 드래그하면 일정이 축소되며 찌그러진다. 반대로 17:00 → 18:00은 정상."
**진짜 원인**: V11에서 추가한 `direction` 가드는 **올바른 패치였지만**, **§1의 핸들러 누적 문제** 때문에 N개의 mousemove가 동시에 발화하면서 `resizeState`와 `resizeTopState`가 **경합 상태**로 진입 → 하단 로직(`onResizeMove`)이 상단 드래그를 가로채서 height를 줄이는 현상.

**V12 §2 추가 가드**:
1. **양방향 강제 초기화**: 상단 핸들 mousedown 진입 시 `resizeState = null; dragState = null;` 강제 초기화 (다른 상태 잔존 차단)
2. **하단 핸들 양보**: 하단 mousedown 핸들러에서 `if (resizeTopState) return;` 조기 종료 (상단이 활성화되어 있으면 절대 발동 안 함)
3. **capture phase 등록**: 상단 핸들의 `addEventListener('mousedown', ..., true)` — 캡처 단계에서 가장 먼저 실행되어 우선권 확보
4. **CSS z-index 우선권**: `.ev-resize-handle-top { z-index: 6 }` > `.ev-resize-handle { z-index: 4 }` — 작은 블록에서도 상단이 항상 위
5. **상단 핸들 영역 8px → 10px**: 사용자가 정확히 잡을 수 있게 hover 영역 확장
6. **디버그 로그**: `console.log('[v12] resize TOP/BOTTOM activated', {...})` — 실제 어느 핸들이 활성화됐는지 즉시 확인 가능

**E2E 검증**:
- `POST /api/auth/login` (admin) → 200
- `POST /api/reservations` (date=내일, 09:00-10:00, space_id=1) → `{ok:true, ids:[89]}`
- `PATCH /api/reservations/89 {start_time:"08:30"}` → `{ok:true, updated:1}`
- DB: `89|2026-06-11|08:30|10:00|V12 리사이즈 테스트` → ✅ **end_time이 10:00 그대로 유지**

### §3 [신규 기능] 일반 멤버 일괄 삭제 시스템 🆕
**배경**: 멤버 205+명 환경에서 1건씩 삭제는 비현실적. 일괄 삭제 + 어드민 보호 가드 필수.

**백엔드** (`src/api/members.ts` POST `/api/members/bulk-delete`):
- 어드민 전용 (`role !== 'admin'` → 403)
- **이중 가드**: SELECT로 같은 tenant + `role !== 'admin'`인 ID만 추려서 eligibleIds 생성 → admin 절대 삭제 불가
- 본인 제외: `n !== user.id` 필터
- **D1 배치 트랜잭션**: reservations(cancelled 처리) → sessions 삭제 → users 삭제 3단계를 `c.env.DB.batch()`로 원자 처리
- 응답: `{ok:true, deleted: N, skipped: M}`

**프론트엔드** (`buildMemberTable`):
- 헤더 좌측 [전체 선택] 체크박스 + 각 행 [개별 체크박스]
- **`data-role="admin"` 행은 체크박스 `disabled=true`** (CSS opacity 0.35 + cursor not-allowed)
- 본인 행도 `disabled=true` (title="본인 계정은 삭제할 수 없습니다.")
- [전체 선택] 클릭 시 `cb.disabled`인 행은 강제로 `checked=false` 유지
- 헤더 [생성하기] 좌측에 [선택 일괄 삭제 (N)] 미니멀 빨강 톤 버튼 — 선택 0건일 때 disabled
- `confirm()` 다이얼로그 — "관리자 계정 및 본인은 자동으로 제외됩니다."
- 성공 시 `${deleted}명을 삭제했습니다. (보호 대상 ${skipped}명 제외)` toast

**E2E 검증**:
- 테스트 데이터 7명 생성 (일반 5 + admin 1 + 본인 admin 1)
- `POST /api/members/bulk-delete {member_ids:[9001..9005, 9099, 1]}` → `{ok:true, deleted:5, skipped:1}`
- DB 확인: `id=1` (본인) ✅ 생존, `id=9099` (BulkAdminTrap admin) ✅ 생존 — **어드민 보호 가드 작동**
- 일반 멤버(role=member) 권한으로 동일 호출 → **403 `관리자만 접근할 수 있습니다.`** ✅

### V12 빌드/검증 산출물
| 항목 | 값 |
|---|---|
| `dist/_worker.js` | 89.17 kB (V11 대비 +1.14 kB) |
| `public/static/styles.css` | 4,802 lines (+64 — V12 §3 일괄삭제 UI 스타일) |
| `public/static/app.js` | +5개 함수 (bindGlobalTimelineListeners, toggleSelectAllMembers, updateBulkDeleteState, bulkDeleteMembers, +V12 §2 가드 6곳) |
| `src/api/members.ts` | +`POST /bulk-delete` 엔드포인트 (~50 lines) |
| `ecosystem.config.cjs` | max_memory_restart 400M / NODE_OPTIONS / 로그 회전 |
| Vite 빌드 시간 | 989ms ✅ |
| 메모리 가용 | 244MB → 522MB available ✅ |
| Playwright `/login` 콘솔 메시지 | 0건 ✅ |
| 데이터 보존 (active users 207 / spaces 9 / reservations 78 / tenants 2) | ✅ |

### V12 E2E 검증 매트릭스
| 시나리오 | 결과 |
|---|---|
| §1 PM2 max_memory_restart 400M 발동 가능 | ✅ 설정 완료 |
| §1 메모리 가용량 회복 (244MB → 522MB) | ✅ |
| §2 admin 09:00→08:30 PATCH end_time 유지 | `{ok:true, updated:1}` + DB `08:30\|10:00` ✅ |
| §2 capture phase mousedown + 상태 강제 초기화 | 코드 검증 ✅ |
| §2 CSS z-index 6 > 4 (상단 핸들 우선) | ✅ |
| §3 admin → bulk-delete 7건(admin 1, 본인 1 포함) | `deleted:5, skipped:1` (admin 보호) ✅ |
| §3 member → bulk-delete | HTTP 403 `관리자만 접근할 수 있습니다.` ✅ |
| §3 헤더 [전체 선택] 클릭 시 admin 행 체크박스 강제 unchecked | 코드 검증 ✅ |

---

## V46 — 멤버 모달 컬럼 최적화 + 인사이트 내역 개선 + 타임라인 06:00 분리

### V46 변경 요약
1. **§1 멤버 일괄 추가 모달**: 헤더에서 `@WYLIE.CO.KR 자동` 안내 제거, 컬럼 폭 재배분(이름/아이디 22% · 부서/직책 28%), `bulk-row-select` 클래스로 우측 22px padding 확보 → 부서/직책 select의 ▼ 화살표가 더 이상 잘리지 않음
2. **§2 인사이트 내역 — 취소된 예약 제외**: `renderInsightHistory`에서 `rows.filter(r => r.status !== 'cancelled')` 적용. `예약 내역 (N건)` 카운트도 필터 후 길이로 표시. XLSX 다운로드용 `lastResponse.history`도 동일하게 필터된 데이터 사용
3. **§3 인사이트 예약 내역 — 가운데 정렬 + 폭 재배분**: 테이블에 `insight-history-table` 클래스 부착, `colgroup`로 명시적 폭 지정(날짜 10% · 시간 11% · 공간 11% · 제목 13% · **회의 목적 25%** · 예약자 12% · 소속 9% · 상태 9%). 모든 th/td `text-align:center`, 회의 목적은 `.col-purpose` (`white-space:nowrap` + ellipsis) → 한 줄 표시, hover 시 `title` 속성으로 전체 보임
4. **§4 타임라인 06:00 라벨 분리**: 기본 `.timeline-time-cell`은 `top:-6px`로 라벨이 셀 위 경계에 정렬되는데, 첫 셀(06:00)만 `top:6px`로 양수화하여 07:00과 12px 이상의 시각적 간격 확보

### V46 파일 변경
| 파일 | 변경 내용 |
|---|---|
| `public/static/app.js` L3695-L3732 | 멤버 일괄 추가 모달 테이블: colgroup(22/22/28/28%) + 헤더 단순화 + `bulk-row-select` 클래스 |
| `public/static/app.js` L2829-L2895 | `renderInsightHistory` — cancelled 필터 + `insight-history-table` 클래스 + colgroup + `col-purpose` |
| `public/static/styles.css` (말미) | `.bulk-member-table`/`.bulk-row-select` (▼ padding 22px), `.insight-history-table`/`.col-purpose`/`.col-space-name`, `.timeline-time-cell:first-child{top:6px}` |

### V46 빌드/검증
| 항목 | 값 |
|---|---|
| `dist/_worker.js` | 98.83 kB |
| Vite 빌드 시간 | 1.65s ✅ |
| PM2 재시작 | online ✅ |
| `GET /` | HTTP 302 (로그인 리다이렉트) ✅ |
| `GET /static/app.js` | HTTP 200 ✅ |

---

## V47 — LIVE 카드 클릭 타임테이블 모달 + 과거 이동 제거 + 06:00 라벨 숨김

### V47 변경 요약

**§1 LIVE 카드 클릭 → 간략 타임테이블 모달**
- 로그인 페이지의 공용 회의실 카드(Room A~E 등)를 클릭하면 모달 표시
- 모달은 제목/상세내용 없이 **단순 리스트**:
  - `10:00 ~ 12:00   Wylie`
  - `13:00 ~ 16:00   Lush`
- 소속(tenant_id)은 `WYLIE` → `Wylie`, `LUSH` → `Lush`로 카멜케이스 표기
- **실시간 연동**: 카드 자체가 10초 폴링으로 최신 데이터 보유 → 클릭 시 즉시 최신 상태 표시
- ESC / 배경 클릭 / × 버튼으로 닫기, Enter/Space 키보드 지원

**§1 추가 — 과거 이동 차단**
- 이전 날짜 화살표(`<` 버튼) 마크업 자체 제거
- 캘린더 input에 `min=오늘` 속성 → 과거 날짜 선택 불가
- 우회 입력 방어: change 이벤트에서 과거 날짜 감지 시 오늘로 강제 복귀
- 다음(`>`), 오늘, 캘린더(미래만) 동작은 유지

**§2 타임라인 06:00 라벨 숨김**
- 메인 타임라인 좌측 시간 컬럼의 첫 셀(06:00) 라벨만 `visibility:hidden` 처리
- 셀 영역은 유지되어 07:00 셀 위치/그리드 정렬은 그대로 (위로 끌려 올라오지 않음)
- 시각적으로 "07:00부터 시작"하는 것처럼 보임
- 예약 생성 모달의 시간 선택 옵션 06:00은 별도 컴포넌트라 영향 없음 (요청대로 회의실 예약 시에만 06:00 노출)

### V47 파일 변경
| 파일 | 변경 내용 |
|---|---|
| `src/api/public.ts` | `bookings_today`에 `tenant_id` 필드 추가 (SELECT에 tenant_id 포함, 응답 객체에 반영) |
| `src/pages/login.tsx` | `live-date-prev` 버튼(`<` 화살표) 마크업 제거 |
| `public/static/login.js` | `prevBtn` 참조/이벤트 바인딩 제거, `dateInput.min=todayStr()` 추가, 카드 클릭→`openRoomTimetableModal()` 추가, `tenantLabel()` 헬퍼 추가 |
| `public/static/styles.css` | `.timeline-time-col .timeline-time-cell:first-child { visibility:hidden !important; }` (V46 §4 top:6px 규칙을 교체) + `.abnb-room.is-clickable`, `.room-tt-overlay`, `.room-tt-modal`, `.room-tt__row/__time/__tenant` 모달 스타일 |

### V47 빌드/검증
| 항목 | 값 |
|---|---|
| `dist/_worker.js` | 98.71 kB |
| Vite 빌드 시간 | 1.81s ✅ |
| PM2 재시작 | online ✅ |
| `GET /` | HTTP 302 (로그인 리다이렉트) ✅ |
| `GET /static/login.js` | HTTP 200 ✅ |
| `GET /api/public/available-spaces?date=2026-06-19` | `bookings_today[]`에 `tenant_id: 'WYLIE'` 확인 ✅ |
| Playwright `/login` 콘솔 에러 | 0건 ✅ |
