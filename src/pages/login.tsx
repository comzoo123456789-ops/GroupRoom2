/**
 * V15 §1, §3 — 로그인 페이지 전면 개편
 *
 *  - 라벤더 블루(#dfe7f7) 매트 배경
 *  - 직각 미니멀(border-radius: 4px), box-shadow 없음, 1px 사파이어 라인(#1a365d)
 *  - 좌측: 실시간 예약 가능 공용 회의실 현황판 (60초 폴링)
 *  - 우측: 로그인 폼
 *  - 모바일에서는 자연스럽게 1열 스택
 */
export const LoginPage = () => {
  return (
    <div class="lux-gate">
      {/* 상단 브랜드 헤더 */}
      <header class="lux-gate__header">
        <div class="lux-gate__brand">
          <div class="lux-brand-mark" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <div class="lux-gate__title-block">
            <h1 class="lux-gate__title">MATEGROUND</h1>
            <p class="lux-gate__sub">와일리 · 러쉬코리아 통합 공간 예약 플랫폼</p>
          </div>
        </div>
      </header>

      <main class="lux-gate__layout">
        {/* 좌측: 실시간 회의실 가용판 */}
        <section class="lux-card lux-card--live">
          <div class="lux-card__head">
            <h2 class="lux-card__title">
              <span class="lux-pulse" aria-hidden="true"></span>
              실시간 예약 가능 회의실
            </h2>
            <span class="lux-card__badge" id="live-clock">LIVE</span>
          </div>

          <div id="live-rooms-grid" class="lux-rooms-grid" aria-live="polite">
            {/* JS가 60초 간격으로 채워 넣음. 초기 placeholder. */}
            <div class="lux-room lux-room--skeleton">로딩 중…</div>
            <div class="lux-room lux-room--skeleton">로딩 중…</div>
            <div class="lux-room lux-room--skeleton">로딩 중…</div>
            <div class="lux-room lux-room--skeleton">로딩 중…</div>
            <div class="lux-room lux-room--skeleton">로딩 중…</div>
          </div>

          <div class="lux-card__foot">
            <span id="live-updated-at" class="lux-card__foot-text">곧 업데이트됩니다…</span>
            <span class="lux-card__foot-note">60초마다 자동 갱신</span>
          </div>
        </section>

        {/* 우측: 로그인 폼 */}
        <section class="lux-card lux-card--login">
          <div class="lux-card__head">
            <h2 class="lux-card__title lux-card__title--plain">SIGN IN</h2>
            <span class="lux-card__badge lux-card__badge--ghost">SECURE</span>
          </div>

          <form id="login-form" class="lux-form">
            <label class="lux-field">
              <span class="lux-field__label">EMAIL</span>
              <input type="email" name="email" required placeholder="name@company.co.kr" autoComplete="email" />
            </label>
            <label class="lux-field">
              <span class="lux-field__label">PASSWORD</span>
              <input type="password" name="password" required placeholder="••••••••" autoComplete="current-password" />
            </label>

            <button type="submit" class="lux-btn lux-btn--primary">로그인</button>
            <div id="login-error" class="lux-form__error"></div>
          </form>

          <div class="lux-hint">
            <div class="lux-hint__title">DEMO ACCOUNTS</div>
            <div class="lux-hint__row">
              <span class="lux-tag lux-tag--wylie">와일리 Admin</span>
              <code>admin@wylie.co.kr / admin1234</code>
            </div>
            <div class="lux-hint__row">
              <span class="lux-tag lux-tag--lush">러쉬 Admin</span>
              <code>admin@lush.co.kr / admin1234</code>
            </div>
            <div class="lux-hint__row">
              <span class="lux-tag lux-tag--member">멤버</span>
              <code>hgpark@wylie.co.kr / user1234</code>
            </div>
          </div>
        </section>
      </main>

      <footer class="lux-gate__footer">
        © MATEGROUND · WYLIE & LUSH KOREA
      </footer>

      <script src="/static/login.js"></script>
    </div>
  );
};
