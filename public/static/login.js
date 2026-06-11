/* =========================================================
 * V15 §1 — 로그인 페이지 클라이언트 스크립트
 *  · 60초 주기 폴링으로 공용 회의실 가용 현황 갱신
 *  · 로그인 폼 제출 처리
 * ========================================================= */
(function () {
  'use strict';

  const POLL_MS = 60 * 1000;

  // ───── 1. 폼 제출 ─────
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('login-error');
      errEl.textContent = '';
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = '입장 중…';

      const data = new FormData(form);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.get('email'),
            password: data.get('password'),
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          errEl.textContent = json.error || '로그인에 실패했습니다.';
          btn.disabled = false;
          btn.textContent = '공간 입장하기';
          return;
        }
        window.location.href = '/home';
      } catch (err) {
        errEl.textContent = '서버에 접속할 수 없습니다.';
        btn.disabled = false;
        btn.textContent = '공간 입장하기';
      }
    });
  }

  // ───── 2. 실시간 가용 회의실 폴링 ─────
  const grid = document.getElementById('live-rooms-grid');
  const updatedAt = document.getElementById('live-updated-at');
  const liveClock = document.getElementById('live-clock');

  if (!grid) return;

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function formatNowLabel() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function renderRooms(rooms, nowText) {
    if (!Array.isArray(rooms) || rooms.length === 0) {
      grid.innerHTML = '<div class="abnb-room abnb-room--empty">표시할 공용 회의실이 없습니다.</div>';
      return;
    }
    grid.innerHTML = rooms
      .map((r) => {
        if (r.available) {
          const sub = r.next_busy_at
            ? `${r.next_busy_at}까지 가용`
            : '오늘 남은 시간 모두 가용';
          return `
            <div class="abnb-room abnb-room--ok">
              <div class="abnb-room__name">${escapeHtml(r.name)}</div>
              <div class="abnb-room__meta">정원 ${Number(r.capacity) || '-'}명</div>
              <span class="abnb-room__chip abnb-room__chip--ok">즉시 사용 가능</span>
              <div class="abnb-room__sub">${escapeHtml(sub)}</div>
            </div>`;
        }
        return `
          <div class="abnb-room abnb-room--busy">
            <div class="abnb-room__name">${escapeHtml(r.name)}</div>
            <div class="abnb-room__meta">정원 ${Number(r.capacity) || '-'}명</div>
            <span class="abnb-room__chip abnb-room__chip--busy">사용 중</span>
            <div class="abnb-room__sub">${escapeHtml(r.current_end_at || '')}에 종료 예정</div>
          </div>`;
      })
      .join('');
    if (updatedAt) {
      updatedAt.textContent = `현재 시각 ${nowText} 기준 · 마지막 갱신 ${formatNowLabel()}`;
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchOnce() {
    if (liveClock) liveClock.classList.add('is-fetching');
    try {
      const res = await fetch('/api/public/available-spaces', { cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      const json = await res.json();
      const nowText = json && json.now ? json.now.time : '--:--';
      renderRooms((json && json.rooms) || [], nowText);
    } catch (err) {
      if (updatedAt) updatedAt.textContent = '실시간 정보를 불러오지 못했습니다. 잠시 후 다시 시도합니다.';
    } finally {
      if (liveClock) liveClock.classList.remove('is-fetching');
    }
  }

  // 초기 fetch + 60초 폴링
  fetchOnce();
  setInterval(fetchOnce, POLL_MS);
})();
