export const LoginPage = () => {
  return (
    <div class="login-canvas">
      <div class="login-card">
        <div class="brand-mark">
          <div class="brand-bars">
            <span></span><span></span><span></span>
          </div>
          <span class="brand-name">메이트리그라운드</span>
        </div>

        <h1 class="login-title">예약 시스템에<br />로그인하세요.</h1>
        <p class="login-sub">와일리·러쉬코리아 통합 공간 예약 플랫폼</p>

        <form id="login-form" class="login-form">
          <label class="field">
            <span class="field-label">이메일</span>
            <input type="email" name="email" required placeholder="name@company.co.kr" autoComplete="email" />
          </label>
          <label class="field">
            <span class="field-label">비밀번호</span>
            <input type="password" name="password" required placeholder="••••••••" autoComplete="current-password" />
          </label>

          <button type="submit" class="btn-primary btn-full">로그인</button>
          <div id="login-error" class="form-error"></div>
        </form>

        <div class="login-hint">
          <div class="hint-title">데모 계정</div>
          <div class="hint-row"><span class="tag tag-blue">와일리 Admin</span> admin@wylie.co.kr / admin1234</div>
          <div class="hint-row"><span class="tag tag-dark">러쉬 Admin</span> admin@lush.co.kr / admin1234</div>
          <div class="hint-row"><span class="tag tag-soft">멤버</span> hgpark@wylie.co.kr / user1234</div>
        </div>
      </div>

      <script src="/static/login.js"></script>
    </div>
  );
};
