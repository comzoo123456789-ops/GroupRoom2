# 집에서 개발하기 (GroupRoom)

## 0. 처음 한 번만 설치

- **Node.js 20+** : https://nodejs.org (LTS)
- **Git** : https://git-scm.com
- **VS Code** : https://code.visualstudio.com
- (배포하려면) Cloudflare 계정 로그인 → 아래 4번

## 1. 저장소 받기 (집 컴퓨터에서 최초 1회)

```bash
git clone https://github.com/comzoo123456789-ops/GroupRoom2.git
cd GroupRoom2
npm install
```

## 2. 로컬 개발 서버 실행

```bash
npm run db:migrate:local   # 로컬 D1(SQLite)에 테이블 생성 (컴퓨터마다 1회)
npm run dev                # http://localhost:5173
```

- 브라우저 접속 → 화면의 **"데모 데이터 생성"** 클릭 (회의실 A~E + 예약 시드)
- 로그인: `admin@demo.com` / `admin1234`
- ⚠️ 로컬 DB는 **컴퓨터마다 따로**입니다. 집에서 처음엔 데이터가 비어 있으니 "데모 데이터 생성"을 다시 눌러야 함.

## 3. 매일 작업 흐름 (⭐ 두 컴퓨터 오갈 때 필수)

```bash
# 작업 시작 전 — 항상 먼저!
git pull

# ... 코드 수정 ...

# 작업 끝나면
git add -A
git commit -m "무엇을 했는지 한 줄"
git push
```

> 집에서 `git pull` 안 하고 시작하면 충돌 납니다. **시작=pull, 끝=push** 습관화!

## 4. Cloudflare 배포 (선택)

```bash
npx wrangler login         # 최초 1회, 브라우저 인증 (bhmoon@wylie.co.kr 계정)
npm run deploy             # 빌드 + 배포 → https://grouproom.bhmoon.workers.dev
```

- 원격 DB 스키마 변경 시: `npm run db:migrate:remote`
- 로컬 개발만 하면 로그인 불필요.

## 명령어 요약

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (프론트+API+DO 통합) |
| `npm run build` | 타입체크 + 빌드 |
| `npm run deploy` | 빌드 후 Cloudflare 배포 |
| `npm run typecheck` | 타입 검사만 |
| `npm run db:migrate:local` | 로컬 D1 마이그레이션 |
| `npm run db:migrate:remote` | 원격 D1 마이그레이션 |

## VS Code 단축키 (자주 쓰는 것)

| 단축키 | 기능 |
|---|---|
| `Ctrl + \`` | 터미널 열기/닫기 |
| `Ctrl + Shift + G` | 소스 컨트롤(Git) 패널 |
| `Ctrl + P` | 파일 빠르게 열기 |
| `Ctrl + Shift + P` | 명령 팔레트(모든 기능 검색) |
| `Ctrl + S` | 저장 |
| `Ctrl + B` | 사이드바 토글 |
| `Ctrl + /` | 주석 토글 |
| `F2` | 변수/함수 이름 일괄 변경 |

### VS Code Git 패널로 커밋 (터미널 없이)
1. `Ctrl + Shift + G` → 변경 파일 확인
2. 파일 옆 `+` 로 스테이징 (또는 전체 `+`)
3. 메시지 입력 후 `Ctrl + Enter` (커밋)
4. 하단 상태바 동기화 아이콘(↻) 클릭 = pull & push
