# GroupRoom

**프리미엄 사내 회의실 예약 SaaS** — Cloudflare Workers + D1 + Durable Objects + React(Vite).

국내 경쟁 솔루션(마일·ATEN 등)의 약점인 **UI/UX · 실시간성 · 분석**을 정면으로 공략하는,
판매를 목표로 한 새 제품. 완전히 처음부터(from scratch) 구축.

> 기존 메이트리 V47은 `matree-legacy` 브랜치에 보존되어 있음. `main`은 새 제품.

## 아키텍처

| 레이어 | 기술 |
|---|---|
| 프론트 | React 19 + Vite 8 + TypeScript |
| API | Cloudflare Workers + Hono |
| DB | Cloudflare D1 (SQLite) |
| 실시간 | Durable Objects (`RoomHub`, WebSocket 브로드캐스트) |
| 배포 | Wrangler |

- `src/client/` — React SPA (정적 에셋으로 서빙)
- `src/worker/` — Hono API (`/api/*`) + Durable Object
- `src/shared/` — 클라이언트·워커 공유 타입
- `migrations/` — D1 스키마

`/api/*` 요청만 Worker가 처리하고 나머지는 SPA로 서빙된다 (`wrangler.jsonc`의 `run_worker_first`).

## 로컬 개발

```bash
npm install

# 1) D1 데이터베이스 생성 후 database_id를 wrangler.jsonc에 반영
npx wrangler d1 create grouproom-db
#   → 출력된 database_id를 wrangler.jsonc의 "REPLACE_AFTER_d1_create" 자리에 붙여넣기

# 2) 로컬 마이그레이션 적용
npm run db:migrate:local

# 3) 개발 서버 (프론트 + API + DO 통합)
npm run dev
```

브라우저에서 접속 → 현황판의 **"데모 데이터 생성"** 버튼으로 조직·회의실·예약을 시드.
로그인: `admin@demo.com` / `admin1234`

## 배포

```bash
npm run db:migrate:remote   # 원격 D1 마이그레이션
npm run deploy              # 빌드 + wrangler deploy
```

## 현재 구현 (1차 뼈대)

- ✅ 실시간 현황판(도면 기반) + Durable Object WebSocket 실시간 반영
- ✅ 예약 생성/취소/체크인 API (INTEGER 시간 → 자정넘김·충돌검증 정확)
- ✅ 멀티테넌트 + 화이트라벨(조직 브랜드색 런타임 주입)
- ✅ salt + PBKDF2 인증, 세션 쿠키
- ✅ 프리미엄 라이트 디자인 시스템(토큰·라인아이콘)

## 다음 (로드맵)

- ⬜ 예약 타임라인(드래그 생성/이동/리사이즈, 반복예약, 참석자)
- ⬜ 이용 분석 대시보드(가동률·히트맵·실제 노쇼율)
- ⬜ 디지털 사이니지(문 앞 태블릿 뷰)
- ⬜ 실제 알림(이메일/푸시)
- ⬜ AI 스케줄링 추천
- ⬜ 관리자(멤버/공간/규칙) + 감사로그 뷰어
