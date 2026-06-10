# 데이터베이스 (DB)

이 폴더는 **메이트리그라운드(Mateground) V7** 시점의 **로컬 Cloudflare D1 SQLite 데이터베이스 풀 덤프**를 포함합니다.

## 파일 구성

| 파일 | 설명 |
|---|---|
| `database_dump.sql` | 로컬 D1 (`webapp-production` 바인딩, `.wrangler/state/v3/d1/...sqlite`)의 `.dump` 결과 — 스키마 + 모든 데이터(INSERT 포함) |

## 포함 테이블 (10개)

1. `d1_migrations` — D1 마이그레이션 추적
2. `_cf_METADATA` — Cloudflare 메타데이터
3. `tenants` — 테넌트 (WYLIE, LUSH)
4. `users` — 회원(어드민 / 일반)
5. `spaces` — 공간(회의실 등) — `tenant_scope` 컬럼으로 멀티 테넌트 격리
6. `departments` — 부서 마스터 (V4)
7. `positions` — 직책 마스터 (V4)
8. `reservations` — 예약
9. `recurring_rules` — 반복 예약 규칙
10. `sessions` — 로그인 세션

## 복원 방법

### 로컬 D1로 복원

```bash
# 1. 기존 로컬 DB 삭제 (선택)
rm -rf .wrangler/state/v3/d1

# 2. 마이그레이션 먼저 적용 (선택 — 덤프에 스키마 포함이지만 안전을 위해)
npx wrangler d1 migrations apply webapp-production --local

# 3. 덤프 import
npx wrangler d1 execute webapp-production --local --file=./db/database_dump.sql
```

### 직접 sqlite3로 복원

```bash
sqlite3 restored.sqlite < db/database_dump.sql
```

## 시드 데이터 요약 (V7 덤프 기준)

- **테넌트**: WYLIE, LUSH (2개)
- **관리자 계정**:
  - `admin@wylie.co.kr` (WYLIE 관리자)
  - `admin@lush.co.kr` (LUSH 관리자)
- **공간 격리(V5)**: `tenant_scope` 컬럼으로 WYLIE 전용/LUSH 전용/공통 공간 구분
  - 예: `5층 회의실`은 WYLIE 전용, `파라다이스룸`은 LUSH 전용
- **부서/직책(V4)**: 테넌트별 마스터 데이터

## 주의

- 이 덤프는 **개발 시점 스냅샷**입니다. 운영 D1과는 별개이며, 실제 운영 데이터는 Cloudflare 콘솔에서 백업하세요.
- INSERT문이 106개 들어 있어 V4/V5/V6/V7 동안 생성된 모든 테스트 데이터(예약, 멤버, 부서, 직책)가 포함됩니다.
