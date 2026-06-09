/* =====================================================
   메이트리그라운드 SPA - app.js
   Apple-inspired Reservation Platform
   ===================================================== */

// ============== STATE ==============
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const State = {
  user: null,
  spaces: [],
  reservations: [],
  date: todayISO(),
  page: (document.getElementById('app-root')?.dataset.page) || 'home',
};

// ============== UTILITIES ==============
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const el = (tag, attrs, ...children) => {
  const node = document.createElement(tag);
  if (attrs && typeof attrs === 'object') {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else if (k in node && typeof v !== 'string' && typeof v !== 'number') {
        try { node[k] = v; } catch (e) { node.setAttribute(k, String(v)); }
      } else {
        node.setAttribute(k, v === true ? '' : v);
      }
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    node.append(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
};

const fmtDate = (d, format = 'YYYY-MM-DD') => dayjs(d).format(format);
const fmtTime = (t) => t;
const fmtMonth = (d) => dayjs(d).locale('ko').format('M월 D일 (ddd)');

const api = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401) {
    window.location.href = '/login';
    return null;
  }
  return { ok: res.ok, status: res.status, data };
};

const toast = (message, type = '') => {
  let container = $('.toast-container');
  if (!container) {
    container = el('div', { class: 'toast-container' });
    document.body.append(container);
  }
  const t = el('div', { class: `toast ${type ? 'is-' + type : ''}` },
    el('i', { class: type === 'error' ? 'fa-solid fa-circle-exclamation' : type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-info' }),
    message
  );
  container.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; }, 2400);
  setTimeout(() => t.remove(), 2700);
};

const initials = (name) => (name || '?').slice(0, 1);

// ============== SHELL / NAV ==============
function renderShell(content) {
  dayjs.locale('ko');
  const isAdmin = State.user?.role === 'admin';
  const tenantName = State.user?.tenant_id === 'WYLIE' ? '와일리' : '러쉬코리아';

  document.body.innerHTML = '';
  const shell = el('div', { class: 'app-shell' },
    // Global Nav
    el('header', { class: 'global-nav' },
      el('div', { class: 'global-nav-inner' },
        el('a', { href: '/home', class: 'nav-brand' },
          el('span', { class: 'brand-bars' },
            el('span'), el('span'), el('span')
          ),
          el('span', null, '메이트리그라운드')
        ),
        el('nav', { class: 'nav-links' },
          navLink('home', '홈', 'fa-house', '/home'),
          navLink('spaces', '공간', 'fa-calendar-day', '/spaces'),
          navLink('insights', '인사이트', 'fa-chart-column', '/insights'),
          isAdmin && navLink('admin-members', '관리', 'fa-gear', '/admin/members'),
        ),
        el('div', { class: 'nav-actions' },
          el('div', {
            class: 'nav-avatar',
            style: `background:${State.user?.avatar_color || '#7a7a7a'};`,
            title: `${State.user?.name} · ${tenantName}`,
            onclick: handleLogout,
          }, initials(State.user?.name))
        )
      )
    ),
    content
  );
  document.body.append(shell);
}

function navLink(pageKey, label, icon, href) {
  const isActive = State.page === pageKey || (pageKey === 'admin-members' && State.page.startsWith('admin-'));
  return el('a', {
    href,
    class: `nav-link ${isActive ? 'is-active' : ''}`,
  }, el('i', { class: `fa-solid ${icon}` }), label);
}

async function handleLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ============== HOME PAGE ==============
async function renderHome() {
  const res = await api('/api/reservations/upcoming');
  const reservations = res?.data?.reservations || [];

  const grouped = {};
  for (const r of reservations) {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  }

  const goToSpace = (date, time) => {
    // V4: 대시보드 일자 클릭 시 해당 날짜의 타임라인으로 라우팅 + 시간 포커스
    sessionStorage.setItem('spaceFocusTime', time || '');
    State.date = date;
    window.location.href = '/spaces';
  };

  const upcomingItems = Object.entries(grouped).slice(0, 8).map(([date, list]) => {
    const d = dayjs(date);
    return el('div', { class: 'upcoming-day' },
      el('div', {
        class: 'upcoming-day-label is-clickable',
        title: '클릭하면 해당 날짜의 공간 타임라인으로 이동합니다',
        onclick: () => goToSpace(date, list[0]?.start_time)
      },
        el('div', { class: 'day-num' }, d.format('D')),
        el('div', { class: 'day-text' }, d.locale('ko').format('M월, dddd'))
      ),
      el('div', { class: 'upcoming-items' },
        ...list.map(r =>
          el('div', {
            class: 'upcoming-row is-clickable',
            onclick: () => goToSpace(r.date, r.start_time)
          },
            el('div', { class: 'time' },
              el('i', { class: 'fa-regular fa-clock', style: 'margin-right:6px;font-size:11px;color:#7a7a7a;' }),
              `${r.start_time} - ${r.end_time}`
            ),
            el('div', { class: 'title' }, r.title || '새로운 일정'),
            el('div', { class: 'space-pill' },
              el('span', { class: 'space-dot', style: `background:${r.space_color || '#7a7a7a'};` }),
              r.space_name
            ),
            el('div', { class: 'avatar', style: `background:${r.user_avatar_color || '#7a7a7a'};` }, initials(r.user_name))
          )
        )
      )
    );
  });

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'home-hero' },
      el('div', { class: 'home-hero-icon' }, '📅'),
      el('div', { class: 'home-hero-text' },
        el('h2', null, `${State.user.name}님,`),
        el('p', null, '오늘도 좋은 하루 되세요!')
      )
    ),
    el('div', { class: 'upcoming-section' },
      el('h3', null, '앞으로의 일정'),
      reservations.length === 0
        ? el('div', { class: 'upcoming-empty' }, '예정된 일정이 없습니다. 공간 탭에서 예약을 만들어 보세요.')
        : el('div', null, ...upcomingItems)
    )
  );

  renderShell(main);
}

// ============== SPACES (TIMELINE) PAGE ==============
let dragState = null;
let resizeState = null;
let pollingInterval = null;
// State.view: 'day' | 'month', State.mineOnly: boolean
if (!State.view) State.view = 'day';
if (typeof State.mineOnly !== 'boolean') State.mineOnly = false;

async function loadTimeline() {
  const qsBase = State.mineOnly ? '&mine=1' : '';
  if (State.view === 'month') {
    const m = dayjs(State.date);
    const start = m.startOf('month').format('YYYY-MM-DD');
    const end = m.endOf('month').format('YYYY-MM-DD');
    const [spacesRes, resvRes] = await Promise.all([
      api('/api/spaces'),
      api(`/api/reservations?start=${start}&end=${end}${qsBase}`)
    ]);
    State.spaces = spacesRes?.data?.spaces || [];
    State.reservations = resvRes?.data?.reservations || [];
  } else {
    const [spacesRes, resvRes] = await Promise.all([
      api('/api/spaces'),
      api(`/api/reservations?date=${State.date}${qsBase}`)
    ]);
    State.spaces = spacesRes?.data?.spaces || [];
    State.reservations = resvRes?.data?.reservations || [];
  }
}

async function renderSpaces() {
  await loadTimeline();
  startPolling();

  const dateLabel = State.view === 'month'
    ? dayjs(State.date).locale('ko').format('YYYY년 M월')
    : dayjs(State.date).locale('ko').format('YYYY년 M월 D일 (ddd)');

  const toolbar = el('div', { class: 'timeline-toolbar' },
    el('div', { class: 'timeline-date-nav' },
      el('button', { class: 'btn-icon', onclick: () => changeDate(-1) }, el('i', { class: 'fa-solid fa-chevron-left' })),
      el('div', { class: 'date-display' }, dateLabel),
      el('button', { class: 'btn-icon', onclick: () => changeDate(1) }, el('i', { class: 'fa-solid fa-chevron-right' })),
      el('button', { class: 'btn-ghost', onclick: () => { State.date = dayjs().format('YYYY-MM-DD'); renderSpaces(); } }, '오늘'),
      el('input', {
        type: 'date',
        value: State.date,
        class: 'date-jump-input',
        onchange: (e) => { if (e.target.value) { State.date = e.target.value; renderSpaces(); } }
      })
    ),
    el('div', { class: 'timeline-view-switch' },
      el('button', {
        class: 'view-tab ' + (State.view === 'day' ? 'is-active' : ''),
        onclick: () => { State.view = 'day'; renderSpaces(); }
      }, el('i', { class: 'fa-regular fa-calendar' }), '일간'),
      el('button', {
        class: 'view-tab ' + (State.view === 'month' ? 'is-active' : ''),
        onclick: () => { State.view = 'month'; renderSpaces(); }
      }, el('i', { class: 'fa-regular fa-calendar-days' }), '월간'),
      el('button', {
        class: 'view-tab mine-tab ' + (State.mineOnly ? 'is-active' : ''),
        onclick: () => { State.mineOnly = !State.mineOnly; renderSpaces(); },
        title: '본인이 개설자 또는 참석자인 일정만 보기'
      }, el('i', { class: 'fa-solid fa-user' }), '내 일정')
    ),
    el('div', { class: 'timeline-legend' },
      el('span', { class: 'legend-chip' }, el('span', { class: 'legend-square', style: 'background:#0066cc;' }), '와일리'),
      el('span', { class: 'legend-chip' }, el('span', { class: 'legend-square', style: 'background:#1d1d1f;' }), '러쉬코리아'),
    )
  );

  const main = el('main', { class: 'page-wrap' },
    toolbar,
    State.view === 'month'
      ? el('div', { class: 'month-view-container' }, buildMonthView())
      : el('div', { class: 'timeline-container' },
          el('div', { class: 'timeline-scroll' },
            buildTimelineGrid()
          )
        )
  );

  renderShell(main);
  if (State.view === 'day') {
    attachDragHandlers();
    attachResizeHandlers();
    drawNowLine();
    focusOnRequestedTime();
  }
}

function focusOnRequestedTime() {
  // 홈 대시보드에서 일자 클릭 시 sessionStorage에 시간 저장 → 해당 위치로 스크롤
  const t = sessionStorage.getItem('spaceFocusTime');
  if (!t) return;
  sessionStorage.removeItem('spaceFocusTime');
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return;
  const scroller = $('.timeline-scroll');
  if (!scroller) return;
  const topPx = (h * 60 + (m || 0)) * (40 / 60);
  // 헤더 높이를 빼고 살짝 여유
  scroller.scrollTo({ top: Math.max(0, topPx - 80), behavior: 'smooth' });
}

function changeDate(delta) {
  if (State.view === 'month') {
    State.date = dayjs(State.date).add(delta, 'month').format('YYYY-MM-DD');
  } else {
    State.date = dayjs(State.date).add(delta, 'day').format('YYYY-MM-DD');
  }
  renderSpaces();
}

function buildMonthView() {
  const m = dayjs(State.date);
  const monthStart = m.startOf('month');
  const startWeekday = monthStart.day(); // 0=일
  const daysInMonth = m.daysInMonth();
  const todayStr = dayjs().format('YYYY-MM-DD');
  const monthStr = m.format('YYYY-MM');

  // 헤더(요일)
  const dowLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const header = el('div', { class: 'month-grid-header' },
    ...dowLabels.map((d, i) =>
      el('div', { class: 'month-dow ' + (i === 0 ? 'sun' : i === 6 ? 'sat' : '') }, d)
    )
  );

  const body = el('div', { class: 'month-grid-body' });
  // 앞쪽 빈 칸
  for (let i = 0; i < startWeekday; i++) {
    body.append(el('div', { class: 'month-cell is-blank' }));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${monthStr}-${String(day).padStart(2, '0')}`;
    const dayEvents = State.reservations.filter(r => r.date === dStr);
    const isToday = dStr === todayStr;
    const cell = el('div', {
      class: 'month-cell ' + (isToday ? 'is-today' : ''),
      onclick: () => { State.view = 'day'; State.date = dStr; renderSpaces(); }
    },
      el('div', { class: 'month-cell-day' }, String(day)),
      el('div', { class: 'month-cell-events' },
        ...dayEvents.slice(0, 4).map(r =>
          el('div', {
            class: 'month-event',
            style: `background:${r.tenant_id === 'WYLIE' ? '#0066cc' : '#1d1d1f'};`,
            title: `${r.start_time}-${r.end_time} · ${r.title} · ${r.space_name}`
          },
            el('span', { class: 'me-time' }, r.start_time),
            ' ',
            r.title || '새로운 일정'
          )
        ),
        dayEvents.length > 4 && el('div', { class: 'month-more' }, `+${dayEvents.length - 4}건 더 보기`)
      )
    );
    body.append(cell);
  }
  return el('div', { class: 'month-grid' }, header, body);
}

function buildTimelineGrid() {
  const grid = el('div', { class: 'timeline-grid', id: 'timeline-grid' });

  // Top-left empty cell
  grid.append(el('div', { class: 'timeline-header-cell', style: 'background:#fff;' }));

  // Headers - spaces
  for (const s of State.spaces) {
    grid.append(el('div', { class: 'timeline-header-cell' },
      el('div', { class: 'space-name' },
        el('span', { class: 'space-dot', style: `background:${s.color}; width:8px; height:8px;` }),
        s.name
      ),
      el('div', { class: 'space-meta' }, `${s.capacity}명 · ${s.type === 'meeting_room' ? '미팅룸' : '공용공간'}`)
    ));
  }

  // Time column
  const timeCol = el('div', { class: 'timeline-time-col' });
  for (let h = 0; h < 24; h++) {
    timeCol.append(el('div', { class: 'timeline-time-cell' }, `${String(h).padStart(2, '0')}:00`));
  }
  grid.append(timeCol);

  // Space columns (24 hours x 30min slots = 48 cells, but we use 24 hour-cells for simplicity)
  for (const s of State.spaces) {
    const col = el('div', { class: 'timeline-space-col', 'data-space-id': s.id });
    for (let h = 0; h < 24; h++) {
      const cell = el('div', { class: 'timeline-cell is-hour-mark', 'data-hour': h, 'data-space-id': s.id });
      col.append(cell);
    }
    // Position events
    const events = State.reservations.filter(r => r.space_id === s.id);
    for (const r of events) {
      col.append(buildEventEl(r));
    }
    grid.append(col);
  }

  return grid;
}

function buildEventEl(r) {
  const [sh, sm] = r.start_time.split(':').map(Number);
  const [eh, em] = r.end_time.split(':').map(Number);
  const top = (sh * 60 + sm) * (40 / 60); // 40px per hour
  const height = Math.max(20, ((eh * 60 + em) - (sh * 60 + sm)) * (40 / 60));
  const bg = r.tenant_id === 'WYLIE' ? '#0066cc' : '#1d1d1f';
  const isOwner = r.user_id === State.user.id || State.user.role === 'admin';

  // 내 일정 필터에서 강조
  const highlight = State.mineOnly && r.user_id === State.user.id ? ' is-mine' : '';

  const node = el('div', {
    class: 'timeline-event' + highlight,
    style: `top:${top}px;height:${height}px;background:${bg};`,
    'data-id': r.id,
    onclick: (e) => { e.stopPropagation(); /* 단일 클릭은 무시(드래그/리사이즈와 충돌) */ },
    ondblclick: (e) => { e.stopPropagation(); openReservationDetail(r); },
  },
    el('div', { class: 'ev-title' }, r.title || '새로운 일정'),
    height > 32 && el('div', { class: 'ev-time' }, `${r.start_time} - ${r.end_time}`),
    el('div', {
      class: 'ev-owner-avatar',
      style: `background:${r.user_avatar_color || '#7a7a7a'};`,
      title: r.user_name
    }, initials(r.user_name)),
    // V4: 끝부분 리사이즈 핸들 (개설자 또는 관리자만)
    isOwner && el('div', {
      class: 'ev-resize-handle',
      'data-id': r.id,
      title: '드래그하여 종료 시간 조정'
    })
  );
  return node;
}

function attachDragHandlers() {
  const grid = $('#timeline-grid');
  if (!grid) return;

  grid.addEventListener('mousedown', (e) => {
    // 리사이즈 핸들/예약 블록 자체를 클릭한 경우는 새 예약 드래그 비활성화
    if (e.target.closest('.ev-resize-handle')) return;
    if (e.target.closest('.timeline-event')) return;
    const cell = e.target.closest('.timeline-cell');
    if (!cell) return;
    e.preventDefault();
    const spaceId = Number(cell.dataset.spaceId);
    const col = cell.parentElement;
    const rect = col.getBoundingClientRect();
    const startY = e.clientY - rect.top;
    dragState = {
      spaceId,
      col,
      startY,
      currentY: startY,
      preview: el('div', { class: 'timeline-drag-preview' }),
    };
    col.append(dragState.preview);
    updateDragPreview();
  });

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragUp);
}

function onDragMove(e) {
  if (!dragState) return;
  const rect = dragState.col.getBoundingClientRect();
  dragState.currentY = Math.max(0, Math.min(24 * 40, e.clientY - rect.top));
  updateDragPreview();
}

function onDragUp(e) {
  if (!dragState) return;
  const { spaceId, startY, currentY, preview } = dragState;
  preview.remove();
  const top = Math.min(startY, currentY);
  const bottom = Math.max(startY, currentY);
  // snap to 30-min slots
  const startMin = Math.round((top / 40) * 60 / 30) * 30;
  let endMin = Math.round((bottom / 40) * 60 / 30) * 30;
  if (endMin <= startMin) endMin = startMin + 30;
  if (endMin > 24 * 60) endMin = 24 * 60;
  dragState = null;
  if (endMin - startMin < 30) return;
  openReservationModal({
    space_id: spaceId,
    start_time: minutesToTime(startMin),
    end_time: minutesToTime(endMin),
  });
}

/** V4: 예약 블록 종료 시간 리사이즈 (끝부분 핸들 드래그) */
function attachResizeHandlers() {
  const grid = $('#timeline-grid');
  if (!grid) return;

  grid.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.ev-resize-handle');
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    const id = Number(handle.dataset.id);
    const r = State.reservations.find(x => x.id === id);
    if (!r) return;
    const eventEl = handle.parentElement;
    resizeState = {
      reservation: r,
      eventEl,
      startClientY: e.clientY,
      originalHeight: eventEl.offsetHeight,
      originalTop: eventEl.offsetTop,
    };
  });

  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeUp);
}

function onResizeMove(e) {
  if (!resizeState) return;
  const dy = e.clientY - resizeState.startClientY;
  let newHeight = Math.max(20, resizeState.originalHeight + dy);
  // 24시 경계 제한
  const maxHeight = 24 * 40 - resizeState.originalTop;
  newHeight = Math.min(newHeight, maxHeight);
  resizeState.eventEl.style.height = newHeight + 'px';
  // 시간 표시 갱신
  const startMin = resizeState.originalTop / 40 * 60;
  const endMin = Math.round((resizeState.originalTop + newHeight) / 40 * 60 / 30) * 30;
  const timeLabel = resizeState.eventEl.querySelector('.ev-time');
  const endStr = minutesToTime(endMin);
  if (timeLabel) timeLabel.textContent = `${resizeState.reservation.start_time} - ${endStr}`;
}

async function onResizeUp(e) {
  if (!resizeState) return;
  const rs = resizeState;
  resizeState = null;
  const newHeight = parseFloat(rs.eventEl.style.height);
  const startMin = rs.originalTop / 40 * 60;
  let endMin = Math.round((rs.originalTop + newHeight) / 40 * 60 / 30) * 30;
  if (endMin <= startMin) endMin = startMin + 30;
  if (endMin > 24 * 60) endMin = 24 * 60;
  const newEnd = minutesToTime(endMin);
  if (newEnd === rs.reservation.end_time) return; // 변경 없음

  const res = await api(`/api/reservations/${rs.reservation.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ end_time: newEnd })
  });
  if (!res.ok) {
    toast(res.data?.error || '시간 조정에 실패했습니다.', 'error');
  } else {
    toast(`종료 시간을 ${newEnd}로 변경했습니다.`, 'success');
  }
  await loadTimeline();
  // 빠른 리렌더 — 이벤트만 갱신
  refreshTimelineEvents();
}

function refreshTimelineEvents() {
  const grid = $('#timeline-grid');
  if (!grid) return;
  $$('.timeline-event', grid).forEach(e => e.remove());
  for (const s of State.spaces) {
    const col = $(`.timeline-space-col[data-space-id="${s.id}"]`, grid);
    if (!col) continue;
    State.reservations.filter(r => r.space_id === s.id).forEach(r => col.append(buildEventEl(r)));
  }
}

function updateDragPreview() {
  if (!dragState) return;
  const { startY, currentY, preview } = dragState;
  const top = Math.min(startY, currentY);
  const bottom = Math.max(startY, currentY);
  preview.style.top = top + 'px';
  preview.style.height = (bottom - top) + 'px';
  const startMin = Math.round((top / 40) * 60 / 30) * 30;
  let endMin = Math.round((bottom / 40) * 60 / 30) * 30;
  if (endMin <= startMin) endMin = startMin + 30;
  preview.textContent = `${minutesToTime(startMin)} - ${minutesToTime(endMin)}`;
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawNowLine() {
  if (State.date !== dayjs().format('YYYY-MM-DD')) return;
  const grid = $('#timeline-grid');
  if (!grid) return;
  const now = dayjs();
  const top = (now.hour() * 60 + now.minute()) * (40 / 60);
  const line = el('div', { class: 'timeline-now-line', style: `top:${56 + top}px;` });
  grid.append(line);
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    if (State.page !== 'spaces') return;
    const resvRes = await api(`/api/reservations?date=${State.date}`);
    const newReservations = resvRes?.data?.reservations || [];
    // 변경이 있을 때만 리렌더 (간단 비교)
    if (JSON.stringify(newReservations.map(r => r.id + ':' + r.updated_at)) !==
        JSON.stringify(State.reservations.map(r => r.id + ':' + r.updated_at))) {
      State.reservations = newReservations;
      // 이벤트 영역만 갱신
      const grid = $('#timeline-grid');
      if (grid) {
        $$('.timeline-event', grid).forEach(e => e.remove());
        for (const s of State.spaces) {
          const col = $(`.timeline-space-col[data-space-id="${s.id}"]`, grid);
          if (!col) continue;
          State.reservations.filter(r => r.space_id === s.id).forEach(r => col.append(buildEventEl(r)));
        }
      }
    }
  }, 3000);
}

// ============== RESERVATION MODAL ==============
let modalState = null;

function openReservationModal(initial = {}) {
  modalState = {
    title: '',
    space_id: initial.space_id || State.spaces[0]?.id,
    date: initial.date || State.date,
    start_time: initial.start_time || '09:00',
    end_time: initial.end_time || '10:00',
    recurring: null, // {frequency, end_type, end_date, end_count}
  };
  renderModal();
}

function renderModal() {
  closeModal();
  const space = State.spaces.find(s => s.id === modalState.space_id);
  const backdrop = el('div', { class: 'modal-backdrop', id: 'reservation-modal', onclick: (e) => { if (e.target === backdrop) closeModal(); } });

  const repeatBtnLabel = modalState.recurring
    ? `${modalState.recurring.frequency === 'daily' ? '매일' : modalState.recurring.frequency === 'weekly' ? '매주' : '매월'} 반복`
    : '반복 없음';

  const modal = el('div', { class: 'modal' },
    el('div', { class: 'modal-header' },
      el('button', {
        class: 'repeat-chip ' + (modalState.recurring ? 'is-active' : ''),
        onclick: toggleRepeatPanel,
      },
        el('i', { class: 'fa-solid fa-arrows-rotate' }),
        repeatBtnLabel
      ),
      el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
    ),
    el('div', { class: 'modal-body' },
      el('input', {
        class: 'title-input-large',
        placeholder: '일정명을 입력하세요',
        value: modalState.title,
        oninput: (e) => modalState.title = e.target.value,
      }),

      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '날짜 / 시간'),
        el('div', { class: 'input-row' },
          el('input', {
            type: 'date', value: modalState.date,
            class: 'field-input',
            style: 'padding:10px 12px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;',
            onchange: (e) => modalState.date = e.target.value,
          }),
          buildTimeSelect('start_time', modalState.start_time),
          buildTimeSelect('end_time', modalState.end_time),
        ),
      ),

      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '장소'),
        el('select', {
          class: 'field-input',
          style: 'width:100%;padding:12px 14px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;background:#fff;',
          onchange: (e) => modalState.space_id = Number(e.target.value),
        },
          ...State.spaces.map(s =>
            el('option', { value: s.id, selected: s.id === modalState.space_id ? 'selected' : null }, s.name)
          )
        )
      ),

      modalState.recurring && el('div', { class: 'modal-section repeat-panel' },
        el('div', { class: 'modal-section-title' }, '반복주기'),
        el('div', { class: 'repeat-freq-tabs' },
          ...['daily', 'weekly', 'monthly'].map(f =>
            el('button', {
              class: 'repeat-freq-tab ' + (modalState.recurring.frequency === f ? 'is-active' : ''),
              onclick: () => { modalState.recurring.frequency = f; renderModal(); },
            }, f === 'daily' ? '매일' : f === 'weekly' ? '매주' : '매월')
          )
        ),
        el('div', { class: 'modal-section-title', style: 'margin-top:12px;' }, '종료'),
        el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
          el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:14px;' },
            el('input', {
              type: 'radio', name: 'endType',
              checked: modalState.recurring.end_type === 'date' ? 'checked' : null,
              onchange: () => { modalState.recurring.end_type = 'date'; renderModal(); },
            }),
            '날짜',
            el('input', {
              type: 'date',
              value: modalState.recurring.end_date || dayjs().add(1, 'month').format('YYYY-MM-DD'),
              disabled: modalState.recurring.end_type !== 'date' ? 'disabled' : null,
              style: 'padding:6px 10px;border-radius:8px;border:1px solid #e0e0e0;font-size:13px;',
              onchange: (e) => modalState.recurring.end_date = e.target.value,
            }),
            '까지 반복'
          ),
          el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:14px;' },
            el('input', {
              type: 'radio', name: 'endType',
              checked: modalState.recurring.end_type === 'count' ? 'checked' : null,
              onchange: () => { modalState.recurring.end_type = 'count'; renderModal(); },
            }),
            '횟수',
            el('input', {
              type: 'number', min: 1, max: 100,
              value: modalState.recurring.end_count || 10,
              disabled: modalState.recurring.end_type !== 'count' ? 'disabled' : null,
              style: 'padding:6px 10px;border-radius:8px;border:1px solid #e0e0e0;font-size:13px;width:80px;',
              onchange: (e) => modalState.recurring.end_count = Number(e.target.value),
            }),
            '회 반복'
          ),
        ),
      ),
    ),
    el('div', { class: 'modal-footer' },
      el('button', { class: 'btn-secondary', onclick: closeModal }, '취소'),
      el('button', { class: 'btn-primary', onclick: submitReservation }, '예약하기'),
    )
  );

  backdrop.append(modal);
  document.body.append(backdrop);
}

function buildTimeSelect(name, value) {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push(el('option', { value: v, selected: v === value ? 'selected' : null }, v));
    }
  }
  return el('select', {
    class: 'field-input',
    style: 'padding:10px 12px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;background:#fff;',
    onchange: (e) => modalState[name] = e.target.value,
  }, ...options);
}

function toggleRepeatPanel() {
  if (modalState.recurring) {
    modalState.recurring = null;
  } else {
    modalState.recurring = {
      frequency: 'weekly',
      end_type: 'date',
      end_date: dayjs(modalState.date).add(1, 'month').format('YYYY-MM-DD'),
      end_count: 10,
    };
  }
  renderModal();
}

function closeModal() {
  const m = $('#reservation-modal');
  if (m) m.remove();
}

async function submitReservation(force = false) {
  if (!modalState.title) modalState.title = '새로운 일정';
  if (modalState.start_time >= modalState.end_time) {
    toast('시작 시간이 종료 시간보다 빠르거나 같습니다.', 'error');
    return;
  }
  const body = {
    space_id: modalState.space_id,
    title: modalState.title,
    date: modalState.date,
    start_time: modalState.start_time,
    end_time: modalState.end_time,
    recurring: modalState.recurring,
    force,
  };
  const res = await api('/api/reservations', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    if (res.data?.type === 'RECURRING_CONFLICT') {
      const conflicts = [...(res.data.conflicts || []), ...(res.data.limit_exceeded || [])];
      if (confirm(`다음 ${conflicts.length}개 일자에 충돌이 있습니다:\n\n${conflicts.slice(0, 8).join(', ')}${conflicts.length > 8 ? ' ...' : ''}\n\n충돌 일자를 제외하고 예약하시겠습니까?`)) {
        return submitReservation(true);
      }
      return;
    }
    toast(res.data?.error || '예약에 실패했습니다.', 'error');
    return;
  }
  toast(`예약이 생성되었습니다. (${res.data.created}건)`, 'success');
  closeModal();
  loadTimeline().then(() => {
    const grid = $('#timeline-grid');
    if (grid) {
      $$('.timeline-event', grid).forEach(e => e.remove());
      for (const s of State.spaces) {
        const col = $(`.timeline-space-col[data-space-id="${s.id}"]`, grid);
        if (!col) continue;
        State.reservations.filter(r => r.space_id === s.id).forEach(r => col.append(buildEventEl(r)));
      }
    }
  });
}

function openReservationDetail(r) {
  const canEdit = State.user.role === 'admin' || State.user.id === r.user_id;
  // 편집용 임시 state
  const edit = {
    title: r.title || '',
    start_time: r.start_time,
    end_time: r.end_time,
    date: r.date,
  };

  const buildTimeSelectInline = (key, value) => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        options.push(el('option', { value: v, selected: v === value ? 'selected' : null }, v));
      }
    }
    return el('select', {
      class: 'field-input',
      style: 'padding:10px 12px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;background:#fff;',
      onchange: (e) => { edit[key] = e.target.value; },
      disabled: !canEdit ? 'disabled' : null,
    }, ...options);
  };

  const backdrop = el('div', { class: 'modal-backdrop', id: 'reservation-modal', onclick: (e) => { if (e.target === backdrop) closeModal(); } });
  const modal = el('div', { class: 'modal' },
    el('div', { class: 'modal-header' },
      el('div', { class: 'modal-header-title' }, '예약 상세'),
      el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
    ),
    el('div', { class: 'modal-body' },
      el('input', {
        class: 'title-input-large',
        value: edit.title,
        placeholder: '일정명',
        oninput: (e) => edit.title = e.target.value,
        disabled: !canEdit ? 'disabled' : null,
      }),
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '날짜 / 시간'),
        el('div', { class: 'input-row' },
          el('input', {
            type: 'date', value: edit.date,
            class: 'field-input',
            style: 'padding:10px 12px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;',
            onchange: (e) => edit.date = e.target.value,
            disabled: !canEdit ? 'disabled' : null,
          }),
          buildTimeSelectInline('start_time', edit.start_time),
          buildTimeSelectInline('end_time', edit.end_time),
        ),
      ),
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '장소'),
        el('div', null,
          el('span', { class: 'space-dot', style: `background:${r.space_color || '#7a7a7a'};display:inline-block;margin-right:8px;` }),
          r.space_name
        )
      ),
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '예약자'),
        el('div', { style: 'display:flex;align-items:center;gap:8px;' },
          el('div', { class: 'avatar', style: `background:${r.user_avatar_color || '#7a7a7a'};width:28px;height:28px;font-size:11px;` }, initials(r.user_name)),
          el('div', null, r.user_name, ' · ', r.tenant_name || ''),
          r.created_by_admin ? el('span', { class: 'tag tag-blue', style: 'margin-left:6px;' }, 'Admin') : null
        )
      ),
    ),
    el('div', { class: 'modal-footer' },
      canEdit ? el('button', { class: 'btn-secondary', style: 'color:#d33;', onclick: () => deleteReservation(r.id) }, '예약 취소') : null,
      canEdit ? el('button', { class: 'btn-primary', onclick: () => saveReservationEdit(r.id, edit) }, '저장') : el('button', { class: 'btn-primary', onclick: closeModal }, '닫기')
    )
  );
  backdrop.append(modal);
  document.body.append(backdrop);
}

async function saveReservationEdit(id, edit) {
  if (edit.start_time >= edit.end_time) {
    toast('시작 시간은 종료 시간보다 빨라야 합니다.', 'error');
    return;
  }
  const res = await api(`/api/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(edit)
  });
  if (!res.ok) {
    toast(res.data?.error || '수정에 실패했습니다.', 'error');
    return;
  }
  toast('예약이 수정되었습니다.', 'success');
  closeModal();
  await loadTimeline();
  renderSpaces();
}

async function deleteReservation(id) {
  if (!confirm('이 예약을 취소하시겠습니까?')) return;
  const res = await api(`/api/reservations/${id}`, { method: 'DELETE' });
  if (!res.ok) { toast(res.data?.error || '취소 실패', 'error'); return; }
  toast('예약이 취소되었습니다.', 'success');
  closeModal();
  await loadTimeline();
  renderSpaces();
}

// ============== INSIGHTS ==============
// ============== INSIGHTS (V4: 3-tab) ==============
const InsightState = {
  tab: 'overview',     // 'overview' | 'history' | 'stats'
  range: '30',         // '7' | '30' | '90' | '180' | '365' | 'custom'
  start: '',
  end: '',
  metric: 'count',     // 'count' | 'time' (통계 탭)
  charts: {},          // Chart 인스턴스 보관
};

function rangeQuery() {
  const p = new URLSearchParams();
  p.set('range', InsightState.range);
  if (InsightState.range === 'custom') {
    if (InsightState.start) p.set('start', InsightState.start);
    if (InsightState.end) p.set('end', InsightState.end);
  }
  return p.toString();
}

function destroyCharts() {
  for (const k of Object.keys(InsightState.charts)) {
    try { InsightState.charts[k]?.destroy(); } catch (e) {}
  }
  InsightState.charts = {};
}

async function renderInsights() {
  destroyCharts();

  const tabs = [
    { key: 'overview', label: '개요', icon: 'fa-chart-pie' },
    { key: 'history',  label: '내역', icon: 'fa-list' },
    { key: 'stats',    label: '통계', icon: 'fa-chart-column' },
  ];

  const presets = [
    { v: '7',   label: '7일' },
    { v: '30',  label: '30일' },
    { v: '90',  label: '90일' },
    { v: '180', label: '180일' },
    { v: '365', label: '1년' },
    { v: 'custom', label: '사용자 지정' },
  ];

  // 사용자 지정 입력 영역
  const customWrap = el('div', { class: 'insight-custom-range', style: InsightState.range === 'custom' ? '' : 'display:none;' },
    el('input', {
      type: 'date',
      class: 'date-jump-input',
      value: InsightState.start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      onchange: (e) => { InsightState.start = e.target.value; renderInsights(); },
    }),
    el('span', { class: 'me-time' }, '~'),
    el('input', {
      type: 'date',
      class: 'date-jump-input',
      value: InsightState.end || dayjs().format('YYYY-MM-DD'),
      onchange: (e) => { InsightState.end = e.target.value; renderInsights(); },
    }),
  );

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '인사이트'),
        el('p', null, '공간 운영 데이터를 한눈에')
      )
    ),

    // 탭 네비
    el('div', { class: 'insight-tabs' },
      ...tabs.map(t =>
        el('button', {
          class: 'insight-tab' + (InsightState.tab === t.key ? ' is-active' : ''),
          onclick: () => { InsightState.tab = t.key; renderInsights(); },
        },
          el('i', { class: `fa-solid ${t.icon}` }),
          el('span', null, t.label)
        )
      )
    ),

    // 기간 필터
    el('div', { class: 'insight-filterbar' },
      el('div', { class: 'insight-range-group' },
        ...presets.map(p =>
          el('button', {
            class: 'range-chip' + (InsightState.range === p.v ? ' is-active' : ''),
            onclick: () => {
              InsightState.range = p.v;
              if (p.v === 'custom') {
                InsightState.start = InsightState.start || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                InsightState.end = InsightState.end || dayjs().format('YYYY-MM-DD');
              }
              renderInsights();
            },
          }, p.label)
        )
      ),
      customWrap
    ),

    // 탭 컨텐츠 컨테이너 (탭별 비동기 렌더)
    el('div', { id: 'insightTabBody', class: 'insight-tab-body' },
      el('div', { class: 'insight-loading' },
        el('i', { class: 'fa-solid fa-spinner fa-spin' }),
        el('span', null, '불러오는 중...')
      )
    )
  );

  renderShell(main);

  // 탭별 비동기 데이터 로드 & 그리기
  const body = document.getElementById('insightTabBody');
  if (!body) return;

  if (InsightState.tab === 'overview') {
    await renderInsightOverview(body);
  } else if (InsightState.tab === 'history') {
    await renderInsightHistory(body);
  } else if (InsightState.tab === 'stats') {
    await renderInsightStats(body);
  }
}

// ───── 개요 탭 ─────
async function renderInsightOverview(body) {
  const res = await api(`/api/insights/overview?${rangeQuery()}`);
  const data = res?.data || {};
  const avgH = Math.floor((data.avg_minutes || 0) / 60);
  const avgM = (data.avg_minutes || 0) % 60;
  const heatmapMax = Math.max(1, ...((data.heatmap || []).flat()));

  body.innerHTML = '';
  body.append(
    el('div', { class: 'insight-stats-grid' },
      el('div', { class: 'stat-card' },
        el('div', { class: 'stat-label' }, '평균 회의 진행 시간'),
        el('div', { class: 'stat-value' }, `${avgH}시간 ${avgM}분`),
        el('div', { class: 'stat-trend' }, '확정 예약 평균')
      ),
      el('div', { class: 'stat-card' },
        el('div', { class: 'stat-label' }, '총 예약 건수'),
        el('div', { class: 'stat-value' }, `${data.total || 0}건`),
        el('div', { class: 'stat-trend' }, `${data.start} ~ ${data.end}`)
      ),
      el('div', { class: 'stat-card' },
        el('div', { class: 'stat-label' }, '가동 공간 수'),
        el('div', { class: 'stat-value' }, `${(data.popular_spaces || []).filter(p => p.count > 0).length}/${(data.popular_spaces || []).length}`),
        el('div', { class: 'stat-trend' }, '예약이 있던 공간 / 전체 공간')
      ),
    ),
    el('div', { class: 'insight-popular' },
      el('h3', null, '인기 공간'),
      (data.popular_spaces || []).length === 0
        ? el('div', { class: 'org-empty' }, '데이터가 없습니다')
        : el('div', { class: 'popular-grid' },
            ...(data.popular_spaces || []).map((p, i) =>
              el('div', { class: 'popular-item' },
                el('div', { class: `popular-rank r-${i + 1}` }, String(i + 1).padStart(2, '0')),
                el('div', { class: 'popular-name' }, p.name),
                el('div', { class: 'popular-count' }, `${p.count}회`)
              )
            )
          )
    ),
    el('div', { class: 'insight-heatmap' },
      el('h3', null, '요일·시간대별 예약 밀집도'),
      buildHeatmap(data.heatmap || [], heatmapMax)
    )
  );
}

// ───── 내역 탭 ─────
async function renderInsightHistory(body) {
  const res = await api(`/api/insights/history?${rangeQuery()}`);
  const rows = res?.data?.history || [];

  body.innerHTML = '';

  const table = el('table', { class: 'admin-table history-table' },
    el('thead', null,
      el('tr', null,
        el('th', null, '날짜'),
        el('th', null, '시간'),
        el('th', null, '공간'),
        el('th', null, '제목'),
        el('th', null, '예약자'),
        el('th', null, '소속'),
        el('th', null, '상태'),
      )
    ),
    el('tbody', null,
      ...(rows.length === 0
        ? [el('tr', null, el('td', { colspan: '7', class: 'org-empty' }, '해당 기간에 예약 내역이 없습니다'))]
        : rows.map(r =>
            el('tr', null,
              el('td', null, r.date),
              el('td', null, `${(r.start_time || '').slice(0, 5)} ~ ${(r.end_time || '').slice(0, 5)}`),
              el('td', null,
                el('span', { class: 'space-chip', style: `background:${r.space_color || '#999'}` }),
                el('span', null, ' ' + (r.space_name || '-'))
              ),
              el('td', null, r.title || '(제목 없음)'),
              el('td', null,
                el('span', {
                  class: 'avatar-mini',
                  style: `background:${r.avatar_color || '#999'}`
                }, (r.user_name || '?').slice(0, 1)),
                el('span', null, ' ' + (r.user_name || '-'))
              ),
              el('td', null, r.tenant_name || '-'),
              el('td', null,
                el('span', {
                  class: 'status-pill ' + (r.status === 'confirmed' ? 'is-confirmed' : 'is-cancelled')
                }, r.status === 'confirmed' ? '확정' : '취소')
              )
            )
          )
      )
    )
  );

  body.append(
    el('div', { class: 'insight-history-head' },
      el('h3', null, `예약 내역 (${rows.length}건)`)
    ),
    el('div', { class: 'admin-card' }, table)
  );
}

// ───── 통계 탭 ─────
async function renderInsightStats(body) {
  body.innerHTML = '';

  // 메트릭 스위치
  const metricSwitch = el('div', { class: 'metric-switch' },
    el('button', {
      class: 'metric-btn' + (InsightState.metric === 'count' ? ' is-active' : ''),
      onclick: () => { InsightState.metric = 'count'; renderInsights(); },
    }, '일정 개수'),
    el('button', {
      class: 'metric-btn' + (InsightState.metric === 'time' ? ' is-active' : ''),
      onclick: () => { InsightState.metric = 'time'; renderInsights(); },
    }, '예약 시간 누적'),
  );

  body.append(
    el('div', { class: 'insight-stats-head' },
      el('h3', null, '항목별 통계'),
      metricSwitch
    )
  );

  const res = await api(`/api/insights/stats?${rangeQuery()}&metric=${InsightState.metric}`);
  const stats = res?.data || {};
  const unitLabel = InsightState.metric === 'time' ? '분' : '건';

  const fmt = (v) => {
    if (InsightState.metric !== 'time') return `${v}${unitLabel}`;
    const h = Math.floor(v / 60); const m = v % 60;
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  };

  // 4개 카드 그리드
  const grid = el('div', { class: 'chart-grid' },
    el('div', { class: 'chart-card' },
      el('h4', null, '노쇼 / 취소 현황'),
      el('div', { class: 'chart-canvas-wrap' },
        el('canvas', { id: 'chartNoshow' })
      )
    ),
    el('div', { class: 'chart-card' },
      el('h4', null, '요일별 예약'),
      el('div', { class: 'chart-canvas-wrap' },
        el('canvas', { id: 'chartWeekday' })
      )
    ),
    el('div', { class: 'chart-card' },
      el('h4', null, '예약 방식'),
      el('div', { class: 'chart-canvas-wrap' },
        el('canvas', { id: 'chartMethod' })
      )
    ),
    el('div', { class: 'chart-card' },
      el('h4', null, '수용인원별 이용'),
      el('div', { class: 'chart-canvas-wrap' },
        el('canvas', { id: 'chartCapacity' })
      )
    ),
  );
  body.append(grid);

  // 공간별 사용 비율 표
  body.append(
    el('div', { class: 'insight-by-space' },
      el('h3', null, '공간별 사용량'),
      (stats.by_space || []).length === 0
        ? el('div', { class: 'org-empty' }, '데이터가 없습니다')
        : el('div', { class: 'space-bar-list' },
            ...(() => {
              const max = Math.max(1, ...(stats.by_space || []).map(s => s.v || 0));
              return (stats.by_space || []).map(s =>
                el('div', { class: 'space-bar-row' },
                  el('div', { class: 'space-bar-label' },
                    el('span', { class: 'space-chip', style: `background:${s.color || '#999'}` }),
                    el('span', null, s.name)
                  ),
                  el('div', { class: 'space-bar-track' },
                    el('div', {
                      class: 'space-bar-fill',
                      style: `width:${(s.v || 0) / max * 100}%; background:${s.color || '#0066cc'}`
                    })
                  ),
                  el('div', { class: 'space-bar-value' }, fmt(s.v || 0))
                )
              );
            })()
          )
    )
  );

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    return;
  }

  // 차트 그리기
  const blue = '#0066cc';
  const ink = '#1d1d1f';
  const ghost = '#f5f5f7';

  // 1) 노쇼 도넛
  InsightState.charts.noshow = new Chart(document.getElementById('chartNoshow'), {
    type: 'doughnut',
    data: {
      labels: ['확정', '취소'],
      datasets: [{
        data: [stats.noshow?.confirmed || 0, stats.noshow?.cancelled || 0],
        backgroundColor: [blue, '#ff3b30'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.parsed)}` } },
      },
    },
  });

  // 2) 요일별 막대
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  InsightState.charts.weekday = new Chart(document.getElementById('chartWeekday'), {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        label: InsightState.metric === 'time' ? '분' : '건수',
        data: stats.weekday || [0,0,0,0,0,0,0],
        backgroundColor: blue,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmt(ctx.parsed.y) } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  // 3) 예약 방식 도넛
  const methodEntries = Object.entries(stats.method || {});
  InsightState.charts.method = new Chart(document.getElementById('chartMethod'), {
    type: 'doughnut',
    data: {
      labels: methodEntries.map(([k]) => k),
      datasets: [{
        data: methodEntries.map(([, v]) => v),
        backgroundColor: [blue, '#34c759', '#ff9500'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.parsed)}` } },
      },
    },
  });

  // 4) 수용인원별 막대
  const caps = stats.capacity || [];
  InsightState.charts.capacity = new Chart(document.getElementById('chartCapacity'), {
    type: 'bar',
    data: {
      labels: caps.map(c => `${c.capacity}인`),
      datasets: [{
        label: InsightState.metric === 'time' ? '분' : '건수',
        data: caps.map(c => c.v || 0),
        backgroundColor: '#34c759',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmt(ctx.parsed.y) } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function buildHeatmap(heatmap, max) {
  const grid = el('div', { class: 'heatmap-grid' });
  // header row
  grid.append(el('div', { class: 'heatmap-header' }));
  for (let h = 0; h < 24; h++) {
    grid.append(el('div', { class: 'heatmap-header' }, String(h).padStart(2, '0')));
  }
  // body rows
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  for (let d = 0; d < 7; d++) {
    grid.append(el('div', { class: 'heatmap-row-label' }, dayLabels[d]));
    for (let h = 0; h < 24; h++) {
      const v = heatmap[d]?.[h] || 0;
      const intensity = v / max;
      const bg = v === 0 ? '#f5f5f7' : `rgba(0, 102, 204, ${0.12 + intensity * 0.78})`;
      const color = intensity > 0.5 ? '#fff' : '#1d1d1f';
      grid.append(el('div', {
        class: 'heatmap-cell',
        style: `background:${bg}; color:${color};`,
        title: `${dayLabels[d]} ${h}시: ${v}건`,
      }, v > 0 ? String(v) : ''));
    }
  }
  return grid;
}

// ============== ADMIN - MEMBERS ==============
async function renderAdminMembers() {
  if (State.user.role !== 'admin') {
    renderShell(el('main', { class: 'page-wrap' }, el('h1', null, '권한이 없습니다.')));
    return;
  }
  const res = await api('/api/members');
  const members = res?.data?.members || [];

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '회사 정보를 입력하고 서비스 기본 설정을 관리하세요.')
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('members'),
      el('div', { class: 'admin-content' },
        el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;' },
          el('div', null,
            el('h2', { style: 'margin:0;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '멤버'),
            el('p', { style: 'margin:4px 0 0;color:#7a7a7a;font-size:14px;' }, '관리자가 직접 직원 계정을 생성하고 정보를 관리합니다.')
          ),
          el('button', { class: 'btn-primary', onclick: openMemberCreateModal },
            el('i', { class: 'fa-solid fa-plus', style: 'margin-right:6px;' }),
            '생성하기'
          )
        ),
        el('div', { class: 'tabs' },
          el('button', { class: 'tab-link is-active' }, `전체 (${members.length})`),
          el('button', { class: 'tab-link' }, `가입 완료 (${members.filter(m => m.status === 'active').length})`)
        ),
        el('div', { class: 'table-search' },
          el('input', { placeholder: '검색', oninput: (e) => filterMemberTable(e.target.value) })
        ),
        buildMemberTable(members)
      )
    )
  );

  renderShell(main);
}

function buildAdminSidebar(active) {
  const links = [
    { key: 'general', label: '일반', icon: 'fa-sliders', href: '/admin/general' },
    { key: 'members', label: '멤버', icon: 'fa-user', href: '/admin/members' },
    { key: 'org', label: '부서/직책', icon: 'fa-sitemap', href: '/admin/org' },
    { key: 'spaces', label: '공간', icon: 'fa-cube', href: '/admin/spaces' },
  ];
  return el('aside', { class: 'admin-side-nav' },
    el('div', { class: 'side-label' }, '메이트리그라운드'),
    ...links.map(l =>
      el('a', {
        href: l.href,
        class: 'admin-side-link ' + (l.key === active ? 'is-active' : ''),
      },
        el('i', { class: `fa-solid ${l.icon}` }),
        l.label
      )
    )
  );
}

function buildMemberTable(members) {
  const tbody = el('tbody', { id: 'member-tbody' });
  for (const m of members) {
    const tr = el('tr', null,
      el('td', null,
        el('div', { class: 'user-cell' },
          el('div', { class: 'avatar', style: `background:${m.avatar_color};` }, initials(m.name)),
          el('div', { class: 'user-info' },
            el('div', { class: 'user-name' }, m.name),
            el('div', { class: 'user-email' }, m.email),
          )
        )
      ),
      el('td', null, m.department || '-'),
      el('td', null, m.position || '-'),
      el('td', null, el('span', { class: 'status-badge s-active' }, '활성')),
      el('td', null, el('span', { class: m.role === 'admin' ? 'status-badge s-admin' : 'status-badge s-member' }, m.role === 'admin' ? 'Admin' : '일반 멤버')),
      el('td', null,
        el('div', { style: 'display:flex;gap:6px;justify-content:flex-end;' },
          el('button', { class: 'btn-icon', title: '수정', onclick: () => openMemberEditModal(m) },
            el('i', { class: 'fa-solid fa-pen', style: 'font-size:12px;color:#0066cc;' })
          ),
          m.id !== State.user.id
            ? el('button', { class: 'btn-icon', title: '삭제', onclick: () => deleteMember(m.id) },
                el('i', { class: 'fa-solid fa-trash', style: 'font-size:12px;color:#d33;' })
              )
            : null
        )
      )
    );
    tbody.append(tr);
  }
  return el('table', { class: 'data-table' },
    el('thead', null,
      el('tr', null,
        el('th', null, '이름'),
        el('th', null, '부서'),
        el('th', null, '직책'),
        el('th', null, '상태'),
        el('th', null, '역할'),
        el('th', { style: 'text-align:right;' }, '액션')
      )
    ),
    tbody
  );
}

function filterMemberTable(q) {
  const ql = q.toLowerCase();
  $$('#member-tbody tr').forEach(tr => {
    const txt = tr.textContent.toLowerCase();
    tr.style.display = txt.includes(ql) ? '' : 'none';
  });
}

async function deleteMember(id) {
  if (!confirm('이 멤버를 삭제하시겠습니까?')) return;
  const res = await api(`/api/members/${id}`, { method: 'DELETE' });
  if (!res.ok) { toast(res.data?.error || '삭제 실패', 'error'); return; }
  toast('멤버가 삭제되었습니다.', 'success');
  renderAdminMembers();
}

/** V4: 부서/직책 마스터 데이터 캐시 */
const OrgCache = { departments: [], positions: [], loaded: false };
async function loadOrgLists() {
  const [d, p] = await Promise.all([api('/api/org/departments'), api('/api/org/positions')]);
  OrgCache.departments = d?.data?.departments || [];
  OrgCache.positions = p?.data?.positions || [];
  OrgCache.loaded = true;
}

const inputStyle = () => 'width:100%;padding:12px 16px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;background:#fff;';

/** V4: 멤버 생성 모달 (휴대폰 필드 제거, 부서/직책 드롭다운 연동) */
async function openMemberCreateModal() {
  await loadOrgLists();
  let mode = 'single';
  const state = {
    name: '', email: '', password: '', department: '', position: '', role: 'member',
    bulkRows: Array.from({ length: 5 }, () => ({ name: '', email: '', department: '', position: '' })),
  };

  const render = () => {
    closeModal();
    const backdrop = el('div', { class: 'modal-backdrop', id: 'reservation-modal', onclick: (e) => { if (e.target === backdrop) closeModal(); } });
    const modal = el('div', { class: 'modal', style: 'max-width:640px;' },
      el('div', { class: 'modal-header' },
        el('div', { style: 'display:flex;gap:0;background:#f0f0f3;border-radius:11px;padding:3px;flex:1;max-width:360px;' },
          el('button', {
            style: `flex:1;padding:8px 16px;border:none;border-radius:8px;font-size:14px;font-weight:600;background:${mode === 'single' ? '#fff' : 'transparent'};color:${mode === 'single' ? '#0066cc' : '#7a7a7a'};cursor:pointer;`,
            onclick: () => { mode = 'single'; render(); }
          }, '개별 생성'),
          el('button', {
            style: `flex:1;padding:8px 16px;border:none;border-radius:8px;font-size:14px;font-weight:600;background:${mode === 'bulk' ? '#fff' : 'transparent'};color:${mode === 'bulk' ? '#0066cc' : '#7a7a7a'};cursor:pointer;`,
            onclick: () => { mode = 'bulk'; render(); }
          }, '일괄 생성')
        ),
        el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
      ),
      el('div', { class: 'modal-body' },
        mode === 'single' ? renderSingle() : renderBulk()
      ),
      el('div', { class: 'modal-footer' },
        el('button', { class: 'btn-secondary', onclick: closeModal }, '취소'),
        el('button', { class: 'btn-primary', onclick: submit }, '생성하기')
      )
    );
    backdrop.append(modal);
    document.body.append(backdrop);
  };

  const deptSelect = (value, onChange) => el('select',
    { style: inputStyle(), onchange: (e) => onChange(e.target.value) },
    el('option', { value: '' }, OrgCache.departments.length ? '부서 선택 (선택)' : '부서 미등록 — [부서/직책 관리]에서 추가하세요'),
    ...OrgCache.departments.map(d =>
      el('option', { value: d.name, selected: d.name === value ? 'selected' : null }, d.name)
    )
  );
  const posSelect = (value, onChange) => el('select',
    { style: inputStyle(), onchange: (e) => onChange(e.target.value) },
    el('option', { value: '' }, OrgCache.positions.length ? '직책 선택 (선택)' : '직책 미등록 — [부서/직책 관리]에서 추가하세요'),
    ...OrgCache.positions.map(p =>
      el('option', { value: p.name, selected: p.name === value ? 'selected' : null }, p.name)
    )
  );

  const renderSingle = () => el('div', null,
    el('div', { class: 'modal-section' },
      el('div', { class: 'modal-section-title' }, '기본 정보'),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
        el('input', { placeholder: '이름 *', value: state.name, oninput: e => state.name = e.target.value, style: inputStyle() }),
        deptSelect(state.department, v => state.department = v),
        posSelect(state.position, v => state.position = v),
      )
    ),
    el('div', { class: 'modal-section' },
      el('div', { class: 'modal-section-title' }, '로그인 정보'),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
        el('input', { placeholder: '이메일 주소 *', value: state.email, oninput: e => state.email = e.target.value, style: inputStyle() }),
        el('input', { type: 'password', placeholder: '패스워드 (미입력 시 user1234)', value: state.password, oninput: e => state.password = e.target.value, style: inputStyle() }),
        el('select', { style: inputStyle(), onchange: e => state.role = e.target.value },
          el('option', { value: 'member', selected: state.role === 'member' ? 'selected' : null }, '일반 멤버'),
          el('option', { value: 'admin', selected: state.role === 'admin' ? 'selected' : null }, '관리자(Admin)')
        )
      ),
    )
  );

  const renderBulk = () => el('div', null,
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' },
      el('div', { style: 'font-size:14px;color:#7a7a7a;' }, `${state.bulkRows.length}명까지 등록 가능 (초기 패스워드: user1234)`),
      el('button', { class: 'btn-ghost', onclick: () => { state.bulkRows.push(...Array.from({ length: 5 }, () => ({ name: '', email: '', department: '', position: '' }))); render(); } }, '+ 5명 더 추가')
    ),
    el('div', { style: 'overflow:auto;max-height:340px;border:1px solid #e0e0e0;border-radius:11px;' },
      el('table', { class: 'data-table', style: 'font-size:13px;' },
        el('thead', null, el('tr', null,
          el('th', null, '이름 *'), el('th', null, '이메일 *'), el('th', null, '부서'), el('th', null, '직책')
        )),
        el('tbody', null,
          ...state.bulkRows.map((row, i) =>
            el('tr', null,
              el('td', null, el('input', { value: row.name, oninput: e => state.bulkRows[i].name = e.target.value, style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;' })),
              el('td', null, el('input', { value: row.email, oninput: e => state.bulkRows[i].email = e.target.value, style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;' })),
              el('td', null, el('select', { style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;', onchange: e => state.bulkRows[i].department = e.target.value },
                el('option', { value: '' }, '—'),
                ...OrgCache.departments.map(d => el('option', { value: d.name, selected: row.department === d.name ? 'selected' : null }, d.name))
              )),
              el('td', null, el('select', { style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;', onchange: e => state.bulkRows[i].position = e.target.value },
                el('option', { value: '' }, '—'),
                ...OrgCache.positions.map(p => el('option', { value: p.name, selected: row.position === p.name ? 'selected' : null }, p.name))
              ))
            )
          )
        )
      )
    )
  );

  const submit = async () => {
    if (mode === 'single') {
      if (!state.name || !state.email) { toast('이름과 이메일은 필수입니다.', 'error'); return; }
      const payload = {
        name: state.name, email: state.email,
        department: state.department || null, position: state.position || null,
        role: state.role,
      };
      if (state.password) payload.password = state.password;
      const res = await api('/api/members', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) { toast(res.data?.error || '생성 실패', 'error'); return; }
      toast('멤버 계정이 생성되었습니다.', 'success');
    } else {
      const members = state.bulkRows.filter(r => r.name && r.email);
      if (members.length === 0) { toast('생성할 멤버를 입력해 주세요.', 'error'); return; }
      const res = await api('/api/members/bulk', { method: 'POST', body: JSON.stringify({ members }) });
      if (!res.ok) { toast('생성 실패', 'error'); return; }
      toast(`${res.data.success}명 생성 완료${res.data.failed.length ? ' · ' + res.data.failed.length + '건 실패' : ''}`, 'success');
    }
    closeModal();
    renderAdminMembers();
  };

  render();
}

/** V4: 멤버 정보 수정 모달 */
async function openMemberEditModal(member) {
  await loadOrgLists();
  const state = {
    name: member.name || '', email: member.email || '',
    department: member.department || '', position: member.position || '',
    role: member.role, password: ''
  };

  const render = () => {
    closeModal();
    const backdrop = el('div', { class: 'modal-backdrop', id: 'reservation-modal', onclick: (e) => { if (e.target === backdrop) closeModal(); } });
    const modal = el('div', { class: 'modal', style: 'max-width:560px;' },
      el('div', { class: 'modal-header' },
        el('div', { class: 'modal-header-title' }, '멤버 정보 수정'),
        el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
      ),
      el('div', { class: 'modal-body' },
        el('div', { class: 'modal-section' },
          el('div', { class: 'modal-section-title' }, '기본 정보'),
          el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
            el('input', { placeholder: '이름', value: state.name, oninput: e => state.name = e.target.value, style: inputStyle() }),
            el('input', { placeholder: '이메일', value: state.email, oninput: e => state.email = e.target.value, style: inputStyle() }),
            el('select', { style: inputStyle(), onchange: e => state.department = e.target.value },
              el('option', { value: '' }, '부서 미지정'),
              ...OrgCache.departments.map(d => el('option', { value: d.name, selected: d.name === state.department ? 'selected' : null }, d.name))
            ),
            el('select', { style: inputStyle(), onchange: e => state.position = e.target.value },
              el('option', { value: '' }, '직책 미지정'),
              ...OrgCache.positions.map(p => el('option', { value: p.name, selected: p.name === state.position ? 'selected' : null }, p.name))
            ),
            el('select', { style: inputStyle(), onchange: e => state.role = e.target.value },
              el('option', { value: 'member', selected: state.role === 'member' ? 'selected' : null }, '일반 멤버'),
              el('option', { value: 'admin', selected: state.role === 'admin' ? 'selected' : null }, '관리자(Admin)')
            ),
            el('input', { type: 'password', placeholder: '새 패스워드 (변경 시에만 입력)', value: state.password, oninput: e => state.password = e.target.value, style: inputStyle() }),
          )
        )
      ),
      el('div', { class: 'modal-footer' },
        el('button', { class: 'btn-secondary', onclick: closeModal }, '취소'),
        el('button', { class: 'btn-primary', onclick: submit }, '저장')
      )
    );
    backdrop.append(modal);
    document.body.append(backdrop);
  };

  const submit = async () => {
    const payload = {
      name: state.name, email: state.email,
      department: state.department || null, position: state.position || null,
      role: state.role,
    };
    if (state.password) payload.password = state.password;
    const res = await api(`/api/members/${member.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (!res.ok) { toast(res.data?.error || '수정 실패', 'error'); return; }
    toast('멤버 정보가 수정되었습니다.', 'success');
    closeModal();
    renderAdminMembers();
  };

  render();
}

// ============== ADMIN - GENERAL ==============
async function renderAdminGeneral() {
  if (State.user.role !== 'admin') {
    renderShell(el('main', { class: 'page-wrap' }, el('h1', null, '권한이 없습니다.')));
    return;
  }
  const [membersRes, spacesRes] = await Promise.all([api('/api/members'), api('/api/spaces')]);
  const memberCount = (membersRes?.data?.members || []).length;
  const spaceCount = (spacesRes?.data?.spaces || []).length;

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '회사 정보를 입력하고 서비스 기본 환경을 설정하세요.')
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('general'),
      el('div', { class: 'admin-content' },
        el('h2', { style: 'margin:0 0 24px;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '일반'),
        el('div', { class: 'summary-cards' },
          el('div', { class: 'summary-card' },
            el('div', { class: 'summary-card-icon' }, el('i', { class: 'fa-solid fa-users' })),
            el('div', { class: 'summary-card-text' },
              el('div', { class: 'label' }, '멤버'),
              el('div', { class: 'value' }, `${memberCount}명`)
            )
          ),
          el('div', { class: 'summary-card' },
            el('div', { class: 'summary-card-icon' }, el('i', { class: 'fa-solid fa-cube' })),
            el('div', { class: 'summary-card-text' },
              el('div', { class: 'label' }, '공간'),
              el('div', { class: 'value' }, `${spaceCount}개`)
            )
          ),
          el('div', { class: 'summary-card' },
            el('div', { class: 'summary-card-icon' }, el('i', { class: 'fa-solid fa-mobile-screen' })),
            el('div', { class: 'summary-card-text' },
              el('div', { class: 'label' }, '디바이스'),
              el('div', { class: 'value' }, '-')
            )
          ),
        ),
        el('div', { style: 'background:#fafafc;padding:24px;border-radius:11px;' },
          el('h3', { style: 'margin:0 0 16px;font-size:17px;font-weight:600;' }, '회사 정보'),
          el('div', { style: 'display:grid;grid-template-columns:120px 1fr;gap:12px 16px;align-items:center;font-size:14px;' },
            el('div', { style: 'color:#7a7a7a;' }, '회사명'),
            el('div', null, '메이트리그라운드'),
            el('div', { style: 'color:#7a7a7a;' }, '회사 주소'),
            el('div', null, '서울 강남구 학동로 336 (논현동) 1F'),
            el('div', { style: 'color:#7a7a7a;' }, '예약 가능 시간'),
            el('div', null, '00:00 → 24:00'),
            el('div', { style: 'color:#7a7a7a;' }, '소속 테넌트'),
            el('div', null,
              State.user.tenant_id === 'WYLIE'
                ? el('span', { class: 'tag tag-blue' }, '와일리 (WYLIE)')
                : el('span', { class: 'tag tag-dark' }, '러쉬코리아 (LUSH)')
            ),
          )
        )
      )
    )
  );

  renderShell(main);
}

// ============== ADMIN - SPACES ==============
async function renderAdminSpaces() {
  if (State.user.role !== 'admin') {
    renderShell(el('main', { class: 'page-wrap' }, el('h1', null, '권한이 없습니다.')));
    return;
  }
  const res = await api('/api/spaces');
  const spaces = res?.data?.spaces || [];

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '공간 자원을 추가·수정·삭제합니다. 변경 사항은 타임라인에 즉시 반영됩니다.')
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('spaces'),
      el('div', { class: 'admin-content' },
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;' },
          el('div', null,
            el('h2', { style: 'margin:0;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '공간'),
            el('p', { style: 'margin:4px 0 0;color:#7a7a7a;font-size:14px;' }, '운영 중인 공간 자원 목록입니다.')
          ),
          el('button', { class: 'btn-primary', onclick: () => openSpaceModal(null) },
            el('i', { class: 'fa-solid fa-plus', style: 'margin-right:6px;' }), '공간 추가')
        ),
        el('table', { class: 'data-table' },
          el('thead', null, el('tr', null,
            el('th', null, '공간명'), el('th', null, '유형'), el('th', null, '수용 인원'),
            el('th', null, '3개 제한 카운트'), el('th', null, '접근 권한'), el('th', null, '색상'), el('th', { style: 'text-align:right;' }, '액션')
          )),
          el('tbody', null,
            ...spaces.map(s =>
              el('tr', null,
                el('td', null, el('div', { class: 'user-cell' },
                  el('div', { style: `width:32px;height:32px;border-radius:8px;background:${s.color};` }),
                  el('div', { class: 'user-info' }, el('div', { class: 'user-name' }, s.name))
                )),
                el('td', null, s.type === 'meeting_room' ? '미팅룸' : '공용공간'),
                el('td', null, `${s.capacity}명`),
                el('td', null, s.count_in_limit === 1 ? el('span', { class: 'status-badge s-active' }, '포함') : el('span', { class: 'status-badge s-member' }, '제외')),
                el('td', null,
                  s.tenant_scope
                    ? el('span', { class: 'status-badge s-active', style: 'background:rgba(0,102,204,0.12);color:#0066cc;' }, s.tenant_scope + ' 전용')
                    : el('span', { class: 'status-badge s-member' }, '모두 공개')
                ),
                el('td', null,
                  el('span', { style: `display:inline-block;width:16px;height:16px;border-radius:4px;background:${s.color};vertical-align:middle;margin-right:6px;` }),
                  s.color
                ),
                el('td', null,
                  el('div', { style: 'display:flex;gap:6px;justify-content:flex-end;' },
                    el('button', { class: 'btn-icon', title: '수정', onclick: () => openSpaceModal(s) },
                      el('i', { class: 'fa-solid fa-pen', style: 'font-size:12px;color:#0066cc;' })
                    ),
                    el('button', { class: 'btn-icon', title: '삭제', onclick: () => deleteSpace(s) },
                      el('i', { class: 'fa-solid fa-trash', style: 'font-size:12px;color:#d33;' })
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );

  renderShell(main);
}

/** V4: 공간 추가/수정 모달 */
function openSpaceModal(space) {
  const isEdit = !!space;
  const state = {
    name: space?.name || '',
    type: space?.type || 'meeting_room',
    capacity: space?.capacity ?? 4,
    color: space?.color || '#0066cc',
    count_in_limit: space?.count_in_limit ?? 1,
    tenant_scope: space?.tenant_scope || '', // V5 REQ-AUTH-01: '' = 모두 공개, 'WYLIE'/'LUSH' = 전용
  };

  const PALETTE = ['#ef4444', '#f59e0b', '#facc15', '#10b981', '#06b6d4', '#0066cc', '#8b5cf6', '#ec4899', '#1d1d1f', '#7a7a7a'];

  const render = () => {
    closeModal();
    const backdrop = el('div', { class: 'modal-backdrop', id: 'reservation-modal', onclick: (e) => { if (e.target === backdrop) closeModal(); } });
    const modal = el('div', { class: 'modal', style: 'max-width:520px;' },
      el('div', { class: 'modal-header' },
        el('div', { class: 'modal-header-title' }, isEdit ? '공간 수정' : '공간 추가'),
        el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
      ),
      el('div', { class: 'modal-body' },
        el('div', { class: 'modal-section' },
          el('div', { class: 'modal-section-title' }, '기본 정보'),
          el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
            el('input', { placeholder: '공간명 (예: Meeting Room A)', value: state.name, oninput: e => state.name = e.target.value, style: inputStyle() }),
            el('select', { style: inputStyle(), onchange: e => { state.type = e.target.value; state.count_in_limit = state.type === 'meeting_room' ? 1 : 0; render(); } },
              el('option', { value: 'meeting_room', selected: state.type === 'meeting_room' ? 'selected' : null }, '미팅룸'),
              el('option', { value: 'common_space', selected: state.type === 'common_space' ? 'selected' : null }, '공용공간')
            ),
            el('input', { type: 'number', min: 0, placeholder: '수용 인원', value: state.capacity, oninput: e => state.capacity = Number(e.target.value), style: inputStyle() })
          )
        ),
        el('div', { class: 'modal-section' },
          el('div', { class: 'modal-section-title' }, '색상'),
          el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;' },
            ...PALETTE.map(c =>
              el('button', {
                onclick: () => { state.color = c; render(); },
                style: `width:32px;height:32px;border-radius:8px;background:${c};border:${state.color === c ? '3px solid #0066cc' : '2px solid transparent'};cursor:pointer;`,
                title: c
              })
            )
          )
        ),
        el('div', { class: 'modal-section' },
          el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;' },
            el('input', { type: 'checkbox', checked: state.count_in_limit === 1 ? 'checked' : null, onchange: e => state.count_in_limit = e.target.checked ? 1 : 0 }),
            '회사당 동시 3개 제한 규칙에 포함 (미팅룸 권장)'
          )
        ),
        // V5 REQ-AUTH-01: 테넌트 접근 제한
        el('div', { class: 'modal-section' },
          el('div', { class: 'modal-section-title' }, '접근 권한 (테넌트 격리)'),
          el('select', { style: inputStyle(), onchange: e => state.tenant_scope = e.target.value },
            el('option', { value: '', selected: state.tenant_scope === '' ? 'selected' : null }, '모든 회사 공개 (기본)'),
            el('option', { value: 'WYLIE', selected: state.tenant_scope === 'WYLIE' ? 'selected' : null }, 'WYLIE 전용 (예: 5층 회의실)'),
            el('option', { value: 'LUSH', selected: state.tenant_scope === 'LUSH' ? 'selected' : null }, 'LUSH 전용')
          ),
          el('div', { style: 'font-size:12px;color:#7a7a7a;margin-top:6px;' },
            '특정 회사 전용으로 설정하면 다른 회사 사용자에게는 보이지 않습니다.'
          )
        )
      ),
      el('div', { class: 'modal-footer' },
        el('button', { class: 'btn-secondary', onclick: closeModal }, '취소'),
        el('button', { class: 'btn-primary', onclick: submit }, isEdit ? '저장' : '추가')
      )
    );
    backdrop.append(modal);
    document.body.append(backdrop);
  };

  const submit = async () => {
    if (!state.name.trim()) { toast('공간명을 입력해 주세요.', 'error'); return; }
    const payload = { ...state, name: state.name.trim() };
    const res = isEdit
      ? await api(`/api/spaces/${space.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await api('/api/spaces', { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) { toast(res.data?.error || '저장 실패', 'error'); return; }
    toast(isEdit ? '공간이 수정되었습니다.' : '공간이 추가되었습니다.', 'success');
    closeModal();
    renderAdminSpaces();
  };

  render();
}

async function deleteSpace(space) {
  if (!confirm(`'${space.name}' 공간을 삭제하시겠습니까?\n해당 공간의 모든 예약이 함께 취소됩니다.`)) return;
  const res = await api(`/api/spaces/${space.id}`, { method: 'DELETE' });
  if (!res.ok) { toast(res.data?.error || '삭제 실패', 'error'); return; }
  toast('공간이 삭제되었습니다.', 'success');
  renderAdminSpaces();
}

// ============== ADMIN - ORG (V4: 부서/직책 통합 관리 탭) ==============
async function renderAdminOrg() {
  if (State.user.role !== 'admin') {
    renderShell(el('main', { class: 'page-wrap' }, el('h1', null, '권한이 없습니다.')));
    return;
  }
  await loadOrgLists();

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '부서와 직책을 한 화면에서 통합 관리합니다. 멤버 생성 폼의 드롭다운에 즉시 반영됩니다.')
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('org'),
      el('div', { class: 'admin-content' },
        el('h2', { style: 'margin:0 0 8px;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '부서 / 직책 관리'),
        el('p', { style: 'margin:0 0 24px;color:#7a7a7a;font-size:14px;' }, '좌: 부서 / 우: 직책 — 각 항목 옆 아이콘으로 추가·수정·삭제할 수 있습니다.'),
        el('div', { class: 'split-view' },
          buildOrgPanel('부서', OrgCache.departments, 'departments'),
          buildOrgPanel('직책', OrgCache.positions, 'positions'),
        )
      )
    )
  );

  renderShell(main);
}

function buildOrgPanel(label, items, kind) {
  let inputValue = '';
  const panel = el('div', { class: 'org-panel' },
    el('div', { class: 'org-panel-head' },
      el('div', { class: 'org-panel-title' }, label),
      el('div', { class: 'org-panel-count' }, `${items.length}개`),
    ),
    el('div', { class: 'org-input-row' },
      el('input', {
        class: 'org-input',
        placeholder: `${label}명을 입력하세요`,
        oninput: e => inputValue = e.target.value,
        onkeydown: e => { if (e.key === 'Enter') doAdd(); }
      }),
      el('button', { class: 'btn-primary org-add-btn', onclick: () => doAdd() },
        el('i', { class: 'fa-solid fa-plus' }), '추가')
    ),
    el('div', { class: 'org-list' },
      items.length === 0
        ? el('div', { class: 'org-empty' }, `등록된 ${label}이 없습니다.`)
        : el('div', null, ...items.map(item =>
            el('div', { class: 'org-item' },
              el('div', { class: 'org-item-name' }, item.name),
              el('div', { class: 'org-item-actions' },
                el('button', { class: 'btn-icon', title: '수정', onclick: () => doEdit(item) },
                  el('i', { class: 'fa-solid fa-pen', style: 'font-size:12px;color:#0066cc;' })
                ),
                el('button', { class: 'btn-icon', title: '삭제', onclick: () => doDelete(item) },
                  el('i', { class: 'fa-solid fa-trash', style: 'font-size:12px;color:#d33;' })
                )
              )
            )
          ))
    )
  );

  async function doAdd() {
    const name = (inputValue || '').trim();
    if (!name) return;
    const res = await api(`/api/org/${kind}`, { method: 'POST', body: JSON.stringify({ name }) });
    if (!res.ok) { toast(res.data?.error || '추가 실패', 'error'); return; }
    toast(`${label} '${name}' 추가됨`, 'success');
    renderAdminOrg();
  }
  async function doEdit(item) {
    const newName = prompt(`${label} 이름 수정`, item.name);
    if (!newName || newName.trim() === item.name) return;
    const res = await api(`/api/org/${kind}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: newName.trim() }) });
    if (!res.ok) { toast(res.data?.error || '수정 실패', 'error'); return; }
    toast('수정되었습니다.', 'success');
    renderAdminOrg();
  }
  async function doDelete(item) {
    if (!confirm(`'${item.name}' ${label}을(를) 삭제하시겠습니까?\n해당 ${label}을 사용하던 멤버는 미지정 상태가 됩니다.`)) return;
    const res = await api(`/api/org/${kind}/${item.id}`, { method: 'DELETE' });
    if (!res.ok) { toast(res.data?.error || '삭제 실패', 'error'); return; }
    toast('삭제되었습니다.', 'success');
    renderAdminOrg();
  }

  return panel;
}

// ============== ERROR HANDLER ==============
window.addEventListener('error', (e) => {
  console.error('[app] global error:', e.message, e.filename, e.lineno);
  showFatal(e.message + '\n' + (e.error?.stack || ''));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[app] unhandled rejection:', e.reason);
  showFatal(String(e.reason?.stack || e.reason || 'Unknown error'));
});

function showFatal(message) {
  const loader = document.getElementById('app-loading');
  if (loader) loader.remove();
  document.body.innerHTML = '';
  const wrap = el('div', { style: 'padding:48px;max-width:720px;margin:0 auto;font-family:Inter,sans-serif;' },
    el('h2', { style: 'color:#d33;margin:0 0 12px;' }, '⚠️ 페이지 렌더링 오류'),
    el('p', { style: 'color:#7a7a7a;margin:0 0 24px;' }, '아래 오류 메시지를 확인해 주세요.'),
    el('pre', {
      style: 'background:#f5f5f7;padding:16px;border-radius:11px;font-size:12px;overflow:auto;color:#1d1d1f;white-space:pre-wrap;'
    }, message),
    el('div', { style: 'margin-top:24px;display:flex;gap:8px;' },
      el('button', { class: 'btn-primary', onclick: () => location.reload() }, '새로고침'),
      el('a', { href: '/login', class: 'btn-secondary' }, '로그인 페이지로')
    )
  );
  document.body.append(wrap);
}

// ============== V5 REQ-SEC-01: 최초 로그인 비밀번호 강제 변경 ==============
function openForcePasswordChangeModal() {
  // 다른 모든 페이지 접근 차단: 빈 셸 + 모달 오버레이만 표시
  document.body.innerHTML = '';
  const overlay = el('div', { class: 'modal-overlay is-force', id: 'forcePwOverlay' });
  document.body.append(overlay);

  const state = { pw1: '', pw2: '', loading: false, err: '' };

  function render() {
    overlay.innerHTML = '';
    const modal = el('div', { class: 'modal-card force-pw-modal' },
      el('div', { class: 'modal-head' },
        el('div', { class: 'force-pw-icon' }, el('i', { class: 'fa-solid fa-shield-halved' })),
        el('h2', { class: 'modal-title' }, '비밀번호 변경 필요'),
        el('p', { class: 'modal-sub' },
          `안녕하세요, ${State.user.name}님. 보안을 위해 최초 로그인 시 비밀번호를 변경해야 합니다.`
        )
      ),
      el('div', { class: 'modal-body' },
        el('div', { class: 'field-row' },
          el('label', null, '새 비밀번호 (8자 이상)'),
          el('input', {
            type: 'password',
            class: 'modal-input',
            value: state.pw1,
            placeholder: '새 비밀번호',
            oninput: e => { state.pw1 = e.target.value; },
          })
        ),
        el('div', { class: 'field-row' },
          el('label', null, '새 비밀번호 확인'),
          el('input', {
            type: 'password',
            class: 'modal-input',
            value: state.pw2,
            placeholder: '동일하게 한번 더 입력',
            oninput: e => { state.pw2 = e.target.value; },
            onkeydown: e => { if (e.key === 'Enter') submit(); },
          })
        ),
        state.err && el('div', { class: 'field-err' }, state.err)
      ),
      el('div', { class: 'modal-foot' },
        el('button', {
          class: 'btn-primary',
          disabled: state.loading,
          onclick: submit,
        }, state.loading ? '변경 중...' : '비밀번호 변경하고 시작하기')
      )
    );
    overlay.append(modal);
  }

  async function submit() {
    state.err = '';
    if (!state.pw1 || state.pw1.length < 8) { state.err = '비밀번호는 8자 이상이어야 합니다.'; render(); return; }
    if (state.pw1 !== state.pw2) { state.err = '비밀번호가 일치하지 않습니다.'; render(); return; }
    state.loading = true; render();
    const res = await api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ new_password: state.pw1 }),
    });
    if (!res?.ok) {
      state.err = res?.data?.error || '비밀번호 변경에 실패했습니다.';
      state.loading = false; render(); return;
    }
    toast('비밀번호가 변경되었습니다. 환영합니다!', 'success');
    State.user.is_first_login = 0;
    setTimeout(() => location.reload(), 700);
  }

  render();
}

// ============== BOOT ==============
async function boot() {
  try {
    const meRes = await api('/api/auth/me');
    if (!meRes?.data?.user) {
      window.location.href = '/login';
      return;
    }
    State.user = meRes.data.user;

    // V5 REQ-SEC-01: 최초 로그인 시 비밀번호 강제 변경 가드 (다른 페이지 진입 차단)
    if (State.user.is_first_login) {
      openForcePasswordChangeModal();
      return;
    }

    switch (State.page) {
      case 'home': await renderHome(); break;
      case 'spaces': await renderSpaces(); break;
      case 'insights': await renderInsights(); break;
      case 'admin-members': await renderAdminMembers(); break;
      case 'admin-general': await renderAdminGeneral(); break;
      case 'admin-spaces': await renderAdminSpaces(); break;
      case 'admin-org': await renderAdminOrg(); break;
      default: await renderHome();
    }
  } catch (err) {
    console.error('[app] boot error:', err);
    showFatal(err.message + '\n' + (err.stack || ''));
  }
}

// dayjs 로드 확인 후 부팅
function waitAndBoot() {
  if (typeof dayjs === 'undefined') {
    setTimeout(waitAndBoot, 50);
    return;
  }
  boot();
}
waitAndBoot();
