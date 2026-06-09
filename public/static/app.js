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

  const upcomingItems = Object.entries(grouped).slice(0, 8).map(([date, list]) => {
    const d = dayjs(date);
    return el('div', { class: 'upcoming-day' },
      el('div', { class: 'upcoming-day-label' },
        el('div', { class: 'day-num' }, d.format('D')),
        el('div', { class: 'day-text' }, d.locale('ko').format('M월, dddd'))
      ),
      el('div', { class: 'upcoming-items' },
        ...list.map(r =>
          el('div', { class: 'upcoming-row' },
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
let pollingInterval = null;

async function loadTimeline() {
  const [spacesRes, resvRes] = await Promise.all([
    api('/api/spaces'),
    api(`/api/reservations?date=${State.date}`)
  ]);
  State.spaces = spacesRes?.data?.spaces || [];
  State.reservations = resvRes?.data?.reservations || [];
}

async function renderSpaces() {
  await loadTimeline();
  startPolling();

  const dateLabel = dayjs(State.date).locale('ko').format('YYYY년 M월 D일 (ddd)');

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'timeline-toolbar' },
      el('div', { class: 'timeline-date-nav' },
        el('button', { class: 'btn-icon', onclick: () => changeDate(-1) }, el('i', { class: 'fa-solid fa-chevron-left' })),
        el('div', { class: 'date-display' }, dateLabel),
        el('button', { class: 'btn-icon', onclick: () => changeDate(1) }, el('i', { class: 'fa-solid fa-chevron-right' })),
        el('button', { class: 'btn-ghost', onclick: () => { State.date = dayjs().format('YYYY-MM-DD'); renderSpaces(); } }, '오늘')
      ),
      el('div', { class: 'timeline-legend' },
        el('span', { class: 'legend-chip' }, el('span', { class: 'legend-square', style: 'background:#0066cc;' }), '와일리'),
        el('span', { class: 'legend-chip' }, el('span', { class: 'legend-square', style: 'background:#1d1d1f;' }), '러쉬코리아'),
        el('span', { style: 'color:#cccccc;' }, '|'),
        el('span', { class: 'legend-chip', style: 'color:#7a7a7a;' }, '드래그하여 예약 만들기'),
      )
    ),
    el('div', { class: 'timeline-container' },
      el('div', { class: 'timeline-scroll' },
        buildTimelineGrid()
      )
    )
  );

  renderShell(main);
  attachDragHandlers();
  drawNowLine();
}

function changeDate(delta) {
  State.date = dayjs(State.date).add(delta, 'day').format('YYYY-MM-DD');
  renderSpaces();
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

  return el('div', {
    class: 'timeline-event',
    style: `top:${top}px;height:${height}px;background:${bg};`,
    onclick: (e) => { e.stopPropagation(); openReservationDetail(r); },
  },
    el('div', { class: 'ev-title' }, r.title || '새로운 일정'),
    height > 32 && el('div', { class: 'ev-time' }, `${r.start_time} - ${r.end_time}`),
    el('div', {
      class: 'ev-owner-avatar',
      style: `background:${r.user_avatar_color || '#7a7a7a'};`,
      title: r.user_name
    }, initials(r.user_name))
  );
}

function attachDragHandlers() {
  const grid = $('#timeline-grid');
  if (!grid) return;

  grid.addEventListener('mousedown', (e) => {
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

  document.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    const rect = dragState.col.getBoundingClientRect();
    dragState.currentY = Math.max(0, Math.min(24 * 40, e.clientY - rect.top));
    updateDragPreview();
  });

  document.addEventListener('mouseup', (e) => {
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
  });
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
  const backdrop = el('div', { class: 'modal-backdrop', id: 'reservation-modal', onclick: (e) => { if (e.target === backdrop) closeModal(); } });
  const modal = el('div', { class: 'modal' },
    el('div', { class: 'modal-header' },
      el('div', { class: 'modal-header-title' }, r.title || '예약 상세'),
      el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
    ),
    el('div', { class: 'modal-body' },
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '일시'),
        el('div', null, `${r.date} · ${r.start_time} - ${r.end_time}`)
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
      el('button', { class: 'btn-primary', onclick: closeModal }, '닫기')
    )
  );
  backdrop.append(modal);
  document.body.append(backdrop);
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
async function renderInsights() {
  const res = await api('/api/insights/overview?days=30');
  const data = res?.data || {};
  const avgH = Math.floor((data.avg_minutes || 0) / 60);
  const avgM = (data.avg_minutes || 0) % 60;

  const heatmapMax = Math.max(1, ...((data.heatmap || []).flat()));

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '인사이트'),
        el('p', null, '지난 30일 · 공간 운영 데이터를 한눈에')
      )
    ),
    el('div', { class: 'insight-stats-grid' },
      el('div', { class: 'stat-card' },
        el('div', { class: 'stat-label' }, '평균 회의 진행 시간'),
        el('div', { class: 'stat-value' }, `${avgH}시간 ${avgM}분`),
        el('div', { class: 'stat-trend' }, '회의가 종료된 모든 예약 평균')
      ),
      el('div', { class: 'stat-card' },
        el('div', { class: 'stat-label' }, '총 예약 건수'),
        el('div', { class: 'stat-value' }, `${data.total || 0}건`),
        el('div', { class: 'stat-trend' }, '지난 30일 누적')
      ),
      el('div', { class: 'stat-card' },
        el('div', { class: 'stat-label' }, '가동 공간 수'),
        el('div', { class: 'stat-value' }, `${(data.popular_spaces || []).filter(p => p.count > 0).length}/${(data.popular_spaces || []).length}`),
        el('div', { class: 'stat-trend' }, '활성 공간 비율')
      ),
    ),
    el('div', { class: 'insight-popular' },
      el('h3', null, '인기 공간'),
      el('div', { class: 'popular-grid' },
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

  renderShell(main);
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
            el('p', { style: 'margin:4px 0 0;color:#7a7a7a;font-size:14px;' }, '멤버 초대부터 정보 수정까지, 다양한 속성으로 검색하고 손쉽게 관리할 수 있어요.')
          ),
          el('button', { class: 'btn-primary', onclick: openMemberInviteModal }, '초대하기')
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
      el('td', null, m.phone || '-'),
      el('td', null, el('span', { class: 'status-badge s-active' }, '활성')),
      el('td', null, el('span', { class: m.role === 'admin' ? 'status-badge s-admin' : 'status-badge s-member' }, m.role === 'admin' ? 'Admin' : '일반 멤버')),
      el('td', null,
        m.id !== State.user.id
          ? el('button', { class: 'btn-icon', onclick: () => deleteMember(m.id) }, el('i', { class: 'fa-solid fa-trash', style: 'font-size:12px;color:#d33;' }))
          : ''
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
        el('th', null, '휴대전화번호'),
        el('th', null, '상태'),
        el('th', null, '역할'),
        el('th', null, '')
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

function openMemberInviteModal() {
  let mode = 'single'; // 'single' | 'bulk'
  const state = {
    name: '', email: '', phone: '', department: '', position: '',
    bulkRows: Array.from({ length: 5 }, () => ({ name: '', email: '', phone: '', department: '', position: '' })),
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
          }, '개별 등록'),
          el('button', {
            style: `flex:1;padding:8px 16px;border:none;border-radius:8px;font-size:14px;font-weight:600;background:${mode === 'bulk' ? '#fff' : 'transparent'};color:${mode === 'bulk' ? '#0066cc' : '#7a7a7a'};cursor:pointer;`,
            onclick: () => { mode = 'bulk'; render(); }
          }, '일괄 등록')
        ),
        el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
      ),
      el('div', { class: 'modal-body' },
        mode === 'single' ? renderSingle() : renderBulk()
      ),
      el('div', { class: 'modal-footer' },
        el('button', { class: 'btn-secondary', onclick: closeModal }, '취소'),
        el('button', { class: 'btn-primary', onclick: submit }, '초대하기')
      )
    );
    backdrop.append(modal);
    document.body.append(backdrop);
  };

  const renderSingle = () => el('div', null,
    el('div', { class: 'modal-section' },
      el('div', { class: 'modal-section-title' }, '기본 정보'),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
        el('input', { placeholder: '이름', value: state.name, oninput: e => state.name = e.target.value, style: inputStyle() }),
        el('input', { placeholder: '부서 (선택)', value: state.department, oninput: e => state.department = e.target.value, style: inputStyle() }),
        el('input', { placeholder: '직책 (선택)', value: state.position, oninput: e => state.position = e.target.value, style: inputStyle() }),
      )
    ),
    el('div', { class: 'modal-section' },
      el('div', { class: 'modal-section-title' }, '로그인 정보'),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
        el('input', { placeholder: '이메일 주소', value: state.email, oninput: e => state.email = e.target.value, style: inputStyle() }),
        el('input', { placeholder: '휴대전화번호 (예: +82 10-1234-5678)', value: state.phone, oninput: e => state.phone = e.target.value, style: inputStyle() }),
      ),
      el('div', { style: 'margin-top:8px;font-size:12px;color:#7a7a7a;' }, '* 초기 비밀번호: user1234 (가입 후 변경 가능)')
    )
  );

  const inputStyle = () => 'width:100%;padding:12px 16px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;background:#fff;';

  const renderBulk = () => {
    const body = el('div', null,
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' },
        el('div', { style: 'font-size:14px;color:#7a7a7a;' }, `${state.bulkRows.length}명까지 등록 가능`),
        el('button', { class: 'btn-ghost', onclick: () => { state.bulkRows.push(...Array.from({ length: 5 }, () => ({ name: '', email: '', phone: '', department: '', position: '' }))); render(); } }, '+ 5명 더 추가')
      ),
      el('div', { style: 'overflow:auto;max-height:340px;border:1px solid #e0e0e0;border-radius:11px;' },
        el('table', { class: 'data-table', style: 'font-size:13px;' },
          el('thead', null, el('tr', null,
            el('th', null, '이름'), el('th', null, '이메일'), el('th', null, '전화번호'), el('th', null, '부서'), el('th', null, '직책')
          )),
          el('tbody', null,
            ...state.bulkRows.map((row, i) =>
              el('tr', null,
                el('td', null, el('input', { value: row.name, oninput: e => state.bulkRows[i].name = e.target.value, style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;' })),
                el('td', null, el('input', { value: row.email, oninput: e => state.bulkRows[i].email = e.target.value, style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;' })),
                el('td', null, el('input', { value: row.phone, oninput: e => state.bulkRows[i].phone = e.target.value, style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;' })),
                el('td', null, el('input', { value: row.department, oninput: e => state.bulkRows[i].department = e.target.value, style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;' })),
                el('td', null, el('input', { value: row.position, oninput: e => state.bulkRows[i].position = e.target.value, style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;' }))
              )
            )
          )
        )
      )
    );
    return body;
  };

  const submit = async () => {
    if (mode === 'single') {
      if (!state.name || !state.email) { toast('이름과 이메일은 필수입니다.', 'error'); return; }
      const res = await api('/api/members', { method: 'POST', body: JSON.stringify(state) });
      if (!res.ok) { toast(res.data?.error || '등록 실패', 'error'); return; }
      toast('멤버가 등록되었습니다.', 'success');
    } else {
      const members = state.bulkRows.filter(r => r.name && r.email);
      if (members.length === 0) { toast('등록할 멤버를 입력해 주세요.', 'error'); return; }
      const res = await api('/api/members/bulk', { method: 'POST', body: JSON.stringify({ members }) });
      if (!res.ok) { toast('등록 실패', 'error'); return; }
      toast(`${res.data.success}명 등록 완료 (${res.data.failed.length}건 실패)`, 'success');
    }
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
        el('p', null, '공간 자원을 확인합니다.')
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('spaces'),
      el('div', { class: 'admin-content' },
        el('h2', { style: 'margin:0 0 8px;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '공간'),
        el('p', { style: 'margin:0 0 24px;color:#7a7a7a;font-size:14px;' }, '운영 중인 공간 자원 목록입니다.'),
        el('table', { class: 'data-table' },
          el('thead', null, el('tr', null,
            el('th', null, '공간명'), el('th', null, '유형'), el('th', null, '수용 인원'), el('th', null, '3개 제한 카운트'), el('th', null, '색상')
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
                el('td', null, el('span', { style: `display:inline-block;width:16px;height:16px;border-radius:4px;background:${s.color};vertical-align:middle;margin-right:6px;` }), s.color)
              )
            )
          )
        )
      )
    )
  );

  renderShell(main);
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

// ============== BOOT ==============
async function boot() {
  try {
    const meRes = await api('/api/auth/me');
    if (!meRes?.data?.user) {
      window.location.href = '/login';
      return;
    }
    State.user = meRes.data.user;

    switch (State.page) {
      case 'home': await renderHome(); break;
      case 'spaces': await renderSpaces(); break;
      case 'insights': await renderInsights(); break;
      case 'admin-members': await renderAdminMembers(); break;
      case 'admin-general': await renderAdminGeneral(); break;
      case 'admin-spaces': await renderAdminSpaces(); break;
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
