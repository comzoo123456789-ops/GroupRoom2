document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = '로그인 중...';

  const data = new FormData(form);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
    });
    const json = await res.json();
    if (!res.ok) {
      errEl.textContent = json.error || '로그인에 실패했습니다.';
      btn.disabled = false; btn.textContent = '로그인';
      return;
    }
    window.location.href = '/home';
  } catch (err) {
    errEl.textContent = '서버에 접속할 수 없습니다.';
    btn.disabled = false; btn.textContent = '로그인';
  }
});
