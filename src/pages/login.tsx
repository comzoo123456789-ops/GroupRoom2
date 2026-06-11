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
        <div class="abnb-brand-mark" aria-hidden="true">
          <span></span><span></span>
        </div>
        <h1 class="abnb-gate__title">MATRI BUILDING</h1>
        <p class="abnb-gate__sub">Wylie &amp; Lush Shared Workspace</p>
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
            <span class="abnb-card__foot-note">60초마다 자동 갱신</span>
          </div>
        </section>

        {/* 우측: 로그인 폼 */}
        <section class="abnb-card abnb-card--login">
          <h2 class="abnb-card__title abnb-card__title--solo">로그인</h2>

          <form id="login-form" class="abnb-form">
            <label class="abnb-field">
              <span class="abnb-field__label">이메일 주소</span>
              <input type="email" name="email" required placeholder="example@wylie.co.kr" autoComplete="email" />
            </label>
            <label class="abnb-field">
              <span class="abnb-field__label">비밀번호</span>
              <input type="password" name="password" required placeholder="••••••••" autoComplete="current-password" />
            </label>

            <button type="submit" class="abnb-btn abnb-btn--gradient">공간 입장하기</button>
            <div id="login-error" class="abnb-form__error"></div>
          </form>

          <div class="abnb-hint">
            <div class="abnb-hint__title">DEMO ACCOUNTS</div>
            <div class="abnb-hint__row">
              <span class="abnb-tag abnb-tag--wylie">와일리 Admin</span>
              <code>admin@wylie.co.kr / admin1234</code>
            </div>
            <div class="abnb-hint__row">
              <span class="abnb-tag abnb-tag--lush">러쉬 Admin</span>
              <code>admin@lush.co.kr / admin1234</code>
            </div>
            <div class="abnb-hint__row">
              <span class="abnb-tag abnb-tag--member">멤버</span>
              <code>hgpark@wylie.co.kr / user1234</code>
            </div>
          </div>
        </section>
      </main>

      <footer class="abnb-gate__footer">
        © MATEGROUND · WYLIE &amp; LUSH KOREA
      </footer>

      <script src="/static/login.js"></script>
    </div>
  );
};
