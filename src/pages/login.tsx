/**
 * V32 §1 — 로그인 게이트 에어비앤비 DLS 전면 개편
 *
 *  - 오프 화이트 배경(#f7f7f7)
 *  - MATRI BUILDING 브랜드 헤더
 *  - 좌측 1.3 fr: 실시간 공용 회의실 가용판 (Meeting Room A~E 5개)
 *  - 우측 1.0 fr: SIGN IN 폼 + 그라디언트 로그인 버튼
 *  - 카드: 12px 라운드 + 1px solid #ebebeb + soft shadow
 *  - 알약(pill) 배지로 즉시 사용 가능 / 사용 중 표시
 *  - 모바일: 1열 스택
 *  - 전용룸(Conference Room / 파라다이스룸)은 백엔드 단에서 무조건 제외
 */
export const LoginPage = () => {
  return (
    <div class="abnb-gate">
      {/* 상단 브랜드 헤더 */}
      <header class="abnb-gate__brand">
        {/* V38: II 두 막대 → M 모양 SVG 마크로 교체 (app.js 글로벌 nav 로고와 동일한 path) */}
        <div class="abnb-brand-mark abnb-brand-mark--svg" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 23 L4 5 L14 18 L24 5 L24 23" />
          </svg>
        </div>
        <h1 class="abnb-gate__title">메이트리그라운드</h1>
        <p class="abnb-gate__sub">와일리 &amp; 러쉬 공유 워크스페이스</p>
      </header>

      <main class="abnb-gate__grid">
        {/* 좌측: 실시간 회의실 가용판 */}
        <section class="abnb-card abnb-card--live">
          <div class="abnb-card__head">
            <h2 class="abnb-card__title">
              <span class="abnb-pulse" aria-hidden="true"></span>
              이용 가능한 공용 회의실
            </h2>
            <span class="abnb-card__badge" id="live-clock">LIVE</span>
          </div>

          {/* V42 §2: 날짜 네비게이션 — < > 화살표 + 오늘 버튼 + 캘린더 input */}
          <div class="live-date-nav" id="live-date-nav">
            <button type="button" class="live-date-nav__btn" id="live-date-prev" aria-label="이전 날짜">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button type="button" class="live-date-nav__label" id="live-date-label">
              오늘
            </button>
            <input type="date" id="live-date-input" class="live-date-nav__input" />
            <button type="button" class="live-date-nav__btn" id="live-date-next" aria-label="다음 날짜">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
            <button type="button" class="live-date-nav__today" id="live-date-today" title="오늘로 이동">
              오늘
            </button>
          </div>

          <div id="live-rooms-grid" class="abnb-rooms-grid" aria-live="polite">
            <div class="abnb-room abnb-room--skeleton">
              <div class="abnb-room__name">로딩 중…</div>
            </div>
            <div class="abnb-room abnb-room--skeleton">
              <div class="abnb-room__name">로딩 중…</div>
            </div>
            <div class="abnb-room abnb-room--skeleton">
              <div class="abnb-room__name">로딩 중…</div>
            </div>
            <div class="abnb-room abnb-room--skeleton">
              <div class="abnb-room__name">로딩 중…</div>
            </div>
            <div class="abnb-room abnb-room--skeleton">
              <div class="abnb-room__name">로딩 중…</div>
            </div>
          </div>

          <div class="abnb-card__foot">
            <span id="live-updated-at" class="abnb-card__foot-text">곧 업데이트됩니다…</span>
            <span class="abnb-card__foot-note" id="live-foot-note">10초마다 자동 갱신</span>
          </div>
        </section>

        {/* 우측: 로그인 폼 */}
        <section class="abnb-card abnb-card--login">
          <h2 class="abnb-card__title abnb-card__title--solo">로그인</h2>

          <form id="login-form" class="abnb-form">
            {/* V42 §3: 이메일 input + 도메인 셀렉트 분리
                - 사용자: 'bhmoon' 만 입력하고 옆에서 @wylie.co.kr / @lush.co.kr 선택
                - input type="text" 로 변경 (브라우저 email validator가 '@' 없는 값을 거부하기 때문)
                - 도메인 선택값이 비어있으면(직접 입력 모드) input 에 풀 이메일을 직접 적을 수도 있음
            */}
            <label class="abnb-field">
              <span class="abnb-field__label">이메일 주소</span>
              <div class="login-email-row">
                <input
                  type="text"
                  name="email"
                  required
                  placeholder="bhmoon"
                  autoComplete="username"
                  inputMode="email"
                  class="login-email-input"
                />
                <select id="login-email-domain" class="login-email-domain" aria-label="이메일 도메인 선택">
                  <option value="@wylie.co.kr">@wylie.co.kr</option>
                  <option value="@lush.co.kr">@lush.co.kr</option>
                  <option value="">직접 입력</option>
                </select>
              </div>
              <span class="abnb-field__hint">아이디만 입력하고 옆에서 도메인을 선택하세요.</span>
            </label>
            <label class="abnb-field">
              <span class="abnb-field__label">비밀번호</span>
              <input type="password" name="password" required placeholder="••••••••" autoComplete="current-password" />
            </label>

            <button type="submit" class="abnb-btn abnb-btn--gradient">공간 입장하기</button>
            <div id="login-error" class="abnb-form__error"></div>
          </form>
          {/* V33 §2: DEMO ACCOUNTS 블록 완전 삭제 — 사용자 요청에 따라 노출 금지 */}
        </section>
      </main>

      <footer class="abnb-gate__footer">
        © 메이트리그라운드 · 와일리 &amp; 러쉬 코리아
      </footer>

      <script src="/static/login.js"></script>
    </div>
  );
};
