# 메이트리그라운드 (Mateground) - 통합 예약 시스템

> **와일리(WYLIE) × 러쉬코리아(LUSH)** 1층 공용 공간 통합 예약 플랫폼
> Apple-inspired design system · Cloudflare Pages + Hono + D1

---

## 📋 프로젝트 개요

- **프로젝트명**: 메이트리그라운드 1F 공용 공간 통합 예약 시스템
- **목적**: 와일리와 러쉬코리아 임직원이 공유하는 1층 라운지·회의 공간의 실시간 자원 조율 및 양사 독립 관리
- **테넌트 운영 원칙**:
  - 통합된 예약 타임라인 공유로 공간 충돌 방지
  - 각 회사 관리자는 본인 회사 데이터만 격리 관리 (Multi-Tenant)

---

## 🌐 공개 URL

- **로컬 개발 (Sandbox)**: https://3000-iylt8ni2z01kxtgymrr7e-02b9cc79.sandbox.novita.ai
- **로그인 페이지**: `/login`
- **Production**: (미배포)
- **GitHub**: (미연동)

---

## ✅ 구현 완료 기능

### 1. 인증 & 멀티 테넌시
- ✅ 이메일/비밀번호 로그인 (SHA-256 + 세션 쿠키)
- ✅ 테넌트 분리 (`tenant_id`: `WYLIE` / `LUSH`)
- ✅ API 단 테넌트 데이터 격리 (관리자도 본인 회사 데이터만 CRUD)
- ✅ 어드민 / 일반 멤버 역할 분리

### 2. 공간 자원 관리
- ✅ 7개 공간 시드:
  - **미팅룸** (3개 제한 카운트 포함): Meeting Room A, B, C, D, E
  - **공용공간** (제한 제외): Lounge, Recharging Zone

### 3. 핵심 비즈니스 로직
- ✅ **회사당 동시 3개 미팅룸 제한**: 같은 회사·동일 시간대 미팅룸은 최대 3개
- ✅ **Admin Bypass**: 관리자는 5개 미팅룸 전부 동시 예약 가능
- ✅ **공용공간 제외**: Lounge, Recharging Zone은 제한 카운트 무관
- ✅ **충돌 검증**: 동일 공간/시간 중복 예약 방지
- ✅ **반복 예약 엔진**: 매일/매주/매월, 종료일 또는 횟수 기반
- ✅ **충돌 자동 안내**: 반복 예약 중 일부 충돌 시 "충돌 일자 제외하고 예약" 옵션

### 4. UI/UX
- ✅ **타임라인 드래그&드롭**: 24시간 × 7개 공간 그리드, 마우스 드래그로 시간 영역 지정
- ✅ **자동 완성 팝업**: 드래그 종료 시 [날짜·시간·공간] 자동 바인딩
- ✅ **홈 대시보드**: 다가오는 일정 타임라인 리스트
- ✅ **인사이트 통계**: 평균 회의 시간 / 인기 회의실 TOP 5 / 요일·시간대 히트맵
- ✅ **관리자 페이지**: 일반 / 멤버 / 공간 3개 섹션
- ✅ **멤버 등록**: 개별 등록 / 일괄 등록 (테이블 입력)
- ✅ **실시간 동기화**: 3초 폴링 기반 자동 새로고침
- ✅ **현재 시각 라인**: 오늘 날짜에 빨간 가로선으로 현재 시각 표시

### 5. 디자인 시스템 - Apple-inspired
- **Action Blue**: `#0066cc` (모든 상호작용 단일 색상)
- **Near-Black Ink**: `#1d1d1f` (텍스트 및 다크 표면)
- **Parchment**: `#f5f5f7` (배경 톤)
- **Typography**: Inter (SF Pro Display/Text 대체), 17px 본문, 음수 letter-spacing
- **Radius**: pill(9999px) · lg(18px) · md(11px) · sm(8px)
- **Shadow**: 미니멀 — 모달과 product 영역에만 적용

---

## 🌐 API 엔드포인트

### 인증
| Method | Path | 설명 |
|---|---|---|
| POST | `/api/auth/login` | 로그인 (email, password) |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 정보 |

### 공간
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/spaces` | 공간 목록 조회 |

### 예약
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/reservations?date=YYYY-MM-DD` | 특정 일자 모든 예약 (통합 타임라인) |
| GET | `/api/reservations?start=&end=` | 기간 조회 |
| GET | `/api/reservations/upcoming` | 내 다가오는 예약 |
| POST | `/api/reservations` | 예약 생성 (반복/단일) |
| PATCH | `/api/reservations/:id` | 예약 수정 |
| DELETE | `/api/reservations/:id` | 예약 취소 |

### 멤버 (Admin)
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/members` | 본인 회사 멤버 목록 |
| GET | `/api/members/search?q=` | 멤버 검색 |
| POST | `/api/members` | 개별 등록 |
| POST | `/api/members/bulk` | 일괄 등록 |
| DELETE | `/api/members/:id` | 멤버 삭제 |

### 인사이트
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/insights/overview?days=30` | 통계 (평균 시간/인기 공간/히트맵) |

---

## 👤 데모 계정

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 와일리 Admin | `admin@wylie.co.kr` | `admin1234` |
| 러쉬 Admin | `admin@lush.co.kr` | `admin1234` |
| 와일리 멤버 | `hgpark@wylie.co.kr` | `user1234` |
| 와일리 멤버 | `djohn@wylie.co.kr` | `user1234` |
| 러쉬 멤버 | `branch@lush.co.kr` | `user1234` |
| 러쉬 멤버 | `jpark@lush.co.kr` | `user1234` |

---

## 🧩 데이터 아키텍처

### 주요 테이블
- **tenants**: 회사 정보 (`WYLIE`, `LUSH`)
- **users**: 임직원 (tenant_id, role, status, avatar_color)
- **spaces**: 7개 공간 자원 (count_in_limit 플래그로 3개 제한 카운트 포함 여부 결정)
- **reservations**: 예약 (tenant_id, user_id, space_id, date, start_time, end_time, recurring_rule_id, created_by_admin)
- **recurring_rules**: 반복 규칙 (frequency, end_type, end_date, end_count)
- **sessions**: 로그인 세션 (token 기반, 7일 유효)

### 데이터 플로우
1. **로그인** → SHA-256 검증 → sessions 토큰 발급 → HttpOnly 쿠키
2. **타임라인 조회** → date 파라미터로 통합 예약 조회 (모든 테넌트 표시)
3. **예약 생성** → 충돌 검증 → 3개 제한 검증 (Admin 시 Bypass) → reservations INSERT
4. **반복 예약** → recurring_rules INSERT → N일치 reservations 일괄 생성
5. **3초 폴링** → 클라이언트가 변경 감지 시 이벤트만 부분 갱신

---

## 📖 사용 가이드

### 1. 로그인
1. `/login` 접속
2. 데모 계정 입력 (페이지 하단에 표시됨)

### 2. 예약 만들기 (드래그&드롭)
1. 상단 **공간** 탭 클릭
2. 원하는 공간 컬럼의 시간대를 마우스로 **드래그**
3. 자동 팝업에서 일정명 입력 → **예약하기**

### 3. 반복 예약
1. 예약 모달 좌측 상단 **"반복 없음"** 칩 클릭
2. 매일/매주/매월 선택 → 종료 조건 (날짜 또는 횟수) 설정
3. 충돌 발생 시 "충돌 일자 제외하고 예약" 옵션 선택 가능

### 4. 관리자 - 멤버 등록
1. 상단 **관리** 탭 → 좌측 **멤버**
2. **초대하기** 버튼 → 개별/일괄 선택
3. 즉시 활성 계정 생성 (초기 비밀번호: `user1234`)

---

## 🛠 기술 스택

- **Frontend**: Vanilla JS (SPA), Day.js, Chart.js, Font Awesome
- **Backend**: Hono (Cloudflare Workers 호환)
- **Database**: Cloudflare D1 (SQLite) - 로컬 개발 모드
- **Auth**: SHA-256 + Session Token + HttpOnly Cookie
- **Build**: Vite + @hono/vite-build/cloudflare-pages
- **Process**: PM2 (개발 환경 데몬)

---

## 🚀 배포 정보

- **플랫폼**: Cloudflare Pages
- **상태**: 🟡 로컬 개발 환경 활성 (Production 미배포)
- **로컬 실행**:
  ```bash
  cd /home/user/webapp
  npm run build
  npx wrangler d1 migrations apply webapp-production --local
  npx wrangler d1 execute webapp-production --local --file=./seed.sql
  pm2 start ecosystem.config.cjs
  ```
- **마지막 업데이트**: 2026-06-09

---

## 🧪 핵심 비즈니스 로직 검증 결과

| 테스트 | 결과 |
|---|---|
| 멤버 - Meeting Room A, B, C 동시 시간대 예약 | ✅ 모두 성공 |
| 멤버 - Meeting Room D (4번째) 예약 시도 | ✅ **3개 제한 차단** |
| Admin - Meeting Room D 추가 예약 | ✅ **Bypass 성공** |
| Lounge 예약 (제한 카운트 제외) | ✅ 제한 미적용 |
| 멀티테넌트 격리 (러쉬 Admin이 와일리 멤버 조회) | ✅ **본인 회사 4명만 표시** |
| 매주 5회 반복 예약 | ✅ 5건 자동 생성 |
| 통계/히트맵 데이터 | ✅ 정상 집계 |

---

## 📌 미구현 / 다음 단계 (Next Steps)

- [ ] Cloudflare Pages Production 배포 (사용자 Cloudflare API 토큰 필요)
- [ ] GitHub 저장소 연결
- [ ] 참석자 검색 및 알림 기능 (외부 이메일 발송)
- [ ] 모바일 전용 인터페이스 (현재는 반응형 기본 지원)
- [ ] 디바이스 연동 (회의실 입구 패널)
- [ ] 공지사항 (Announcements) 기능
- [ ] 비밀번호 변경 / 프로필 편집
- [ ] WebSocket 기반 실시간 동기화로 업그레이드 (현재 3초 폴링)
