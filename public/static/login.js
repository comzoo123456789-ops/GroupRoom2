/* =========================================================
 * 로그인 페이지 클라이언트 스크립트
 *  · V15: 60초 폴링으로 공용 회의실 가용 현황 갱신
 *  · V40: 폴링 10초로 단축 + 탭 가시성 즉시 갱신
 *  · V42 §2: 날짜 네비게이션(< > 화살표 + 캘린더) — 미래/과거 날짜의
 *           회의실 예약 슬롯 조회 지원. 오늘이 아닌 날은 폴링 중단.
 * ========================================================= */
(function () {
  'use strict';

  const POLL_MS = 10 * 1000;

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
      // V42 §3: 이메일 입력값 + 선택된 도메인 셀렉트를 결합 (login.tsx 의 V42 §3 마크업과 호환)
      const rawEmail = String(data.get('email') || '').trim();
      const domainSel = document.getElementById('login-email-domain');
      const domainVal = domainSel ? domainSel.value : '';
      // username 만 입력 + 도메인 selected → 합치기. 이미 '@' 가 있으면 사용자 입력 그대로 사용
      let finalEmail = rawEmail;
      if (rawEmail && !rawEmail.includes('@') && domainVal) {
        finalEmail = rawEmail + domainVal;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: finalEmail,
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

  // ───── 2. 실시간 가용 회의실 폴링 + V42 §2: 날짜 네비게이션 ─────
  const grid = document.getElementById('live-rooms-grid');
  const updatedAt = document.getElementById('live-updated-at');
  const liveClock = document.getElementById('live-clock');
  const dateLabel = document.getElementById('live-date-label');
  const dateInput = document.getElementById('live-date-input');
  const prevBtn = document.getElementById('live-date-prev');
  const nextBtn = document.getElementById('live-date-next');
  const todayBtn = document.getElementById('live-date-today');
  const footNote = document.getElementById('live-foot-note');

  if (!grid) return;

  function pad(n) { return String(n).padStart(2, '0'); }
  function formatNowLabel() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // V42 §2: 오늘 날짜(KST)를 YYYY-MM-DD로
  //   브라우저 로컬 타임존 사용 (KST 환경 가정). 필요시 서버에서 받은 now.date 로 동기화도 가능.
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function addDays(dateStr, delta) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function formatHumanDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dows = ['일', '월', '화', '수', '목', '금', '토'];
    const dow = dows[d.getDay()];
    const today = todayStr();
    let suffix = '';
    if (dateStr === today) suffix = ' · 오늘';
    else if (dateStr === addDays(today, 1)) suffix = ' · 내일';
    else if (dateStr === addDays(today, -1)) suffix = ' · 어제';
    return `${month}월 ${day}일 (${dow})${suffix}`;
  }

  // 상태
  let viewDate = todayStr();          // 현재 보고 있는 날짜
  let pollTimer = null;

  function isViewToday() { return viewDate === todayStr(); }

  function renderRooms(rooms, payload) {
    if (!Array.isArray(rooms) || rooms.length === 0) {
      grid.innerHTML = '<div class="abnb-room abnb-room--empty">표시할 공용 회의실이 없습니다.</div>';
      return;
    }
    const isToday = payload && payload.is_today;

    grid.innerHTML = rooms
      .map((r) => {
        const bookings = (r.bookings_today || []);
        // 오늘이 아닌 경우 — 가용성 판정이 없으므로 그 날 예약 슬롯 리스트로 표시
        if (!isToday) {
          if (bookings.length === 0) {
            return `
              <div class="abnb-room abnb-room--ok">
                <div class="abnb-room__name">${escapeHtml(r.name)}</div>
                <span class="abnb-room__chip abnb-room__chip--ok">예약 없음</span>
                <div class="abnb-room__sub">하루 종일 사용 가능</div>
              </div>`;
          }
          const slotsHtml = bookings
            .map((b) => `<span class="abnb-room__slot">${escapeHtml(b.start)}–${escapeHtml(b.end)}</span>`)
            .join('');
          return `
            <div class="abnb-room abnb-room--scheduled">
              <div class="abnb-room__name">${escapeHtml(r.name)}</div>
              <span class="abnb-room__chip abnb-room__chip--scheduled">${bookings.length}건 예약됨</span>
              <div class="abnb-room__slots">${slotsHtml}</div>
            </div>`;
        }
        // 오늘 — 기존 로직 (가용/사용 중)
        if (r.available) {
          const sub = r.next_busy_at
            ? `${r.next_busy_at}까지 가용`
            : '오늘 남은 시간 모두 가용';
          return `
            <div class="abnb-room abnb-room--ok">
              <div class="abnb-room__name">${escapeHtml(r.name)}</div>
              <span class="abnb-room__chip abnb-room__chip--ok">즉시 사용 가능</span>
              <div class="abnb-room__sub">${escapeHtml(sub)}</div>
            </div>`;
        }
        return `
          <div class="abnb-room abnb-room--busy">
            <div class="abnb-room__name">${escapeHtml(r.name)}</div>
            <span class="abnb-room__chip abnb-room__chip--busy">사용 중</span>
            <div class="abnb-room__sub">${escapeHtml(r.current_end_at || '')}에 종료 예정</div>
          </div>`;
      })
      .join('');

    if (updatedAt) {
      if (isToday && payload && payload.now) {
        updatedAt.textContent = `현재 시각 ${payload.now.time} 기준 · 마지막 갱신 ${formatNowLabel()}`;
      } else {
        updatedAt.textContent = `${formatHumanDate(viewDate)} 예약 현황 · 마지막 갱신 ${formatNowLabel()}`;
      }
    }
    if (footNote) {
      footNote.textContent = isToday ? '10초마다 자동 갱신' : '미래/과거 날짜 — 자동 갱신 중지';
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
      const url = `/api/public/available-spaces?date=${encodeURIComponent(viewDate)}&_=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      const json = await res.json();
      renderRooms((json && json.rooms) || [], json);
    } catch (err) {
      if (updatedAt) updatedAt.textContent = '실시간 정보를 불러오지 못했습니다. 잠시 후 다시 시도합니다.';
    } finally {
      if (liveClock) liveClock.classList.remove('is-fetching');
    }
  }

  // 폴링 — 오늘일 때만
  function startPolling() {
    stopPolling();
    if (isViewToday()) {
      pollTimer = setInterval(fetchOnce, POLL_MS);
    }
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // 날짜 변경 → 라벨/캘린더 동기화 + 즉시 fetch + 폴링 재설정
  function setViewDate(newDate) {
    viewDate = newDate;
    if (dateInput) dateInput.value = newDate;
    if (dateLabel) dateLabel.textContent = formatHumanDate(newDate);
    if (todayBtn) todayBtn.style.display = isViewToday() ? 'none' : '';
    fetchOnce();
    startPolling();
  }

  // ───── 이벤트 바인딩 ─────
  if (prevBtn) prevBtn.addEventListener('click', () => setViewDate(addDays(viewDate, -1)));
  if (nextBtn) nextBtn.addEventListener('click', () => setViewDate(addDays(viewDate, 1)));
  if (todayBtn) todayBtn.addEventListener('click', () => setViewDate(todayStr()));
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v) setViewDate(v);
    });
  }
  // 날짜 라벨 클릭 시 캘린더 picker 열기 (대부분 브라우저에서 showPicker 지원)
  if (dateLabel && dateInput) {
    dateLabel.addEventListener('click', () => {
      try {
        if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
        else dateInput.focus();
      } catch (_) { dateInput.focus(); }
    });
  }

  // 초기화
  if (dateInput) dateInput.value = viewDate;
  if (dateLabel) dateLabel.textContent = formatHumanDate(viewDate);
  if (todayBtn) todayBtn.style.display = 'none'; // 초기엔 오늘이라 숨김
  fetchOnce();
  startPolling();

  // 탭 가시성/포커스 — 오늘일 때만 즉시 fetch
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isViewToday()) fetchOnce();
  });
  window.addEventListener('focus', () => { if (isViewToday()) fetchOnce(); });
})();
