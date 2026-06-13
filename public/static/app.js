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
  tenants: [], // V11 §3-3: 테넌트별 일정 색상 캐시
  // V6-4: 홈 → 공간 이동 시 sessionStorage에 저장된 jumpDate를 우선 적용
  date: (() => {
    try {
      const jd = sessionStorage.getItem('jumpDate');
      if (jd && /^\d{4}-\d{2}-\d{2}$/.test(jd)) return jd;
    } catch (e) {}
    return todayISO();
  })(),
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

  // V6-2: 모바일 햄버거 드로어용 navLinks 노드 (데스크톱/모바일 공통)
  // V10 §4-1: 인사이트 메뉴는 어드민에게만 노출
  const navLinksNode = el('nav', { class: 'nav-links' },
    navLink('home', '홈', 'fa-house', '/home'),
    navLink('spaces', '공간', 'fa-calendar-day', '/spaces'),
    isAdmin && navLink('insights', '인사이트', 'fa-chart-column', '/insights'),
    isAdmin && navLink('admin-members', '관리', 'fa-gear', '/admin/members'),
  );

  // V6-2: 햄버거 버튼 (모바일에서만 노출, CSS로 제어)
  const hamburgerBtn = el('button', {
    class: 'nav-hamburger',
    'aria-label': '메뉴 열기',
    onclick: openMobileNavDrawer,
  },
    el('span', { class: 'hb-bar' }),
    el('span', { class: 'hb-bar' }),
    el('span', { class: 'hb-bar' }),
  );

  const shell = el('div', { class: 'app-shell' },
    // Global Nav
    el('header', { class: 'global-nav' },
      el('div', { class: 'global-nav-inner' },
        el('a', { href: '/home', class: 'nav-brand tesla-brand' },
          // V36 Tesla-style 미니멀 워드마크 로고
          //   - 좌측: 28x28 SVG 모노그램 (M 글자를 기하학적 라인으로 — Tesla T 모티프)
          //   - 우측: 자간 넓힌 영문 워드마크 "MATEGROUND" + 한글 "메이트리그라운드"
          el('span', { class: 'tesla-logo-mark', 'aria-hidden': 'true' },
            // SVG 마크: 두 개의 평행 수직 라인 + 위를 가로지르는 짧은 수평선 (M + T 융합)
            // viewBox 0 0 28 28, stroke 2px, currentColor 상속
            (() => {
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              svg.setAttribute('viewBox', '0 0 28 28');
              svg.setAttribute('width', '28');
              svg.setAttribute('height', '28');
              svg.setAttribute('fill', 'none');
              svg.setAttribute('stroke', 'currentColor');
              svg.setAttribute('stroke-width', '2.4');
              svg.setAttribute('stroke-linecap', 'round');
              svg.setAttribute('stroke-linejoin', 'round');
              // V38: M 글자가 명확히 보이도록 path 재설계 — 양 다리는 바깥에서 시작, 중앙 V는 깊고 또렷하게
              // 좌하단(4,23) → 좌상단(4,5) → 중앙 하단 V(14,18) → 우상단(24,5) → 우하단(24,23)
              svg.innerHTML = '<path d="M4 23 L4 5 L14 18 L24 5 L24 23" />';
              return svg;
            })()
          ),
          el('span', { class: 'tesla-logo-wordmark' },
            // V37: 사용자 요청 — 영문 'MATEGROUND' 제거, 한글 '메이트리그라운드'만 노출
            el('span', { class: 'tesla-logo-kor tesla-logo-kor--solo' }, '메이트리그라운드')
          )
        ),
        navLinksNode,
        el('div', { class: 'nav-actions' },
          // V7-1: 사용자 이름 텍스트 (모바일 전용 노출 — CSS로 데스크톱에서는 숨김)
          el('span', { class: 'nav-user-name', title: tenantName }, State.user?.name || ''),
          // V7 최종본 §2: 아바타 클릭 즉시 로그아웃 버그 수정
          // → 드롭다운 메뉴(마이페이지 / 비밀번호 변경 / 로그아웃) 노출
          el('div', { class: 'nav-avatar-wrap', style: 'position:relative;' },
            el('div', {
              class: 'nav-avatar',
              style: `background:${State.user?.avatar_color || '#7a7a7a'};`,
              title: `${State.user?.name} · ${tenantName}`,
              onclick: (e) => { e.stopPropagation(); toggleUserDropdown(); },
            }, initials(State.user?.name))
          ),
          hamburgerBtn
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

// V6-2: 모바일 햄버거 드로어
function openMobileNavDrawer() {
  // 기존 드로어 제거
  $('.mobile-nav-overlay')?.remove();

  const isAdmin = State.user?.role === 'admin';
  const tenantName = State.user?.tenant_id === 'WYLIE' ? '와일리' : '러쉬코리아';

  const close = () => {
    const overlay = $('.mobile-nav-overlay');
    if (!overlay) return;
    overlay.classList.add('is-closing');
    setTimeout(() => overlay.remove(), 220);
  };

  const navItem = (pageKey, label, icon, href) => {
    const isActive = State.page === pageKey || (pageKey === 'admin-members' && State.page.startsWith('admin-'));
    return el('a', {
      href,
      class: `mobile-nav-item ${isActive ? 'is-active' : ''}`,
      onclick: close,
    },
      el('i', { class: `fa-solid ${icon}` }),
      el('span', null, label),
      el('i', { class: 'fa-solid fa-chevron-right', style: 'margin-left:auto;font-size:11px;opacity:0.5;' })
    );
  };

  const overlay = el('div', {
    class: 'mobile-nav-overlay',
    onclick: (e) => { if (e.target === overlay) close(); },
  },
    el('div', { class: 'mobile-nav-drawer' },
      el('div', { class: 'mobile-nav-header' },
        el('div', { class: 'mobile-nav-brand' }, '메이트리그라운드'),
        el('button', {
          class: 'mobile-nav-close',
          'aria-label': '메뉴 닫기',
          onclick: close,
        }, el('i', { class: 'fa-solid fa-xmark' }))
      ),
      el('div', { class: 'mobile-nav-user' },
        el('div', {
          class: 'nav-avatar',
          style: `background:${State.user?.avatar_color || '#7a7a7a'};width:36px;height:36px;font-size:14px;`,
        }, initials(State.user?.name)),
        el('div', { style: 'display:flex;flex-direction:column;gap:2px;' },
          el('div', { style: 'font-size:14px;font-weight:600;color:#1d1d1f;' }, State.user?.name || ''),
          el('div', { style: 'font-size:12px;color:#7a7a7a;' }, tenantName + ' · ' + (State.user?.role === 'admin' ? '관리자' : '멤버'))
        )
      ),
      el('div', { class: 'mobile-nav-list' },
        navItem('home', '홈', 'fa-house', '/home'),
        navItem('spaces', '공간', 'fa-calendar-day', '/spaces'),
        // V10 §4-1: 인사이트는 어드민 전용
        isAdmin && navItem('insights', '인사이트', 'fa-chart-column', '/insights'),
        isAdmin && navItem('admin-members', '관리', 'fa-gear', '/admin/members'),
      ),
      el('div', { class: 'mobile-nav-foot' },
        el('button', {
          class: 'mobile-nav-logout',
          onclick: async () => { close(); await new Promise(r => setTimeout(r, 220)); handleLogout(); },
        }, el('i', { class: 'fa-solid fa-arrow-right-from-bracket' }), '로그아웃')
      )
    )
  );
  document.body.append(overlay);
  // 애니메이션 트리거
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}

/**
 * V7 최종본 §2: 아바타 클릭 시 드롭다운 메뉴
 *  - 마이페이지 (현재 단계: 사용자 정보 패널)
 *  - 비밀번호 변경
 *  - 로그아웃 (여기서만 confirm 실행)
 */
function toggleUserDropdown() {
  const existing = document.querySelector('.user-dropdown-menu');
  if (existing) { existing.remove(); return; }

  const wrap = document.querySelector('.nav-avatar-wrap');
  if (!wrap) return;

  const tenantName = State.user?.tenant_id === 'WYLIE' ? '와일리' : '러쉬코리아';

  const menu = el('div', { class: 'user-dropdown-menu' },
    // 사용자 정보 헤더
    el('div', { class: 'udm-head' },
      el('div', { class: 'udm-name' }, State.user?.name || ''),
      el('div', { class: 'udm-sub' }, (State.user?.email || '') + ' · ' + tenantName)
    ),
    el('div', { class: 'udm-divider' }),
    // 메뉴 항목
    el('button', {
      class: 'udm-item',
      onclick: () => { closeUserDropdown(); openMyPageModal(); },
    }, el('i', { class: 'fa-solid fa-user' }), '내 정보'),
    el('button', {
      class: 'udm-item',
      onclick: () => { closeUserDropdown(); openChangePasswordModal(); },
    }, el('i', { class: 'fa-solid fa-key' }), '비밀번호 변경'),
    el('div', { class: 'udm-divider' }),
    el('button', {
      class: 'udm-item is-danger',
      onclick: () => { closeUserDropdown(); handleLogout(); },
    }, el('i', { class: 'fa-solid fa-arrow-right-from-bracket' }), '로그아웃')
  );

  wrap.append(menu);

  // 바깥 클릭 시 닫힘 (다음 tick에 등록 — 현재 click 이벤트 흡수 방지)
  setTimeout(() => {
    document.addEventListener('click', onceCloseUserDropdown, { once: true });
  }, 0);
}

function onceCloseUserDropdown(e) {
  const menu = document.querySelector('.user-dropdown-menu');
  if (!menu) return;
  if (menu.contains(e.target)) {
    // 메뉴 안 클릭은 무시 — 다시 등록
    document.addEventListener('click', onceCloseUserDropdown, { once: true });
    return;
  }
  menu.remove();
}

function closeUserDropdown() {
  document.querySelector('.user-dropdown-menu')?.remove();
}

/** V7 최종본 §2: 내 정보(마이페이지) 미니 모달 */
function openMyPageModal() {
  closeModal();
  const tenantName = State.user?.tenant_id === 'WYLIE' ? '와일리' : '러쉬코리아';
  const backdrop = el('div', {
    class: 'modal-backdrop',
    id: 'reservation-modal',
    onclick: (e) => { if (e.target === backdrop) closeModal(); }
  });
  const modal = el('div', { class: 'modal', style: 'max-width:420px;' },
    el('div', { class: 'modal-header' },
      el('div', { class: 'modal-header-title' }, '내 정보'),
      el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
    ),
    el('div', { class: 'modal-body' },
      el('div', { class: 'modal-section' },
        el('div', { class: 'mypage-row' }, el('span', { class: 'mr-label' }, '이름'), el('span', { class: 'mr-value' }, State.user?.name || '-')),
        el('div', { class: 'mypage-row' }, el('span', { class: 'mr-label' }, '이메일'), el('span', { class: 'mr-value' }, State.user?.email || '-')),
        el('div', { class: 'mypage-row' }, el('span', { class: 'mr-label' }, '소속'), el('span', { class: 'mr-value' }, tenantName)),
        el('div', { class: 'mypage-row' }, el('span', { class: 'mr-label' }, '부서'), el('span', { class: 'mr-value' }, State.user?.department || '-')),
        el('div', { class: 'mypage-row' }, el('span', { class: 'mr-label' }, '직책'), el('span', { class: 'mr-value' }, State.user?.position || '-')),
        el('div', { class: 'mypage-row' }, el('span', { class: 'mr-label' }, '권한'), el('span', { class: 'mr-value' }, State.user?.role === 'admin' ? '관리자(Admin)' : '일반 멤버'))
      )
    ),
    el('div', { class: 'modal-footer' },
      el('button', { class: 'btn-secondary', onclick: closeModal }, '닫기')
    )
  );
  backdrop.append(modal);
  document.body.append(backdrop);
}

/** V7 최종본 §2: 비밀번호 변경 모달 */
function openChangePasswordModal() {
  closeModal();
  const state = { cur: '', next: '', confirm: '' };
  const backdrop = el('div', {
    class: 'modal-backdrop',
    id: 'reservation-modal',
    onclick: (e) => { if (e.target === backdrop) closeModal(); }
  });
  const modal = el('div', { class: 'modal', style: 'max-width:420px;' },
    el('div', { class: 'modal-header' },
      el('div', { class: 'modal-header-title' }, '비밀번호 변경'),
      el('button', { class: 'btn-icon', onclick: closeModal }, el('i', { class: 'fa-solid fa-xmark' }))
    ),
    el('div', { class: 'modal-body' },
      el('div', { class: 'modal-section' },
        el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
          el('input', { type: 'password', placeholder: '현재 비밀번호', style: inputStyle(), oninput: e => state.cur = e.target.value }),
          el('input', { type: 'password', placeholder: '새 비밀번호 (8자 이상)', style: inputStyle(), oninput: e => state.next = e.target.value }),
          el('input', { type: 'password', placeholder: '새 비밀번호 확인', style: inputStyle(), oninput: e => state.confirm = e.target.value })
        )
      )
    ),
    el('div', { class: 'modal-footer' },
      el('button', { class: 'btn-secondary', onclick: closeModal }, '취소'),
      el('button', { class: 'btn-primary', onclick: submit }, '변경')
    )
  );
  backdrop.append(modal);
  document.body.append(backdrop);

  async function submit() {
    if (!state.cur || !state.next || !state.confirm) { toast('모든 항목을 입력해 주세요.', 'error'); return; }
    if (state.next.length < 8) { toast('새 비밀번호는 8자 이상이어야 합니다.', 'error'); return; }
    if (state.next !== state.confirm) { toast('새 비밀번호가 일치하지 않습니다.', 'error'); return; }
    const res = await api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: state.cur, new_password: state.next })
    });
    if (!res.ok) { toast(res.data?.error || '변경에 실패했습니다.', 'error'); return; }
    toast('비밀번호가 변경되었습니다.', 'success');
    closeModal();
  }
}

async function handleLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ============== HOME PAGE ==============
async function renderHome() {
  // V34 §5: 홈 화면 전면 재설계 — 단조로운 home-hero + upcoming-section 폐기
  //   → 한눈에 보이는 카드형 대시보드(인사 / 다음 일정 / 통계 / 오늘 일정 / 빠른 진입)
  // V7 고도화 §3: 받은 초대(PENDING) + 다가오는 일정(주최 OR 수락) 병렬 로드 (유지)
  const [resUpcoming, resInvites] = await Promise.all([
    api('/api/reservations/upcoming'),
    api('/api/reservations/invitations'),
  ]);
  const reservations = resUpcoming?.data?.reservations || [];
  const invitations = resInvites?.data?.invitations || [];

  const goToSpace = (date, time) => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sessionStorage.setItem('jumpDate', date);
    }
    sessionStorage.setItem('spaceFocusTime', time || '');
    State.date = date;
    State.view = 'day';
    window.location.href = '/spaces';
  };

  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');
  const isAdmin = State.user?.role === 'admin';

  // V34 §5: 데이터 가공
  const todayList = reservations.filter(r => r.date === todayStr);
  const upcomingList = reservations.filter(r => r.date > todayStr).slice(0, 5);
  const nextOne = todayList[0] || upcomingList[0] || null;
  const myWeekCount = reservations.filter(r => {
    const d = dayjs(r.date);
    return d.isAfter(today.subtract(1,'day')) && d.isBefore(today.add(7,'day'));
  }).length;

  // 인사말 (시간대별)
  const hour = today.hour();
  const greeting = hour < 6 ? '늦은 시각이네요' : hour < 12 ? '좋은 아침입니다' : hour < 18 ? '오늘도 화이팅' : '오늘 하루도 수고하셨어요';

  // ── 카드 1: 인사 (전체 폭, 핑크 그라디언트) ──
  const greetCard = el('section', { class: 'v34-card v34-card--greet' },
    el('div', { class: 'v34-greet-text' },
      el('h2', null, `${State.user.name}님, ${greeting}`),
      el('p', null, today.locale('ko').format('YYYY년 M월 D일 dddd') + ' · ' + (State.user?.tenant_id === 'WYLIE' ? '와일리' : '러쉬코리아'))
    ),
    el('div', { class: 'v34-greet-date' },
      el('div', { class: 'v34-greet-date-month' }, today.locale('en').format('MMM')),
      el('div', { class: 'v34-greet-date-day' }, today.format('D'))
    )
  );

  // ── 카드 2: 다음 일정 ──
  const nextCard = el('section', {
    class: 'v34-card v34-card--next' + (nextOne ? ' is-clickable' : ''),
    style: nextOne ? 'cursor:pointer;' : '',
    onclick: nextOne ? () => goToSpace(nextOne.date, nextOne.start_time) : null,
  },
    el('div', { class: 'v34-card__head' },
      el('h3', { class: 'v34-card__title' }, '다음 일정'),
      el('div', { class: 'v34-card__icon' }, el('i', { class: 'fa-solid fa-clock' }))
    ),
    nextOne
      ? el('div', null,
          el('p', { class: 'v34-next-time' },
            (nextOne.date === todayStr ? '오늘 ' : dayjs(nextOne.date).locale('ko').format('M/D ')) +
            `${nextOne.start_time} - ${nextOne.end_time}`
          ),
          el('p', { class: 'v34-next-title' }, nextOne.title || '새로운 일정'),
          el('span', { class: 'v34-next-space' },
            el('span', { class: 'space-dot', style: `background:${nextOne.space_color || '#7a7a7a'};` }),
            nextOne.space_name
          )
        )
      : el('p', { class: 'v34-next-empty' }, '예정된 일정이 없습니다.')
  );

  // ── 카드 3: 이번 주 일정 개수 ──
  const weekCard = el('section', { class: 'v34-card v34-card--stat' },
    el('div', { class: 'v34-card__head' },
      el('h3', { class: 'v34-card__title' }, '이번 주 일정'),
      el('div', { class: 'v34-card__icon' }, el('i', { class: 'fa-solid fa-calendar-check' }))
    ),
    el('div', { class: 'v34-stat-row' },
      el('h2', { class: 'v34-card__big' }, String(myWeekCount)),
      el('span', { class: 'v34-stat-unit' }, '건')
    ),
    el('p', { class: 'v34-card__sub' }, `예정 ${upcomingList.length}건 · 오늘 ${todayList.length}건`)
  );

  // ── 카드 4: 받은 초대 (V35: 클릭하면 팝업 모달 / 0이면 비활성화) ──
  const hasInvites = invitations.length > 0;
  const inviteCard = el('section', {
    class: 'v34-card v34-card--stat2' + (hasInvites ? ' is-clickable v34-invite-clickable' : ' v34-invite-disabled'),
    style: hasInvites ? 'cursor:pointer;' : 'cursor:default;opacity:0.85;',
    onclick: hasInvites ? () => openInviteModal(invitations) : null,
    title: hasInvites ? '클릭하면 초대 상세를 확인할 수 있어요' : '',
  },
    el('div', { class: 'v34-card__head' },
      el('h3', { class: 'v34-card__title' }, '받은 초대'),
      el('div', { class: 'v34-card__icon' }, el('i', { class: 'fa-solid fa-envelope-open-text' }))
    ),
    el('div', { class: 'v34-stat-row' },
      el('h2', { class: 'v34-card__big' }, String(invitations.length)),
      el('span', { class: 'v34-stat-unit' }, '건')
    ),
    el('p', { class: 'v34-card__sub' },
      hasInvites
        ? el('span', null,
            '클릭하여 응답하기 ',
            el('i', { class: 'fa-solid fa-chevron-right', style: 'font-size:10px;margin-left:2px;' })
          )
        : '확인할 초대가 없습니다'
    )
  );

  // ── 카드 5: 빠른 진입 ──
  const quickItems = [
    { href: '/spaces', icon: 'fa-calendar-day', label: '공간 예약' },
    { href: '/spaces', icon: 'fa-plus-circle', label: '새 일정' },
    isAdmin && { href: '/insights', icon: 'fa-chart-column', label: '인사이트' },
    isAdmin && { href: '/admin/members', icon: 'fa-users-gear', label: '멤버 관리' },
  ].filter(Boolean);

  const quickCard = el('section', { class: 'v34-card v34-card--quick' },
    el('div', { class: 'v34-card__head' },
      el('h3', { class: 'v34-card__title' }, '빠른 진입'),
      el('div', { class: 'v34-card__icon', style: 'background:#FFE4EA;color:#FF385C;' },
        el('i', { class: 'fa-solid fa-bolt' })
      )
    ),
    el('div', { class: 'v34-quick-grid' },
      ...quickItems.map(q =>
        el('a', { href: q.href, class: 'v34-quick-item' },
          el('i', { class: `fa-solid ${q.icon}` }),
          el('span', null, q.label)
        )
      )
    )
  );

  // ── 카드 6: 오늘의 일정 (있을 때만, 전체 폭) ──
  const todayCard = todayList.length > 0
    ? el('section', { class: 'v34-card v34-card--today' },
        el('div', { class: 'v34-card__head' },
          el('h3', { class: 'v34-card__title' }, `오늘의 일정 · ${todayList.length}건`),
          el('div', { class: 'v34-card__icon' }, el('i', { class: 'fa-solid fa-list-check' }))
        ),
        el('div', { class: 'v34-today-list' },
          ...todayList.map(r =>
            el('div', {
              class: 'v34-today-row',
              onclick: () => goToSpace(r.date, r.start_time)
            },
              el('span', { class: 'v34-today-time' }, `${r.start_time} - ${r.end_time}`),
              el('span', { class: 'v34-today-title' },
                r.title || '새로운 일정',
                r.my_role === 'ATTENDEE'
                  ? el('span', { class: 'role-badge is-attendee', style: 'margin-left:8px;' }, '참석')
                  : el('span', { class: 'role-badge is-owner', style: 'margin-left:8px;' }, '주최')
              ),
              el('span', { class: 'v34-today-space' },
                el('span', { class: 'space-dot', style: `background:${r.space_color || '#7a7a7a'};` }),
                r.space_name
              )
            )
          )
        )
      )
    : null;

  // V35 §1: 받은 초대 응답 대기 카드 제거 — '받은 초대' 카드(④)를 클릭하면 모달 팝업
  //   사용자 보고: 스크롤 번거로움 → 통합 + 0건이면 비활성화

  // ── 카드 7: 앞으로의 일정 (오늘 외 다가오는 5건, 전체 폭) ──
  const upcomingCard = upcomingList.length > 0
    ? el('section', { class: 'v34-card v34-card--today' },
        el('div', { class: 'v34-card__head' },
          el('h3', { class: 'v34-card__title' }, '앞으로의 일정'),
          el('div', { class: 'v34-card__icon', style: 'background:#E8F5FF;color:#0066cc;' },
            el('i', { class: 'fa-solid fa-calendar-days' })
          )
        ),
        el('div', { class: 'v34-today-list' },
          ...upcomingList.map(r =>
            // V37 §2: 모바일에서 4줄(날짜 / 시간 / 회의명 / 위치)로 분리되도록
            //   date와 time을 별도 span으로 나눠 렌더 → CSS @media에서 flex-direction:column으로 세로 배치
            el('div', {
              class: 'v34-today-row',
              onclick: () => goToSpace(r.date, r.start_time)
            },
              el('span', { class: 'v34-today-date' },
                dayjs(r.date).locale('ko').format('M/D(dd)')
              ),
              el('span', { class: 'v34-today-time' },
                r.start_time + ' - ' + r.end_time
              ),
              el('span', { class: 'v34-today-title' },
                r.title || '새로운 일정',
                r.my_role === 'ATTENDEE'
                  ? el('span', { class: 'role-badge is-attendee', style: 'margin-left:8px;' }, '참석')
                  : el('span', { class: 'role-badge is-owner', style: 'margin-left:8px;' }, '주최')
              ),
              el('span', { class: 'v34-today-space' },
                el('span', { class: 'space-dot', style: `background:${r.space_color || '#7a7a7a'};` }),
                r.space_name
              )
            )
          )
        )
      )
    : null;

  const dashboard = el('div', { class: 'v34-dashboard' },
    greetCard,
    nextCard,
    weekCard,
    inviteCard,
    quickCard,
    todayCard,
    upcomingCard,
  );

  const main = el('main', { class: 'page-wrap' }, dashboard);
  renderShell(main);

  // V39 §4: 홈 페이지도 3초 폴링으로 예약 변경 즉시 반영
  //   - startPolling 내부에서 State.page === 'home' 분기 처리
  //   - 시그니처 비교로 변경 시에만 renderHome() 재호출
  if (typeof startPolling === 'function') {
    try { startPolling(); } catch (e) { console.warn('[app] home polling start failed:', e?.message); }
  }
}

// ============== SPACES (TIMELINE) PAGE ==============
let dragState = null;
// V14: 리사이즈 상태는 새 시스템(R 변수)에서 단일 관리 — resizeState/resizeTopState 폐기
let pollingInterval = null;
// document 레벨 리스너 누적 방지 — 앱 부팅 시 단 1회만 등록
let _docListenersBound = false;
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
  // V6-4: jumpDate가 있다면 한 번 더 적용 (renderSpaces가 navigation 없이 호출되는 경우 대비)
  try {
    const jd = sessionStorage.getItem('jumpDate');
    if (jd && /^\d{4}-\d{2}-\d{2}$/.test(jd)) {
      State.date = jd;
      sessionStorage.removeItem('jumpDate');
    }
  } catch (e) {}

  await loadTimeline();
  startPolling();

  const dateLabel = State.view === 'month'
    ? dayjs(State.date).locale('ko').format('YYYY년 M월')
    : dayjs(State.date).locale('ko').format('YYYY년 M월 D일 (ddd)');

  // V6-2: 툴바를 2단으로 분리 — (1) 날짜 표시 줄  (2) 보기 모드 + 회사 필터 줄
  const toolbar = el('div', { class: 'timeline-toolbar' },
    el('div', { class: 'tt-row tt-row-date' },
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
      )
    ),
    el('div', { class: 'tt-row tt-row-filters' },
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
        // V14: 하드코딩 hex 제거 — .tenant-wylie/.tenant-lush 클래스로 CSS 변수 참조 (실시간 반영)
        el('span', { class: 'legend-chip' }, el('span', { class: 'legend-square tenant-wylie' }), '와일리'),
        el('span', { class: 'legend-chip' }, el('span', { class: 'legend-square tenant-lush'  }), '러쉬코리아'),
      )
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
    attachResizeTopHandlers(); // V10 §7
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
            // V13 §3: 인라인 background 제거 — CSS 변수(--wylie/lush-schedule-color)가 실시간 반영되도록
            // 테넌트 클래스(tenant-wylie/tenant-lush) + data-tenant-id 모두 부여하여 styles.css 매칭 보장
            class: 'month-event tenant-' + (r.tenant_id === 'WYLIE' ? 'wylie' : 'lush'),
            'data-tenant-id': r.tenant_id,
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
  // V6-1 + V7 최종본 §1: spaces 개수에 동적으로 대응하는 그리드 컬럼 정의
  //  - 모든 화면에서 컬럼 최소 너비(min 160px) 강제 → 'Recharging Zone', '와일리빌딩 파라다이스룸' 등
  //    긴 영문/한글 공간명이 줄바꿈 없이 한 줄로 노출되도록 보장
  // V15 §2 — PC 가로 스크롤 영구 제거:
  //  - 데스크톱(>=1024px): 100% Full-Width 비례 분할 (minmax(0, 1fr))
  //                       → 공간 개수가 늘어나도 자동으로 1:1 리밸런싱, 가로 스크롤 발생 X
  //  - 모바일(<1024px):  최소 110px 보장 + 가로 스크롤 유지 (좁은 단말 가독성)
  const spaceCount = State.spaces.length || 1;
  const isNarrow = window.innerWidth < 1024;
  const MOBILE_MIN_COL = 110;
  const colTemplate = isNarrow
    ? `50px repeat(${spaceCount}, minmax(${MOBILE_MIN_COL}px, 1fr))`
    : `56px repeat(${spaceCount}, minmax(0, 1fr))`;       // ← min 0 = 화면에 꽉 차게
  // 모바일만 min-width 강제(가로 스크롤 작동용). 데스크톱은 min-width 자체를 지정하지 않아
  // 부모 컨테이너 너비를 그대로 따라가도록 처리.
  const minWidthAttr = isNarrow
    ? `min-width:${50 + spaceCount * MOBILE_MIN_COL}px;`
    : '';
  const grid = el('div', {
    class: 'timeline-grid',
    id: 'timeline-grid',
    style: `grid-template-columns: ${colTemplate};${minWidthAttr}`,
  });

  // Top-left empty cell
  grid.append(el('div', { class: 'timeline-header-cell', style: 'background:#fff;' }));

  // Headers - spaces
  // [V7 완결본 §2] 모바일에서도 알파벳/마지막 식별자가 가려지지 않도록 공간명을 두 토큰으로 분리
  //   예: "Meeting Room A" → prefix="Meeting Room" + suffix="A"
  //       "Recharging Zone" → prefix="Recharging" + suffix="Zone"
  //       "Lounge" / "5층 회의실" → suffix만 (prefix=null)
  //   영문 표기는 100% 그대로 유지 (한글화 금지)
  const splitSpaceName = (raw) => {
    const name = String(raw || '').trim();
    if (!name) return { prefix: '', suffix: '' };
    const idx = name.lastIndexOf(' ');
    if (idx <= 0) return { prefix: '', suffix: name };
    return { prefix: name.slice(0, idx), suffix: name.slice(idx + 1) };
  };

  for (const s of State.spaces) {
    const { prefix, suffix } = splitSpaceName(s.name);
    grid.append(el('div', { class: 'timeline-header-cell' },
      el('div', { class: 'space-name' },
        el('span', { class: 'space-dot', style: `background:${s.color}; width:8px; height:8px;` }),
        prefix
          ? el('span', { class: 'space-name-text' },
              el('span', { class: 'space-name-prefix' }, prefix),
              el('span', { class: 'space-name-suffix' }, suffix)
            )
          : el('span', { class: 'space-name-text' },
              el('span', { class: 'space-name-suffix' }, suffix)
            )
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
  let [eh, em] = r.end_time.split(':').map(Number);
  // V13 §2-A: '24:00' 같은 잘못된 종료시간 방어 (24:00 → 23:30으로 안전 클램프)
  //   ── 과거 onDragUp 버그로 DB에 들어간 end_time='24:00' 예약이
  //      Math.max로 인해 화면 맨 아래에 거대 블록으로 노출되는 문제 차단
  if (eh >= 24) { eh = 23; em = 30; }
  const startTotal = sh * 60 + sm;
  let endTotal = eh * 60 + em;
  if (endTotal <= startTotal) endTotal = startTotal + 30; // 최소 30분 보장
  const top = startTotal * (40 / 60); // 40px per hour
  const height = Math.max(20, (endTotal - startTotal) * (40 / 60));
  // V13 §NEW: 크로스테넌트 격리 — 본인 소속이 아닌 일정은 상세보기 차단(관리자는 예외)
  const isAdmin = State.user.role === 'admin';
  const isCrossTenant = !isAdmin && r.tenant_id !== State.user.tenant_id;
  const canViewDetail = isAdmin || r.tenant_id === State.user.tenant_id;
  // 크로스테넌트일 경우 리사이즈/드래그도 불가
  const isOwner = !isCrossTenant && (r.user_id === State.user.id || isAdmin);

  // 내 일정 필터에서 강조
  const highlight = State.mineOnly && r.user_id === State.user.id ? ' is-mine' : '';

  const node = el('div', {
    // V11 §3-3: 테넌트 클래스 추가 — CSS 변수(--wylie/lush-schedule-color)를 통한 격리 컬러 적용
    // V13 §3: 인라인 background 제거 — CSS 변수(styles.css :root)가 실시간 반영되도록 권한 양도
    // V13 §NEW: is-cross-tenant 클래스로 시각 신호(투명도/커서) — 클릭은 onclick에서 차단
    class: 'timeline-event' + highlight + ' tenant-' + (r.tenant_id === 'WYLIE' ? 'wylie' : 'lush') + (isCrossTenant ? ' is-cross-tenant' : ''),
    style: `top:${top}px;height:${height}px;` + (isCrossTenant ? 'cursor:not-allowed;' : ''),
    'data-id': r.id,
    'data-tenant-id': r.tenant_id,
    title: isCrossTenant ? '다른 소속의 일정은 상세를 볼 수 없습니다' : undefined,
    // V8: 더블클릭 → 원클릭 단일 트리거. 드래그(빈 셀 새 예약)와는 트리거 영역이 다르므로 충돌 없음.
    // V10 §7: 리사이즈 핸들(상/하단) 클릭은 모달을 열지 않도록 차단
    // V13 §NEW: 크로스테넌트 차단 — 관리자만 모든 일정 컨트롤 가능
    onclick: (e) => {
      if (e.target.closest('.ev-resize-handle') || e.target.closest('.ev-resize-handle-top')) return;
      e.stopPropagation();
      if (!canViewDetail) {
        toast('다른 소속의 일정은 열람할 수 없습니다', 'error');
        return;
      }
      openReservationDetail(r);
    },
  },
    el('div', { class: 'ev-title' }, r.title || '새로운 일정'),
    height > 32 && el('div', { class: 'ev-time' }, `${r.start_time} - ${r.end_time}`),
    el('div', {
      class: 'ev-owner-avatar',
      style: `background:${r.user_avatar_color || '#7a7a7a'};`,
      title: r.user_name
    }, initials(r.user_name)),
    // V10 §7: 상단 리사이즈 핸들 (시작 시간 조정) — 개설자 또는 관리자만
    isOwner && el('div', {
      class: 'ev-resize-handle-top',
      'data-id': r.id,
      title: '드래그하여 시작 시간 조정'
    }),
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
    if (e.target.closest('.ev-resize-handle-top')) return; // V10 §7
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

  // V12 §1: document 리스너는 앱 부팅 시 단 1회만 등록 (renderSpaces 재호출 누적 차단)
  bindGlobalTimelineListeners();
}

// V14: 단일 리스너 등록 — 드래그(빈 셀 → 새 예약)와 리사이즈(블록 가장자리)는 완전 분리된 두 시스템
function bindGlobalTimelineListeners() {
  if (_docListenersBound) return;
  _docListenersBound = true;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragUp);
  // V14 신규: 통합 리사이즈 시스템 (상단/하단 핸들 모두 동일 함수가 처리)
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeUp);
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
  let startMin = Math.round((top / 40) * 60 / 30) * 30;
  let endMin = Math.round((bottom / 40) * 60 / 30) * 30;
  // V13 §2-A: end_time이 절대 24:00이 되지 않도록 23:30(=1410)이 최대 상한
  //   ── minutesToTime(1440) === '24:00' 은 HH:mm 규격 위반 → DB에 들어가면 buildEventEl이 eh=24를 만들어
  //      거대한 보라색 블록이 화면 맨 아래에 노출됨
  const MAX_END_MIN = 23 * 60 + 30; // 1410
  if (endMin > MAX_END_MIN) endMin = MAX_END_MIN;
  if (startMin >= MAX_END_MIN) startMin = MAX_END_MIN - 30;
  if (endMin <= startMin) endMin = startMin + 30;
  dragState = null;
  if (endMin - startMin < 30) return;
  openReservationModal({
    space_id: spaceId,
    start_time: minutesToTime(startMin),
    end_time: minutesToTime(endMin),
  });
}

/* ============================================================================
   ███ V14 — RESIZE 시스템 완전 재작성 (상단/하단 핸들 통합) ███
   ----------------------------------------------------------------------------
   이전 구조 폐기:
     - 별도 상태 변수(resizeState / resizeTopState) → 단일 R 객체로 통합
     - 별도 핸들러(attachResizeHandlers / attachResizeTopHandlers) → 단일 함수
     - 별도 mousemove/up 4개 함수 → 단일 onResizeMove / onResizeUp 2개

   설계 원칙:
     1. 픽셀 ↔ 분 변환은 단 한 곳(MIN_TO_PX / PX_TO_MIN)에서만 수행
     2. R.origStartMin / R.origEndMin 두 정수가 진리원천 (변하지 않음)
     3. mousedown 시 예약의 start_time/end_time을 진리원천으로 픽셀 좌표 재계산
        → 부모 grid padding/scroll 변화에도 좌표 흔들림 0
     4. 충돌 / 23:30 상한 / 최소 30분 길이 / 과거 시각 가드는 한 곳에서 일괄 클램프
   ============================================================================ */

const PX_PER_MIN = 40 / 60;          // 1시간(60분) = 40px → 1분 ≈ 0.6667px
const MIN_TO_PX = (m) => m * PX_PER_MIN;
const PX_TO_MIN = (p) => p / PX_PER_MIN;
const SNAP_MIN = 30;                  // 30분 단위 스냅
const MIN_DURATION = 30;              // 최소 30분 길이
const MAX_END_MIN = 23 * 60 + 30;     // 23:30이 끝점 절대 상한 (24:00 차단)

let R = null;  // V14 통합 리사이즈 상태 (null이면 비활성)

function attachResizeHandlers() {
  const grid = $('#timeline-grid');
  if (!grid) return;

  // 단일 mousedown — 상단(.ev-resize-handle-top)/하단(.ev-resize-handle) 모두 잡아 R.edge로 분기
  grid.addEventListener('mousedown', (e) => {
    const topHandle = e.target.closest('.ev-resize-handle-top');
    const botHandle = e.target.closest('.ev-resize-handle:not(.ev-resize-handle-top)');
    const handle = topHandle || botHandle;
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    // 다른 상태 강제 초기화 (드래그 새 예약 등과 충돌 방지)
    dragState = null;

    const id = Number(handle.dataset.id);
    const r = State.reservations.find(x => x.id === id);
    if (!r) return;
    const eventEl = handle.parentElement;

    // 진리원천: 예약의 start_time/end_time을 분 단위로 변환
    const [sh, sm] = r.start_time.split(':').map(Number);
    const [eh, em] = r.end_time.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    // 같은 공간의 다른 예약들 (충돌 한계 계산용)
    const others = State.reservations
      .filter(x => x.space_id === r.space_id && x.id !== r.id && x.status !== 'cancelled')
      .map(x => {
        const [a, b] = x.start_time.split(':').map(Number);
        const [c, d] = x.end_time.split(':').map(Number);
        return { startMin: a * 60 + b, endMin: c * 60 + d };
      });

    // 상한/하한 결정
    let minStartMin = 0;
    let maxEndMin = MAX_END_MIN;

    if (topHandle) {
      // 상단 드래그: 시작 시간 변경. 이전 예약의 endMin이 하한
      const predecessorEnd = others
        .filter(x => x.endMin <= startMin)
        .reduce((mx, x) => Math.max(mx, x.endMin), 0);
      minStartMin = predecessorEnd;
      // 오늘 날짜면 현재 시각 이후로만 (단, 이미 시작된 일정은 건드리지 않음)
      if (r.date === dayjs().format('YYYY-MM-DD')) {
        const now = dayjs();
        const nowMin = now.hour() * 60 + now.minute();
        if (startMin >= nowMin) minStartMin = Math.max(minStartMin, nowMin);
      }
    } else {
      // 하단 드래그: 종료 시간 변경. 다음 예약의 startMin이 상한
      const successorStart = others
        .filter(x => x.startMin >= endMin)
        .reduce((mn, x) => Math.min(mn, x.startMin), MAX_END_MIN);
      maxEndMin = Math.min(MAX_END_MIN, successorStart);
    }

    R = {
      reservation: r,
      eventEl,
      edge: topHandle ? 'top' : 'bottom',
      startClientY: e.clientY,
      // 진리원천 (변하지 않음)
      origStartMin: startMin,
      origEndMin: endMin,
      // 현재 드래그 진행 중인 분 좌표 (스냅 전 raw)
      curStartMin: startMin,
      curEndMin: endMin,
      // 가드
      minStartMin,
      maxEndMin,
    };
    // 시작 좌표를 진리원천 기준으로 다시 그어놓기 (혹시 흔들렸다면 보정)
    eventEl.style.top = MIN_TO_PX(startMin) + 'px';
    eventEl.style.height = MIN_TO_PX(endMin - startMin) + 'px';
  });

  bindGlobalTimelineListeners();
}

// V14: attachResizeTopHandlers는 통합되었으므로 별칭만 유지 (외부 호출 호환)
function attachResizeTopHandlers() { /* V14: 통합됨 — attachResizeHandlers가 둘 다 처리 */ }

function onResizeMove(e) {
  if (!R) return;
  // dy → 분 단위 변환
  const dyMin = PX_TO_MIN(e.clientY - R.startClientY);

  if (R.edge === 'top') {
    // 상단: 시작 시각 = 원본 + dyMin (양수 dy면 시작이 늦춰짐 = 짧아짐)
    let newStart = R.origStartMin + dyMin;
    if (newStart < R.minStartMin) newStart = R.minStartMin;
    if (newStart > R.origEndMin - MIN_DURATION) newStart = R.origEndMin - MIN_DURATION;
    R.curStartMin = newStart;
    R.curEndMin = R.origEndMin;
  } else {
    // 하단: 종료 시각 = 원본 + dyMin
    let newEnd = R.origEndMin + dyMin;
    if (newEnd > R.maxEndMin) newEnd = R.maxEndMin;
    if (newEnd < R.origStartMin + MIN_DURATION) newEnd = R.origStartMin + MIN_DURATION;
    R.curStartMin = R.origStartMin;
    R.curEndMin = newEnd;
  }

  // DOM 반영 (raw — 스냅 전 부드러운 추적)
  R.eventEl.style.top = MIN_TO_PX(R.curStartMin) + 'px';
  R.eventEl.style.height = MIN_TO_PX(R.curEndMin - R.curStartMin) + 'px';

  // 시간 라벨 갱신 (30분 스냅된 표시 시각)
  const previewStart = Math.round(R.curStartMin / SNAP_MIN) * SNAP_MIN;
  const previewEnd = Math.round(R.curEndMin / SNAP_MIN) * SNAP_MIN;
  const lbl = R.eventEl.querySelector('.ev-time');
  if (lbl) lbl.textContent = `${minutesToTime(previewStart)} - ${minutesToTime(previewEnd)}`;
}

async function onResizeUp(e) {
  if (!R) return;
  const rs = R;
  R = null;

  // 30분 스냅 적용
  let snapStart = Math.round(rs.curStartMin / SNAP_MIN) * SNAP_MIN;
  let snapEnd   = Math.round(rs.curEndMin   / SNAP_MIN) * SNAP_MIN;

  // 가드 최종 적용 (스냅이 가드를 깨뜨릴 수 있음)
  if (rs.edge === 'top') {
    const snappedMinStart = Math.ceil(rs.minStartMin / SNAP_MIN) * SNAP_MIN;
    if (snapStart < snappedMinStart) snapStart = snappedMinStart;
    if (snapStart > rs.origEndMin - MIN_DURATION) snapStart = rs.origEndMin - MIN_DURATION;
    snapEnd = rs.origEndMin;
  } else {
    const snappedMaxEnd = Math.floor(rs.maxEndMin / SNAP_MIN) * SNAP_MIN;
    if (snapEnd > snappedMaxEnd) snapEnd = snappedMaxEnd;
    if (snapEnd < rs.origStartMin + MIN_DURATION) snapEnd = rs.origStartMin + MIN_DURATION;
    snapStart = rs.origStartMin;
  }

  const newStart = minutesToTime(snapStart);
  const newEnd = minutesToTime(snapEnd);

  // 변경 없음 → 원복하고 종료
  if (newStart === rs.reservation.start_time && newEnd === rs.reservation.end_time) {
    rs.eventEl.style.top = MIN_TO_PX(rs.origStartMin) + 'px';
    rs.eventEl.style.height = MIN_TO_PX(rs.origEndMin - rs.origStartMin) + 'px';
    return;
  }

  // PATCH: 변경된 쪽만 보냄
  const body = (rs.edge === 'top') ? { start_time: newStart } : { end_time: newEnd };

  const res = await api(`/api/reservations/${rs.reservation.id}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    toast(res.data?.error || '시간 조정에 실패했습니다.', 'error');
    // 실패 시 원복
    rs.eventEl.style.top = MIN_TO_PX(rs.origStartMin) + 'px';
    rs.eventEl.style.height = MIN_TO_PX(rs.origEndMin - rs.origStartMin) + 'px';
    return;
  }

  toast(
    rs.edge === 'top' ? `시작 시간을 ${newStart}로 변경했습니다.` : `종료 시간을 ${newEnd}로 변경했습니다.`,
    'success'
  );
  await loadTimeline();
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
  // V13 §2-A: HH:mm 규격 보장 — 1440(=24:00) 같은 잘못된 값이 절대 생성되지 않도록 클램프
  //   ── '24:00'은 HH:mm 형식 위반이며 buildEventEl에서 거대 블록을 만드는 근본 원인이었음
  let m = Math.max(0, Math.min(min, 23 * 60 + 30)); // 0 ~ 1410(23:30)
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function drawNowLine() {
  // V39 §2: 실시간 빨간 선 — 호출 시마다 기존 선 제거 후 현재 시각 위치에 재배치
  //         (이전: 한 번 그리고 갱신 안 함 → 11:00 에 고정되는 버그)
  if (State.date !== dayjs().format('YYYY-MM-DD')) return;
  const grid = $('#timeline-grid');
  if (!grid) return;
  // 이전 라인 제거
  $$('.timeline-now-line', grid).forEach(n => n.remove());
  const now = dayjs();
  // 분 단위 정밀: 11:16 이면 11~12 사이 16/60 위치
  const minutesFromMidnight = now.hour() * 60 + now.minute() + (now.second() / 60);
  const top = minutesFromMidnight * (40 / 60);
  const line = el('div', { class: 'timeline-now-line', style: `top:${56 + top}px;` });
  grid.append(line);
}

// V39 §2: now-line 전용 30초 인터벌 — startPolling과 별개로 동작 (페이지 진입 시작)
let nowLineInterval = null;
function startNowLineTicker() {
  if (nowLineInterval) clearInterval(nowLineInterval);
  nowLineInterval = setInterval(() => {
    if (State.page === 'spaces' && State.view === 'day') {
      drawNowLine();
    }
  }, 30 * 1000); // 30초마다 → 분 단위 변동 충분히 캐치
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  // V39 §2: now-line 갱신을 위한 별도 ticker 도 함께 시작
  startNowLineTicker();
  pollingInterval = setInterval(async () => {
    // V39 §4: 홈 페이지에도 실시간 연동 — 예약 변경 시 홈 카드 즉시 리렌더
    if (State.page === 'home') {
      try {
        const upRes = await api('/api/reservations/upcoming');
        const newUpcoming = upRes?.data?.reservations || [];
        const sig = JSON.stringify(newUpcoming.map(r => r.id + ':' + r.updated_at + ':' + r.status));
        if (sig !== State._homeUpcomingSig) {
          State._homeUpcomingSig = sig;
          // 첫 호출이 아닐 때만 재렌더 (초기 마운트 직후 중복 방지)
          if (State._homeUpcomingSigInited) await renderHome();
          State._homeUpcomingSigInited = true;
        }
      } catch (e) {}
      return;
    }
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
        // V39 §2: 예약 변경 시점에도 now-line 위치 재계산 (어차피 새 시점)
        drawNowLine();
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
    // V7 고도화 §2: 참석자 멀티셀렉트
    attendees: [],           // [{id, name, email, avatar_color, department, position}]
    attendeeQuery: '',       // 자동완성 입력 텍스트
    attendeeSuggestions: [], // 드롭다운 후보
    attendeeDropdownOpen: false,
    // V13 §NEW: 회의 목적 — 신규 자유 텍스트 필드
    purpose: '',
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

      /* V13 §NEW: 회의 목적 (자유 텍스트) — 인사이트/엑셀에서 함께 노출됨 */
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '회의 목적'),
        el('textarea', {
          class: 'field-input purpose-textarea',
          id: 'reservation-purpose-input',
          placeholder: '어떤 목적으로 회의하시나요? (예: Q3 OKR 점검 / 디자인 리뷰 / 1:1 면담 등)',
          rows: 3,
          style: 'width:100%;padding:12px 14px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;font-family:inherit;line-height:1.5;resize:vertical;min-height:64px;box-sizing:border-box;',
          oninput: (e) => { modalState.purpose = e.target.value; },
        }, modalState.purpose || '')
      ),

      /* [V7 고도화 §2] 참석자 초대 — 자동완성 + 멀티셀렉트 태그 */
      buildAttendeesSection(),

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

/* ===== [V7 고도화 §2] 참석자 초대 섹션 빌더 ===== */
function buildAttendeesSection() {
  const tagsBox = el('div', { class: 'attendees-tags', id: 'attendees-tags' });
  for (const a of modalState.attendees) {
    tagsBox.append(
      el('span', { class: 'attendee-tag' },
        el('span', { class: 'attendee-tag-dot', style: `background:${a.avatar_color || '#7a7a7a'};` }),
        el('span', { class: 'attendee-tag-name' }, a.name),
        el('button', {
          type: 'button',
          class: 'attendee-tag-remove',
          'aria-label': `${a.name} 제거`,
          onclick: (e) => { e.preventDefault(); removeAttendee(a.id); },
        }, '×')
      )
    );
  }

  const input = el('input', {
    type: 'text',
    class: 'attendee-search-input',
    id: 'attendee-search-input',
    placeholder: modalState.attendees.length === 0
      ? '이름·이메일·부서로 검색해 초대하세요'
      : '추가 검색…',
    value: modalState.attendeeQuery,
    autocomplete: 'off',
    oninput: (e) => onAttendeeQueryInput(e.target.value),
    onfocus: () => openAttendeeDropdown(),
    onkeydown: (e) => {
      if (e.key === 'Escape') closeAttendeeDropdown();
      if (e.key === 'Backspace' && !modalState.attendeeQuery && modalState.attendees.length > 0) {
        // 빈 입력에서 백스페이스 → 마지막 태그 제거
        removeAttendee(modalState.attendees[modalState.attendees.length - 1].id);
      }
    },
  });

  const dropdown = el('div', {
    class: 'attendee-dropdown' + (modalState.attendeeDropdownOpen ? ' is-open' : ''),
    id: 'attendee-dropdown',
  });
  renderAttendeeSuggestionsInto(dropdown);

  return el('div', { class: 'modal-section' },
    el('div', { class: 'modal-section-title' }, '참석자 초대'),
    el('div', { class: 'attendees-field' },
      tagsBox,
      el('div', { class: 'attendee-search-wrap', style: 'position:relative;' },
        input,
        dropdown,
      ),
    ),
  );
}

function renderAttendeeSuggestionsInto(dropdown) {
  dropdown.innerHTML = '';
  const selectedIds = new Set(modalState.attendees.map(a => a.id));
  const list = (modalState.attendeeSuggestions || []).filter(u => !selectedIds.has(u.id));
  if (list.length === 0) {
    dropdown.append(el('div', { class: 'attendee-dropdown-empty' },
      modalState.attendeeQuery ? '검색 결과가 없습니다.' : '초대 가능한 멤버가 없습니다.'));
    return;
  }
  for (const u of list) {
    const meta = [u.department, u.position].filter(Boolean).join(' · ');
    dropdown.append(
      el('button', {
        type: 'button',
        class: 'attendee-dropdown-item',
        onmousedown: (e) => { e.preventDefault(); addAttendee(u); },
      },
        el('span', { class: 'attendee-dd-avatar', style: `background:${u.avatar_color || '#7a7a7a'};` }, initials(u.name)),
        el('div', { class: 'attendee-dd-text' },
          el('div', { class: 'attendee-dd-name' }, u.name),
          el('div', { class: 'attendee-dd-meta' }, meta || u.email),
        ),
      )
    );
  }
}

let attendeeSearchTimer = null;
function onAttendeeQueryInput(q) {
  modalState.attendeeQuery = q;
  modalState.attendeeDropdownOpen = true;
  if (attendeeSearchTimer) clearTimeout(attendeeSearchTimer);
  attendeeSearchTimer = setTimeout(() => fetchAttendeeSuggestions(q), 150);
  // 즉시 드롭다운 표시 갱신
  const dd = $('#attendee-dropdown');
  if (dd) {
    dd.classList.add('is-open');
    renderAttendeeSuggestionsInto(dd);
  }
}

async function fetchAttendeeSuggestions(q) {
  const url = `/api/members/search?q=${encodeURIComponent(q || '')}&limit=20`;
  const res = await api(url);
  if (!res.ok) return;
  modalState.attendeeSuggestions = res.data?.users || [];
  const dd = $('#attendee-dropdown');
  if (dd && modalState.attendeeDropdownOpen) {
    renderAttendeeSuggestionsInto(dd);
  }
}

function openAttendeeDropdown() {
  modalState.attendeeDropdownOpen = true;
  // 처음 포커스 시 빈 검색으로 초기 목록 로딩
  if ((modalState.attendeeSuggestions || []).length === 0) {
    fetchAttendeeSuggestions(modalState.attendeeQuery || '');
  } else {
    const dd = $('#attendee-dropdown');
    if (dd) { dd.classList.add('is-open'); renderAttendeeSuggestionsInto(dd); }
  }
  // 바깥 클릭 시 닫힘
  setTimeout(() => {
    document.addEventListener('mousedown', onceCloseAttendeeDropdown, { once: true });
  }, 0);
}

function onceCloseAttendeeDropdown(e) {
  if (e.target.closest('.attendee-search-wrap') || e.target.closest('.attendee-dropdown')) {
    // 내부 클릭 → 닫지 않고 다시 리스너 등록
    document.addEventListener('mousedown', onceCloseAttendeeDropdown, { once: true });
    return;
  }
  closeAttendeeDropdown();
}

function closeAttendeeDropdown() {
  modalState.attendeeDropdownOpen = false;
  const dd = $('#attendee-dropdown');
  if (dd) dd.classList.remove('is-open');
}

function addAttendee(user) {
  if (modalState.attendees.some(a => a.id === user.id)) return;
  modalState.attendees.push({
    id: user.id, name: user.name, email: user.email,
    avatar_color: user.avatar_color, department: user.department, position: user.position,
  });
  modalState.attendeeQuery = '';
  // 태그 박스만 업데이트하기보다 모달 본체를 다시 그리는 게 안정적
  rerenderAttendeesSection();
  // 입력 포커스 다시 가져가기
  setTimeout(() => $('#attendee-search-input')?.focus(), 0);
}

function removeAttendee(memberId) {
  modalState.attendees = modalState.attendees.filter(a => a.id !== memberId);
  rerenderAttendeesSection();
}

function rerenderAttendeesSection() {
  // 부분 재렌더 — 태그박스 + 드롭다운 영역만 갱신
  const oldField = $('.attendees-field');
  if (!oldField) return;
  const fresh = buildAttendeesSection();
  const newField = fresh.querySelector('.attendees-field');
  oldField.replaceWith(newField);
  // 드롭다운이 열려있으면 다시 렌더
  if (modalState.attendeeDropdownOpen) {
    renderAttendeeSuggestionsInto($('#attendee-dropdown'));
    $('#attendee-dropdown')?.classList.add('is-open');
  }
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
    // V7 고도화 §2: 참석자 다대다 — 백엔드가 PENDING 상태로 reservation_attendees에 bulk insert
    attendee_ids: (modalState.attendees || []).map(a => a.id),
    // V13 §NEW: 회의 목적 — 인사이트/엑셀에서 노출
    purpose: (modalState.purpose || '').trim(),
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
  const invited = res.data.invited || 0;
  toast(
    invited > 0
      ? `예약이 생성되었습니다. (${res.data.created}건 · ${invited}명에게 초대 발송)`
      : `예약이 생성되었습니다. (${res.data.created}건)`,
    'success'
  );
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

async function openReservationDetail(r) {
  const canEdit = State.user.role === 'admin' || State.user.id === r.user_id;
  // V7 고도화 §3a: 상세 API로 attendees + my_invitation_status 동승 가져오기
  let attendees = [];
  let myInvitationStatus = null;
  let myRole = State.user.id === r.user_id ? 'OWNER' : 'NONE';
  // V13 §NEW: detail API에서 purpose 등 최신 풀필드를 다시 가져옴
  let purposeFromServer = r.purpose || '';
  try {
    const detail = await api(`/api/reservations/${r.id}`);
    if (detail.ok) {
      attendees = detail.data?.attendees || [];
      myInvitationStatus = detail.data?.my_invitation_status || null;
      myRole = detail.data?.my_role || myRole;
      if (detail.data?.reservation) {
        purposeFromServer = detail.data.reservation.purpose || '';
      }
    } else if (detail.status === 403) {
      // 크로스테넌트 차단 — 모달 즉시 닫고 안내
      toast(detail.data?.error || '다른 소속의 일정은 조회할 수 없습니다.', 'error');
      return;
    }
  } catch (_) { /* 상세 실패 시 기본값으로 폴백 */ }

  // 편집용 임시 state
  const edit = {
    title: r.title || '',
    start_time: r.start_time,
    end_time: r.end_time,
    date: r.date,
    // V13 §NEW: 회의 목적 — 상세 조회 시 r.purpose 가 내려오면 prefill, 편집 가능
    purpose: purposeFromServer,
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
      /* V13 §NEW: 회의 목적 — 읽기/편집 모두 가능. 빈 값이면 회색 placeholder 안내 */
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '회의 목적'),
        el('textarea', {
          class: 'field-input purpose-textarea',
          placeholder: canEdit ? '어떤 목적으로 회의하시나요? (예: Q3 OKR 점검 / 디자인 리뷰)' : '등록된 회의 목적이 없습니다',
          rows: 3,
          style: 'width:100%;padding:12px 14px;border-radius:11px;border:1px solid #e0e0e0;font-size:14px;font-family:inherit;line-height:1.5;resize:vertical;min-height:64px;box-sizing:border-box;' + (!canEdit ? 'background:#f7f7f7;color:#444;' : ''),
          oninput: (e) => { edit.purpose = e.target.value; },
          disabled: !canEdit ? 'disabled' : null,
        }, edit.purpose || '')
      ),
      /* [V7 고도화 §3a] 예약자(owner) — 단독 섹션, 굵게 강조 */
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' }, '예약자'),
        el('div', { class: 'detail-owner-row' },
          el('div', { class: 'avatar', style: `background:${r.user_avatar_color || '#7a7a7a'};width:32px;height:32px;font-size:12px;` }, initials(r.user_name)),
          el('div', { class: 'detail-owner-text' },
            el('div', { class: 'detail-owner-name' }, r.user_name || '-',
              r.tenant_name ? el('span', { class: 'detail-owner-tenant' }, ' · ', r.tenant_name) : null
            ),
            r.created_by_admin ? el('span', { class: 'tag tag-blue' }, 'Admin') : null
          )
        )
      ),

      /* [V7 고도화 §3a] 참석자(attendees) — 별도 섹션. 수락/대기/거절 배지 노출 */
      el('div', { class: 'modal-section' },
        el('div', { class: 'modal-section-title' },
          '참석자',
          el('span', { class: 'detail-attendees-count' },
            ` (${attendees.length}명${attendees.length > 0
              ? ` · 수락 ${attendees.filter(a => a.status === 'ACCEPTED').length}`
              : ''})`)
        ),
        attendees.length === 0
          ? el('div', { class: 'detail-attendees-empty' }, '초대된 참석자가 없습니다.')
          : el('div', { class: 'detail-attendees-list' },
              ...attendees.map(a =>
                el('div', { class: 'detail-attendee-row' },
                  el('div', { class: 'avatar', style: `background:${a.avatar_color || '#7a7a7a'};width:26px;height:26px;font-size:11px;` }, initials(a.name)),
                  el('div', { class: 'detail-attendee-text' },
                    el('div', { class: 'detail-attendee-name' }, a.name),
                    el('div', { class: 'detail-attendee-meta' },
                      [a.department, a.position].filter(Boolean).join(' · ') || a.email
                    )
                  ),
                  el('span', { class: `attendee-status-badge is-${(a.status || 'PENDING').toLowerCase()}` },
                    a.status === 'ACCEPTED' ? '수락' : a.status === 'DECLINED' ? '거절' : '대기'
                  )
                )
              )
            )
      ),

      /* [V7 고도화 §3a] 본인이 초대받은 경우 — 수락/거절 인라인 안내 */
      (myRole === 'ATTENDEE' && myInvitationStatus === 'PENDING')
        ? el('div', { class: 'modal-section invite-action-banner' },
            el('div', { class: 'invite-action-title' }, '이 일정에 참석 여부를 선택해 주세요'),
            el('div', { class: 'invite-action-buttons' },
              el('button', {
                class: 'btn-primary invite-accept-btn',
                onclick: () => respondInvitation(r.id, 'ACCEPT'),
              }, el('i', { class: 'fa-solid fa-check' }), ' 수락'),
              el('button', {
                class: 'btn-secondary invite-decline-btn',
                onclick: () => respondInvitation(r.id, 'DECLINE'),
              }, el('i', { class: 'fa-solid fa-xmark' }), ' 거절'),
            )
          )
        : (myRole === 'ATTENDEE' && myInvitationStatus)
            ? el('div', { class: 'modal-section invite-status-banner' },
                myInvitationStatus === 'ACCEPTED'
                  ? '이 일정의 참석을 수락하셨습니다.'
                  : '이 일정의 참석을 거절하셨습니다.'
              )
            : null,
    ),
    el('div', { class: 'modal-footer' },
      canEdit ? el('button', { class: 'btn-secondary', style: 'color:#d33;', onclick: () => deleteReservation(r.id, r.recurring_rule_id) }, '예약 취소') : null,
      canEdit ? el('button', { class: 'btn-primary', onclick: () => saveReservationEdit(r.id, edit, r.recurring_rule_id) }, '저장') : el('button', { class: 'btn-primary', onclick: closeModal }, '닫기')
    )
  );
  backdrop.append(modal);
  document.body.append(backdrop);
}

/**
 * V35 §1: 받은 초대 모달 — 홈 '받은 초대' 카드 클릭 시 호출
 *  사용자 보고: 받은 초대 카드 + 받은 초대 응답 대기 카드를 두 개 두면
 *  스크롤이 번거롭다 → 카드는 하나로 통합, 클릭 시 팝업 모달로 표시.
 *  0건이면 호출되지 않음(카드가 비활성화됨).
 */
function closeInviteModal() {
  const m = document.getElementById('invite-modal');
  if (m) m.remove();
  document.removeEventListener('keydown', _inviteEscHandler);
}
function _inviteEscHandler(e) {
  if (e.key === 'Escape') closeInviteModal();
}

function openInviteModal(invitations) {
  if (!invitations || invitations.length === 0) return;
  // 기존 모달이 있으면 제거
  const existing = document.getElementById('invite-modal');
  if (existing) existing.remove();

  const backdrop = el('div', {
    id: 'invite-modal',
    class: 'modal-overlay v35-invite-overlay',
    onclick: (e) => { if (e.target === backdrop) closeInviteModal(); },
  });

  const modal = el('div', { class: 'modal v35-invite-modal' },
    // 헤더
    el('div', { class: 'v35-invite-modal__head' },
      el('div', { class: 'v35-invite-modal__title' },
        el('div', { class: 'v34-card__icon', style: 'background:#FFF4E5;color:#F59E0B;width:32px;height:32px;font-size:14px;' },
          el('i', { class: 'fa-solid fa-envelope-open-text' })
        ),
        el('div', null,
          el('h3', { style: 'margin:0;font-size:18px;font-weight:700;color:#222;' }, `받은 초대 · ${invitations.length}건`),
          el('p', { style: 'margin:2px 0 0;font-size:13px;color:#717171;' }, '응답 대기 중인 초대를 확인하세요')
        )
      ),
      el('button', {
        class: 'v35-invite-modal__close',
        'aria-label': '닫기',
        onclick: closeInviteModal,
      }, el('i', { class: 'fa-solid fa-xmark' }))
    ),
    // 본문 — 초대 리스트 (스크롤 가능)
    el('div', { class: 'v35-invite-modal__body' },
      ...invitations.map(inv =>
        el('div', { class: 'v35-invite-item' },
          el('div', { class: 'v35-invite-item__main' },
            el('div', { class: 'v35-invite-item__title' }, inv.title || '새로운 일정'),
            el('div', { class: 'v35-invite-item__meta' },
              el('span', null,
                el('i', { class: 'fa-regular fa-calendar', style: 'margin-right:6px;color:#717171;' }),
                `${dayjs(inv.date).locale('ko').format('M월 D일 (dd)')} · ${inv.start_time} - ${inv.end_time}`
              )
            ),
            el('div', { class: 'v35-invite-item__meta' },
              el('span', { class: 'v34-next-space' },
                el('span', { class: 'space-dot', style: `background:${inv.space_color || '#7a7a7a'};` }),
                inv.space_name
              )
            ),
            el('div', { class: 'v35-invite-item__owner' },
              el('div', { class: 'avatar', style: `background:${inv.owner_avatar_color || '#7a7a7a'};width:22px;height:22px;font-size:10px;` }, initials(inv.owner_name)),
              el('span', { style: 'font-size:13px;color:#484848;' }, `${inv.owner_name}님이 초대했습니다`)
            )
          ),
          el('div', { class: 'v35-invite-item__actions' },
            el('button', {
              class: 'v35-invite-accept',
              onclick: () => respondInvitationFromModal(inv.id, 'ACCEPT'),
            }, el('i', { class: 'fa-solid fa-check' }), ' 수락'),
            el('button', {
              class: 'v35-invite-decline',
              onclick: () => respondInvitationFromModal(inv.id, 'DECLINE'),
            }, '거절')
          )
        )
      )
    ),
  );

  backdrop.append(modal);
  document.body.append(backdrop);
  document.addEventListener('keydown', _inviteEscHandler);
}

/**
 * V35 §1: 모달 안에서 호출되는 응답 핸들러 — 응답 후 모달 갱신 또는 닫기
 */
async function respondInvitationFromModal(reservationId, action) {
  const res = await api(`/api/reservations/${reservationId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    toast(res.data?.error || '응답 처리에 실패했습니다.', 'error');
    return;
  }
  toast(
    action === 'ACCEPT'
      ? '초대를 수락했습니다. 일정이 캘린더에 반영됩니다.'
      : '초대를 거절했습니다.',
    'success'
  );
  // 모달 닫고 홈 재렌더 → 새 초대 목록 반영 (0건이면 카드 자동 비활성화)
  closeInviteModal();
  try {
    if (State.page === 'home') await renderHome();
    else if (State.page === 'spaces') {
      await loadTimeline();
      renderSpaces();
    }
  } catch (_) {}
}

/**
 * V7 고도화 §3: 초대 응답 처리 — 수락(ACCEPT)/거절(DECLINE)
 *  수락 시 해당 예약이 본인 '앞으로의 일정' 및 공간 타임라인 mine 필터에 즉시 반영됨.
 */
async function respondInvitation(reservationId, action) {
  const res = await api(`/api/reservations/${reservationId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    toast(res.data?.error || '응답 처리에 실패했습니다.', 'error');
    return;
  }
  toast(
    action === 'ACCEPT'
      ? '초대를 수락했습니다. 일정이 캘린더에 반영됩니다.'
      : '초대를 거절했습니다.',
    'success'
  );
  closeModal();
  // 홈/공간 타임라인 둘 다 갱신 — 현재 페이지가 어디든 안전하게
  try {
    if (State.page === 'home') await renderHome();
    else if (State.page === 'spaces') {
      await loadTimeline();
      renderSpaces();
    }
  } catch (_) {}
}

/**
 * V7 통합본 §5: 반복 예약 저장 분기
 *  - 단건 예약(recurring_rule_id 없음): 단건만 저장
 *  - 반복 예약: "이후 모든 반복 일정에 적용할까요?" 확인 → 사용자 선택에 따라 update_scope=single|future
 */
async function saveReservationEdit(id, edit, recurringRuleId) {
  if (edit.start_time >= edit.end_time) {
    toast('시작 시간은 종료 시간보다 빨라야 합니다.', 'error');
    return;
  }

  let updateScope = 'single';
  if (recurringRuleId) {
    const choice = await openRecurringEditScopeModal();
    if (choice === null) return; // 취소
    updateScope = choice; // 'single' | 'future'
  }

  const qs = updateScope === 'future' ? '?update_scope=future' : '';
  const res = await api(`/api/reservations/${id}${qs}`, {
    method: 'PATCH',
    body: JSON.stringify(edit)
  });
  if (!res.ok) {
    toast(res.data?.error || '수정에 실패했습니다.', 'error');
    return;
  }
  toast(updateScope === 'future'
    ? `이후 ${res.data?.updated ?? ''}건의 반복 일정에 일괄 적용되었습니다.`
    : '예약이 수정되었습니다.', 'success');
  closeModal();
  await loadTimeline();
  renderSpaces();
}

/**
 * V7 통합본 §5: 반복 예약 취소/삭제 분기
 *  - 단건 예약: 그대로 단건 취소
 *  - 반복 예약: 3-way 선택 모달 (해당 일정 취소 / 이후 반복 일정 삭제 / 전체 반복 일정 삭제)
 */
async function deleteReservation(id, recurringRuleId) {
  let scope = 'single';
  if (recurringRuleId) {
    const choice = await openRecurringDeleteScopeModal();
    if (choice === null) return;
    scope = choice; // 'single' | 'future' | 'all'
  } else {
    if (!confirm('이 예약을 취소하시겠습니까?')) return;
  }

  const qs = `?scope=${scope}`;
  const res = await api(`/api/reservations/${id}${qs}`, { method: 'DELETE' });
  if (!res.ok) { toast(res.data?.error || '취소 실패', 'error'); return; }
  const msg = scope === 'single'
    ? '예약이 취소되었습니다.'
    : scope === 'future'
      ? `이후 ${res.data?.cancelled ?? ''}건의 반복 일정이 삭제되었습니다.`
      : `반복 일정 전체 ${res.data?.cancelled ?? ''}건이 삭제되었습니다.`;
  toast(msg, 'success');
  closeModal();
  await loadTimeline();
  renderSpaces();
}

/** V7 통합본 §5: 반복 예약 "삭제" 분기 선택 모달 — Promise<'single'|'future'|'all'|null> */
function openRecurringDeleteScopeModal() {
  return new Promise((resolve) => {
    // 기존 상세 모달은 닫지 않고 그 위에 덮어쓰기 — 백드롭 z-index 더 높게
    const backdrop = el('div', {
      class: 'modal-backdrop recurring-scope-backdrop',
      style: 'z-index:10001;',
      onclick: (e) => { if (e.target === backdrop) { close(null); } }
    });
    const close = (v) => { backdrop.remove(); resolve(v); };
    const modal = el('div', { class: 'modal', style: 'max-width:420px;' },
      el('div', { class: 'modal-header' },
        el('div', { class: 'modal-header-title' }, '반복 일정 취소'),
        el('button', { class: 'btn-icon', onclick: () => close(null) }, el('i', { class: 'fa-solid fa-xmark' }))
      ),
      el('div', { class: 'modal-body' },
        el('p', { style: 'margin:0 0 16px;color:#555;font-size:14px;line-height:1.55;' },
          '반복 설정된 예약입니다. 어떻게 처리할까요?'),
        el('div', { class: 'recurring-scope-options' },
          el('button', { class: 'recurring-scope-btn', onclick: () => close('single') },
            el('div', { class: 'rsb-title' }, '해당 일정 취소'),
            el('div', { class: 'rsb-desc' }, '선택한 날짜의 단 한 건만 취소합니다.')
          ),
          el('button', { class: 'recurring-scope-btn', onclick: () => { if (confirm('이후 모든 반복 일정을 삭제하시겠습니까?')) close('future'); } },
            el('div', { class: 'rsb-title' }, '이후 반복 일정 삭제'),
            el('div', { class: 'rsb-desc' }, '선택한 날짜를 포함, 이후 예정된 모든 반복을 일괄 삭제합니다.')
          ),
          el('button', { class: 'recurring-scope-btn is-danger', onclick: () => { if (confirm('과거 일정 포함, 전체 반복 일정을 모두 삭제하시겠습니까? 되돌릴 수 없습니다.')) close('all'); } },
            el('div', { class: 'rsb-title' }, '전체 반복 일정 삭제'),
            el('div', { class: 'rsb-desc' }, '과거·미래를 불문하고 같은 반복 규칙의 모든 일정을 삭제합니다.')
          )
        )
      ),
      el('div', { class: 'modal-footer' },
        el('button', { class: 'btn-secondary', onclick: () => close(null) }, '닫기')
      )
    );
    backdrop.append(modal);
    document.body.append(backdrop);
  });
}

/** V7 통합본 §5: 반복 예약 "수정" 분기 선택 모달 — Promise<'single'|'future'|null> */
function openRecurringEditScopeModal() {
  return new Promise((resolve) => {
    const backdrop = el('div', {
      class: 'modal-backdrop recurring-scope-backdrop',
      style: 'z-index:10001;',
      onclick: (e) => { if (e.target === backdrop) { close(null); } }
    });
    const close = (v) => { backdrop.remove(); resolve(v); };
    const modal = el('div', { class: 'modal', style: 'max-width:420px;' },
      el('div', { class: 'modal-header' },
        el('div', { class: 'modal-header-title' }, '반복 일정 수정'),
        el('button', { class: 'btn-icon', onclick: () => close(null) }, el('i', { class: 'fa-solid fa-xmark' }))
      ),
      el('div', { class: 'modal-body' },
        el('p', { style: 'margin:0 0 16px;color:#555;font-size:14px;line-height:1.55;' },
          '이후 모든 반복 일정에 적용할까요?'),
        el('div', { class: 'recurring-scope-options' },
          el('button', { class: 'recurring-scope-btn', onclick: () => close('single') },
            el('div', { class: 'rsb-title' }, '해당 일정만 수정'),
            el('div', { class: 'rsb-desc' }, '선택한 날짜의 단 한 건만 수정합니다.')
          ),
          el('button', { class: 'recurring-scope-btn', onclick: () => close('future') },
            el('div', { class: 'rsb-title' }, '이후 모든 반복 일정에 적용'),
            el('div', { class: 'rsb-desc' }, '선택한 날짜를 포함, 이후 모든 반복 일정의 시간·장소·제목을 일괄 갱신합니다.')
          )
        )
      ),
      el('div', { class: 'modal-footer' },
        el('button', { class: 'btn-secondary', onclick: () => close(null) }, '취소')
      )
    );
    backdrop.append(modal);
    document.body.append(backdrop);
  });
}

// ============== INSIGHTS ==============
// ============== INSIGHTS (V4: 3-tab + V10 §5: 공간 필터) ==============
const InsightState = {
  tab: 'overview',     // 'overview' | 'history' | 'stats'
  range: '30',         // '7' | '30' | '90' | '180' | '365' | 'custom'
  start: '',
  end: '',
  metric: 'count',     // 'count' | 'time' (통계 탭)
  charts: {},          // Chart 인스턴스 보관
  // V10 §5: 공간 필터 — 빈 배열이면 전체 공간(필터 없음)
  spaceIds: [],
  spacesCache: [],     // 공간 목록 캐시
  lastResponse: null,  // V10 §4-2: 엑셀 내보내기용 마지막 응답 보관
};

/** V10 §5: 쿼리 빌더 (기간 + 공간 필터) */
function rangeQuery() {
  const p = new URLSearchParams();
  p.set('range', InsightState.range);
  if (InsightState.range === 'custom') {
    if (InsightState.start) p.set('start', InsightState.start);
    if (InsightState.end) p.set('end', InsightState.end);
  }
  if (InsightState.spaceIds && InsightState.spaceIds.length > 0) {
    p.set('space_ids', InsightState.spaceIds.join(','));
  }
  return p.toString();
}

/** V10 §5: 공간 필터 드롭다운 — 멀티셀렉트 */
function buildSpaceFilter() {
  const spaces = InsightState.spacesCache || [];
  const selected = InsightState.spaceIds || [];
  const allSelected = selected.length === 0;
  const triggerLabel = allSelected
    ? '전체 공간'
    : selected.length === 1
      ? (spaces.find(s => s.id === selected[0])?.name || '공간')
      : `공간 ${selected.length}개`;

  const panel = el('div', { class: 'space-filter-panel', id: 'spaceFilterPanel' },
    el('div', { class: 'space-filter-actions' },
      el('button', {
        type: 'button',
        onclick: (e) => {
          e.stopPropagation();
          InsightState.spaceIds = [];
          renderInsights();
        },
      }, '전체 선택'),
      el('button', {
        type: 'button',
        onclick: (e) => {
          e.stopPropagation();
          InsightState.spaceIds = spaces.map(s => s.id);
          renderInsights();
        },
      }, '모두 체크'),
    ),
    el('div', { class: 'space-filter-divider' }),
    ...spaces.map(s => {
      const isOn = selected.includes(s.id);
      return el('label', { class: 'space-filter-item' },
        el('input', {
          type: 'checkbox',
          checked: isOn ? 'checked' : null,
          onchange: (e) => {
            e.stopPropagation();
            const cur = new Set(InsightState.spaceIds);
            if (e.target.checked) cur.add(s.id); else cur.delete(s.id);
            InsightState.spaceIds = Array.from(cur);
            renderInsights();
          },
        }),
        el('span', { class: 'sf-dot', style: `background:${s.color || '#999'};` }),
        el('span', { class: 'sf-name' }, s.name),
      );
    }),
  );

  return el('div', { class: 'space-filter-wrap' },
    el('button', {
      type: 'button',
      class: 'space-filter-trigger',
      onclick: (e) => {
        e.stopPropagation();
        const p = document.getElementById('spaceFilterPanel');
        if (!p) return;
        const willOpen = !p.classList.contains('is-open');
        p.classList.toggle('is-open', willOpen);
        if (willOpen) {
          setTimeout(() => {
            const closer = (ev) => {
              if (!ev.target.closest('#spaceFilterPanel') && !ev.target.closest('.space-filter-trigger')) {
                p.classList.remove('is-open');
                document.removeEventListener('click', closer);
              }
            };
            document.addEventListener('click', closer);
          }, 0);
        }
      },
    },
      el('i', { class: 'fa-solid fa-filter', style: 'font-size:11px;' }),
      el('span', null, triggerLabel),
      !allSelected && el('span', { class: 'filter-count' }, String(selected.length)),
      el('i', { class: 'fa-solid fa-chevron-down chev' }),
    ),
    panel
  );
}

/** V10 §4-2: 엑셀(xlsx) 다운로드 */
function exportInsightToExcel() {
  if (typeof XLSX === 'undefined') {
    toast('엑셀 라이브러리 로딩 중입니다. 잠시 후 다시 시도해 주세요.', 'warning');
    return;
  }
  const data = InsightState.lastResponse;
  if (!data) {
    toast('데이터를 먼저 불러와 주세요.', 'warning');
    return;
  }

  const wb = XLSX.utils.book_new();
  const period = `${data.start || ''} ~ ${data.end || ''}`;
  const spaceFilterLabel = (InsightState.spaceIds && InsightState.spaceIds.length > 0)
    ? InsightState.spaceIds
        .map(id => (InsightState.spacesCache.find(s => s.id === id)?.name || `#${id}`))
        .join(', ')
    : '전체 공간';

  // 시트 1: 요약 메타
  const metaRows = [
    ['리포트', '메이트리그라운드 인사이트'],
    ['생성일시', dayjs().format('YYYY-MM-DD HH:mm')],
    ['조회 기간', period],
    ['공간 필터', spaceFilterLabel],
    ['탭', InsightState.tab === 'overview' ? '개요' : InsightState.tab === 'history' ? '내역' : '통계'],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, '리포트 정보');

  if (InsightState.tab === 'overview') {
    const summary = [
      ['평균 회의 진행 시간(분)', data.avg_minutes || 0],
      ['총 예약 건수', data.total || 0],
      ['가동 공간 수', (data.popular_spaces || []).filter(p => p.count > 0).length],
      ['전체 공간 수', (data.popular_spaces || []).length],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, '요약');

    const popular = [['순위', '공간명', '예약 건수'],
      ...(data.popular_spaces || []).map((p, i) => [i + 1, p.name, p.count])];
    const wsPop = XLSX.utils.aoa_to_sheet(popular);
    wsPop['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsPop, '인기 공간');

    // 히트맵 펼치기
    const weekdayNames = ['일','월','화','수','목','금','토'];
    const heatRows = [['요일', ...Array.from({length:24}, (_, h) => `${h}시`)]];
    (data.heatmap || []).forEach((row, wd) => {
      heatRows.push([weekdayNames[wd], ...row]);
    });
    const wsHeat = XLSX.utils.aoa_to_sheet(heatRows);
    XLSX.utils.book_append_sheet(wb, wsHeat, '시간대 히트맵');
  } else if (InsightState.tab === 'history') {
    // V13 §NEW: 회의 목적(purpose) 컬럼 추가 — 상태 앞에 배치
    const header = ['날짜', '시작', '종료', '공간', '제목', '회의 목적', '예약자', '소속', '상태'];
    const rows = (data.history || []).map(r => [
      r.date,
      (r.start_time || '').slice(0,5),
      (r.end_time || '').slice(0,5),
      r.space_name || '',
      r.title || '',
      r.purpose || '',
      r.user_name || '',
      r.tenant_name || '',
      r.status === 'confirmed' ? '확정' : (r.status === 'cancelled' ? '취소' : r.status),
    ]);
    const wsHist = XLSX.utils.aoa_to_sheet([header, ...rows]);
    wsHist['!cols'] = [{wch:12},{wch:7},{wch:7},{wch:20},{wch:30},{wch:36},{wch:14},{wch:14},{wch:8}];
    XLSX.utils.book_append_sheet(wb, wsHist, '예약 내역');
  } else if (InsightState.tab === 'stats') {
    const metricLabel = data.metric === 'time' ? '시간(분)' : '건수';
    // 노쇼
    const noshow = [['상태', metricLabel],
      ['확정', data.noshow?.confirmed || 0],
      ['취소', data.noshow?.cancelled || 0]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(noshow), '노쇼 집계');
    // 요일별
    const wdNames = ['일','월','화','수','목','금','토'];
    const wd = [['요일', metricLabel],
      ...(data.weekday || []).map((v, i) => [wdNames[i], v])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wd), '요일별');
    // 예약 방식
    const mt = [['방식', metricLabel],
      ['일반', data.method?.['일반'] || 0],
      ['관리자', data.method?.['관리자'] || 0],
      ['반복', data.method?.['반복'] || 0]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mt), '예약 방식');
    // 수용 인원별
    const cap = [['수용 인원', metricLabel],
      ...(data.capacity || []).map(r => [r.capacity, r.v])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cap), '수용 인원');
    // 공간별
    const bs = [['공간', metricLabel],
      ...(data.by_space || []).map(r => [r.name, r.v])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bs), '공간별');
  }

  const filename = `mateground_insight_${InsightState.tab}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast(`엑셀 파일이 다운로드되었습니다. (${filename})`, 'success');
}

function destroyCharts() {
  for (const k of Object.keys(InsightState.charts)) {
    try { InsightState.charts[k]?.destroy(); } catch (e) {}
  }
  InsightState.charts = {};
}

async function renderInsights() {
  destroyCharts();

  // V10 §5: 공간 캐시가 비어 있으면 1회 로드
  if (!InsightState.spacesCache || InsightState.spacesCache.length === 0) {
    try {
      const sres = await api('/api/spaces');
      InsightState.spacesCache = sres?.data?.spaces || [];
    } catch (e) { InsightState.spacesCache = []; }
  }

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

    // V10 §4-2 / §5: 인사이트 툴바 — 공간 필터 + 엑셀 다운로드
    el('div', { class: 'insight-toolbar' },
      el('div', { class: 'insight-toolbar-left' },
        buildSpaceFilter()
      ),
      el('div', { class: 'insight-toolbar-right' },
        el('button', {
          type: 'button',
          class: 'insight-excel-btn',
          onclick: exportInsightToExcel,
          title: '현재 화면의 데이터를 엑셀 파일로 다운로드',
        },
          el('i', { class: 'fa-solid fa-file-excel' }),
          el('span', null, '엑셀 다운로드')
        )
      )
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
  InsightState.lastResponse = data; // V10 §4-2 엑셀 다운로드용 캐시
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
    // V31 §2 — [인기 공간] 섹션 완전 삭제. 히트맵이 자연스럽게 위로 올라옴.
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
  InsightState.lastResponse = res?.data || { history: rows }; // V10 §4-2

  body.innerHTML = '';

  const table = el('table', { class: 'admin-table history-table' },
    el('thead', null,
      el('tr', null,
        el('th', null, '날짜'),
        el('th', null, '시간'),
        el('th', null, '공간'),
        el('th', null, '제목'),
        el('th', null, '회의 목적'), // V13 §NEW
        el('th', null, '예약자'),
        el('th', null, '소속'),
        el('th', null, '상태'),
      )
    ),
    el('tbody', null,
      ...(rows.length === 0
        ? [el('tr', null, el('td', { colspan: '8', class: 'org-empty' }, '해당 기간에 예약 내역이 없습니다'))]
        : rows.map(r =>
            el('tr', null,
              el('td', null, r.date),
              el('td', null, `${(r.start_time || '').slice(0, 5)} ~ ${(r.end_time || '').slice(0, 5)}`),
              el('td', null,
                el('span', { class: 'space-chip', style: `background:${r.space_color || '#999'}` }),
                el('span', null, ' ' + (r.space_name || '-'))
              ),
              el('td', null, r.title || '(제목 없음)'),
              // V13 §NEW: 회의 목적 — 길면 잘림(...) 처리, hover 시 전체 표시
              el('td', { class: 'history-purpose-cell', title: r.purpose || '' },
                r.purpose
                  ? (r.purpose.length > 40 ? r.purpose.slice(0, 40) + '…' : r.purpose)
                  : el('span', { style: 'color:#bbb;' }, '-')
              ),
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
  InsightState.lastResponse = stats; // V10 §4-2 엑셀 다운로드용 캐시
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

  // V7 통합본 §1: page-header 는 모바일에서 CSS로 display:none — is-admin-header 플래그
  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header is-admin-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '서비스 기본 설정과 멤버를 관리합니다.')
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('members'),
      el('div', { class: 'admin-content' },
        // V7 통합본 §4: admin-content-header — 모바일 적응형 헤더(클래스 기반)
        el('div', { class: 'admin-content-header' },
          el('div', null,
            el('h2', { style: 'margin:0;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '멤버'),
            el('p', { style: 'margin:4px 0 0;color:#7a7a7a;font-size:14px;' }, '관리자가 직접 직원 계정을 생성하고 정보를 관리합니다.')
          ),
          // V37: 한 줄 정리 — 전체 삭제 / 선택 삭제 / 생성하기 (텍스트 간결화 + nowrap)
          el('div', { class: 'admin-action-row' },
            // 전체 삭제 — 위험 버튼 (admin 본인 빼고 다 날림)
            el('button', {
              class: 'btn-purge-all admin-action-btn',
              id: 'purge-all-btn',
              title: '본인(' + State.user.email + ')을 제외한 같은 회사의 모든 멤버 삭제',
              onclick: purgeAllMembersExceptSelf,
            }, '전체 삭제'),
            // 선택 삭제 — 일반 일괄 삭제
            el('button', {
              class: 'btn-bulk-delete admin-action-btn',
              id: 'bulk-delete-btn',
              disabled: true,
              onclick: bulkDeleteMembers,
            },
              el('span', { id: 'bulk-delete-label' }, '선택 삭제')
            ),
            // 생성하기
            el('button', {
              class: 'btn-primary admin-action-btn admin-action-btn--primary',
              onclick: openMemberCreateModal,
            }, '생성하기')
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
  // V7-2: 모바일에서는 가로 탭 바로 전환되도록 CSS가 처리.
  // V7-4: position: sticky를 CSS에서 모바일 한정 해제.
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
  // V7-3: 데스크톱(테이블) + 모바일(카드) 듀얼 렌더링 — CSS @media로 토글
  const tbody = el('tbody', { id: 'member-tbody' });
  for (const m of members) {
    // V13 §1: admin도 일괄 삭제 가능 (본인만 disabled)
    //   - 사용자 요청: "admin@wylie.co.kr을 제외한 모든 계정 삭제"
    //   - 즉 본인(요청자)만 보호하고, 다른 admin은 체크 가능해야 함
    const isSelf = m.id === State.user.id;

    const tr = el('tr', {
      'data-search': (m.name + ' ' + m.email + ' ' + (m.department || '') + ' ' + (m.position || '')).toLowerCase(),
      'data-member-id': String(m.id),
      'data-role': m.role || 'member',
    },
      // V13 §1: 체크박스 — 본인만 disabled (admin 포함 모두 체크 가능)
      el('td', { class: 'col-bulk-check', style: 'width:40px;text-align:center;' },
        el('input', {
          type: 'checkbox',
          class: 'bulk-member-check',
          'data-id': String(m.id),
          'data-role': m.role || 'member',
          disabled: isSelf ? true : false,
          title: isSelf
            ? '본인 계정은 삭제할 수 없습니다.'
            : (m.role === 'admin' ? '관리자 계정 — 선택 시 함께 삭제됩니다.' : '선택'),
          onchange: updateBulkDeleteState,
        })
      ),
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
  const table = el('table', { class: 'data-table member-table-desktop' },
    el('thead', null,
      el('tr', null,
        // V12 §3: 헤더 전체 선택 체크박스
        el('th', { class: 'col-bulk-check', style: 'width:40px;text-align:center;' },
          el('input', {
            type: 'checkbox',
            id: 'bulk-select-all',
            title: '전체 선택 (관리자 계정 제외)',
            onchange: toggleSelectAllMembers,
          })
        ),
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

  // V7-3 → V37 §4: 모바일 카드 리스트 — 헤더만 노출, 클릭 시에만 상세(부서/직책/상태)와 액션이 펼쳐짐
  //   - 자동으로 모든 카드가 펼쳐져 있던 문제(사용자 표현: "안 누른 팝업창이 떠있다") 해결
  //   - .member-card 클릭 시 .is-expanded 토글, 다른 카드는 자동으로 접힘 (아코디언 한 번에 하나만)
  const cards = el('div', { class: 'member-cards-mobile', id: 'member-cards-mobile' },
    ...members.map(m =>
      el('div', {
        class: 'member-card member-card--collapsible',
        'data-search': (m.name + ' ' + m.email + ' ' + (m.department || '') + ' ' + (m.position || '')).toLowerCase(),
        'data-member-id': String(m.id),
        onclick: (e) => {
          // 내부 버튼 클릭 시에는 토글 막기 (수정/삭제는 액션이 별도)
          if (e.target.closest('.btn-card-action')) return;
          if (e.target.closest('input')) return;
          const card = e.currentTarget;
          const wasOpen = card.classList.contains('is-expanded');
          // 다른 카드 접기
          $$('.member-card--collapsible.is-expanded').forEach(c => c.classList.remove('is-expanded'));
          // 자신 토글
          if (!wasOpen) card.classList.add('is-expanded');
        }
      },
        el('div', { class: 'member-card-head' },
          el('div', { class: 'avatar member-card-avatar', style: `background:${m.avatar_color};width:42px;height:42px;font-size:15px;` }, initials(m.name)),
          el('div', { class: 'member-card-id' },
            el('div', { class: 'member-card-name' }, m.name),
            el('div', { class: 'member-card-email' }, m.email)
          ),
          el('div', { class: 'member-card-badges' },
            el('span', { class: m.role === 'admin' ? 'status-badge s-admin' : 'status-badge s-member' }, m.role === 'admin' ? 'Admin' : '일반'),
            el('i', { class: 'fa-solid fa-chevron-down member-card-chevron', 'aria-hidden': 'true' })
          )
        ),
        // 펼침 영역 — 기본 숨김, .is-expanded 시 노출
        el('div', { class: 'member-card-body' },
          el('div', { class: 'member-card-meta' },
            el('div', { class: 'meta-row' },
              el('span', { class: 'meta-label' }, '부서'),
              el('span', { class: 'meta-value' }, m.department || '-')
            ),
            el('div', { class: 'meta-row' },
              el('span', { class: 'meta-label' }, '직책'),
              el('span', { class: 'meta-value' }, m.position || '-')
            ),
            el('div', { class: 'meta-row' },
              el('span', { class: 'meta-label' }, '상태'),
              el('span', { class: 'meta-value' }, el('span', { class: 'status-badge s-active' }, '활성'))
            )
          ),
          el('div', { class: 'member-card-actions' },
            el('button', { class: 'btn-card-action', onclick: (e) => { e.stopPropagation(); openMemberEditModal(m); } },
              el('i', { class: 'fa-solid fa-pen', style: 'margin-right:6px;font-size:11px;' }),
              '수정'
            ),
            m.id !== State.user.id
              ? el('button', { class: 'btn-card-action is-danger', onclick: (e) => { e.stopPropagation(); deleteMember(m.id); } },
                  el('i', { class: 'fa-solid fa-trash', style: 'margin-right:6px;font-size:11px;' }),
                  '삭제'
                )
              : null
          )
        )
      )
    )
  );

  return el('div', { class: 'member-list-wrap' }, table, cards);
}

function filterMemberTable(q) {
  const ql = q.toLowerCase();
  // V7-3: 데스크톱 테이블 + 모바일 카드 양쪽 필터링
  $$('#member-tbody tr').forEach(tr => {
    const txt = tr.dataset.search || tr.textContent.toLowerCase();
    tr.style.display = txt.includes(ql) ? '' : 'none';
  });
  $$('#member-cards-mobile .member-card').forEach(card => {
    const txt = card.dataset.search || card.textContent.toLowerCase();
    card.style.display = txt.includes(ql) ? '' : 'none';
  });
}

async function deleteMember(id) {
  if (!confirm('이 멤버를 삭제하시겠습니까?')) return;
  const res = await api(`/api/members/${id}`, { method: 'DELETE' });
  if (!res.ok) { toast(res.data?.error || '삭제 실패', 'error'); return; }
  toast('멤버가 삭제되었습니다.', 'success');
  renderAdminMembers();
}

/* =====================================================
   V12 §3: 일반 멤버 일괄 삭제 (어드민 계정 보호 가드 포함)
   ===================================================== */

/** 헤더 [전체 선택] 토글 — admin/본인 row 체크박스는 disabled라 강제로 false 유지 */
function toggleSelectAllMembers(e) {
  const checked = !!e.target.checked;
  $$('.bulk-member-check').forEach(cb => {
    if (cb.disabled) {
      // 관리자/본인 계정 — 어떤 경우에도 체크되지 않음
      cb.checked = false;
      return;
    }
    cb.checked = checked;
  });
  updateBulkDeleteState();
}

/** 선택 상태가 변경될 때마다 호출 — 버튼 활성/카운트 갱신 */
function updateBulkDeleteState() {
  const checks = $$('.bulk-member-check:not(:disabled):checked');
  const count = checks.length;
  const btn = document.getElementById('bulk-delete-btn');
  const label = document.getElementById('bulk-delete-label');
  if (btn) {
    btn.disabled = count === 0;
    btn.classList.toggle('is-active', count > 0);
  }
  if (label) {
    label.textContent = count > 0 ? `선택 삭제 (${count})` : '선택 삭제';
  }
  // 전체 선택 체크박스 상태 동기화
  const all = document.getElementById('bulk-select-all');
  const allEligible = $$('.bulk-member-check:not(:disabled)');
  if (all) {
    all.checked = allEligible.length > 0 && count === allEligible.length;
    all.indeterminate = count > 0 && count < allEligible.length;
  }
}

/** V13 §1: 일괄 삭제 실행 — admin도 체크되어 있으면 삭제 (본인만 보호) */
async function bulkDeleteMembers() {
  const checks = $$('.bulk-member-check:not(:disabled):checked');
  const member_ids = checks
    .map(cb => Number(cb.dataset.id))
    .filter(id => Number.isInteger(id) && id > 0 && id !== State.user.id);

  if (!member_ids.length) {
    toast('삭제할 대상이 없습니다.', 'error');
    return;
  }
  // 선택된 admin 수를 별도 표기
  const adminCount = checks.filter(cb => cb.dataset.role === 'admin').length;
  const warning = adminCount > 0
    ? `\n\n⚠️ 선택 항목에 관리자 ${adminCount}명이 포함되어 있습니다. 함께 삭제됩니다.`
    : '';
  if (!confirm(`선택된 멤버 ${member_ids.length}명을 일괄 삭제합니다.${warning}\n\n계속하시겠습니까?`)) return;

  const res = await api('/api/members/bulk-delete', {
    method: 'POST',
    // V13: exclude_admin=false → admin도 함께 삭제 (사용자가 명시적으로 체크함)
    body: JSON.stringify({ member_ids, exclude_admin: false }),
  });

  if (!res.ok) {
    toast(res.data?.error || '일괄 삭제 실패', 'error');
    return;
  }
  const { deleted = 0, skipped = 0 } = res.data || {};
  const msg = skipped > 0
    ? `${deleted}명을 삭제했습니다. (다른 회사 멤버 등 ${skipped}명 제외)`
    : `${deleted}명을 삭제했습니다.`;
  toast(msg, 'success');
  renderAdminMembers();
}

/** V13 §1: 본인 외 전체 삭제 — 위험 작업, 2단계 confirm */
async function purgeAllMembersExceptSelf() {
  const selfEmail = State.user.email;
  if (!confirm(`⚠️ 위험: 본인(${selfEmail})을 제외한 같은 회사의 모든 멤버를 삭제합니다.\n\n관련된 모든 예약과 세션도 함께 삭제됩니다.\n\n계속하시겠습니까?`)) return;
  if (!confirm(`⚠️ 최종 확인\n\n정말 본인(${selfEmail}) 외 모든 멤버를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

  const res = await api('/api/members/purge-all-except-self', { method: 'POST' });
  if (!res.ok) {
    toast(res.data?.error || '전체 삭제 실패', 'error');
    return;
  }
  const { deleted = 0 } = res.data || {};
  toast(`본인 외 ${deleted}명을 전부 삭제했습니다.`, 'success');
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
    name: '', email: '', department: '', position: '', role: 'member',
    bulkRows: Array.from({ length: 5 }, () => ({ name: '', email: '', department: '', position: '' })),
    bulkSource: '',  // V6-3: 업로드한 파일명 표시
  };

  const render = () => {
    closeModal();
    // V7 최종본 §3: 백드랍 클릭 시 닫힘 방지 — 실수로 작성 데이터 유실 방지
    // X 버튼이나 [취소] 버튼만 닫기 트리거
    const backdrop = el('div', {
      class: 'modal-backdrop',
      id: 'reservation-modal',
      // onclick 핸들러를 의도적으로 등록하지 않음 (백드랍 click no-op)
    });
    const modal = el('div', { class: 'modal', style: 'max-width:560px;' },
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

  // V7 최종본 §3: 폼 재구성
  //   ① 이름 (전체 너비) → ② 이메일 (전체 너비, 로그인 ID 겸용)
  //   → ③ 부서/직책 한 줄 50:50 → ④ 권한 (전체 너비)
  //   [로그인 정보 섹션] 및 [비밀번호 입력란] 전면 삭제
  //   초기 비밀번호는 백엔드에서 user1234 자동 할당 (§3 명세)
  const renderSingle = () => el('div', null,
    el('div', { class: 'modal-section' },
      el('div', { class: 'modal-section-title' }, '기본 정보'),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px;' },
        // ① 이름
        el('input', { placeholder: '이름 *', value: state.name, oninput: e => state.name = e.target.value, style: inputStyle() }),
        // ② 이메일 (로그인 계정 ID 겸용)
        el('input', { type: 'email', placeholder: '이메일 주소 * (로그인 ID 겸용)', value: state.email, oninput: e => state.email = e.target.value, style: inputStyle() }),
        // ③ 부서 / 직책 — 한 줄 50:50
        el('div', { class: 'form-row-2col', style: 'display:flex;gap:8px;' },
          el('div', { style: 'flex:1 1 50%;min-width:0;' }, deptSelect(state.department, v => state.department = v)),
          el('div', { style: 'flex:1 1 50%;min-width:0;' }, posSelect(state.position, v => state.position = v))
        ),
        // ④ 권한 설정
        el('select', { style: inputStyle(), onchange: e => state.role = e.target.value },
          el('option', { value: 'member', selected: state.role === 'member' ? 'selected' : null }, '일반 멤버'),
          el('option', { value: 'admin', selected: state.role === 'admin' ? 'selected' : null }, '관리자(Admin)')
        )
      )
    ),
    // 안내: 초기 비밀번호 자동 할당
    el('div', { style: 'margin-top:-8px;padding:10px 12px;background:#f5f7fa;border-radius:10px;font-size:12px;color:#555;line-height:1.5;' },
      el('i', { class: 'fa-solid fa-circle-info', style: 'margin-right:6px;color:#0066cc;' }),
      '신규 계정의 초기 비밀번호는 ',
      el('strong', { style: 'color:#0066cc;font-weight:700;' }, 'user1234'),
      ' 로 자동 설정됩니다. 멤버는 최초 로그인 시 변경하게 됩니다.'
    )
  );

  // V6-3: 엑셀/CSV 파일을 파싱해 state.bulkRows에 자동 매핑
  const COLUMN_ALIASES = {
    name: ['이름', '성명', '사용자명', 'name', 'Name', 'NAME', '사용자 이름', '담당자', '담당자명'],
    email: ['이메일', '이메일주소', '메일', 'email', 'Email', 'EMAIL', 'e-mail', 'E-mail', '계정', '아이디'],
    department: ['부서', '소속', '팀', '본부', 'department', 'Department', 'DEPT', 'dept', '소속부서'],
    position: ['직책', '직급', '직위', '포지션', 'position', 'Position', 'POSITION', 'title', 'Title'],
  };
  const resolveColumn = (rowKeys, aliases) => {
    for (const alias of aliases) {
      const found = rowKeys.find(k => String(k).trim().toLowerCase() === String(alias).trim().toLowerCase());
      if (found) return found;
    }
    return null;
  };

  const parseAndFill = async (file) => {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      toast('파일 파서를 로드하지 못했습니다. 페이지 새로고침 후 다시 시도해 주세요.', 'error');
      return;
    }
    const ext = (file.name || '').toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast('지원하지 않는 형식입니다 (.xlsx / .xls / .csv 만 가능).', 'error');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!rows.length) { toast('파일에서 데이터를 찾을 수 없습니다.', 'error'); return; }

      const firstKeys = Object.keys(rows[0]);
      const nameKey = resolveColumn(firstKeys, COLUMN_ALIASES.name);
      const emailKey = resolveColumn(firstKeys, COLUMN_ALIASES.email);
      const deptKey = resolveColumn(firstKeys, COLUMN_ALIASES.department);
      const posKey = resolveColumn(firstKeys, COLUMN_ALIASES.position);

      if (!nameKey && !emailKey) {
        toast(`컬럼명을 인식하지 못했습니다. 헤더는 [이름, 이메일, 부서, 직책] 이어야 합니다. (감지된 컬럼: ${firstKeys.join(', ')})`, 'error');
        return;
      }

      const mapped = rows.map(r => ({
        name: nameKey ? String(r[nameKey] || '').trim() : '',
        email: emailKey ? String(r[emailKey] || '').trim() : '',
        department: deptKey ? String(r[deptKey] || '').trim() : '',
        position: posKey ? String(r[posKey] || '').trim() : '',
      })).filter(r => r.name || r.email);

      if (mapped.length === 0) { toast('유효한 행이 없습니다.', 'error'); return; }

      // 기존 빈 행 제거 후 교체
      state.bulkRows = mapped;
      state.bulkSource = `${file.name} · ${mapped.length}행 파싱됨`;
      toast(`${mapped.length}명을 폼에 자동 기입했습니다. 검토 후 [생성하기]를 눌러주세요.`, 'success');
      render();
    } catch (err) {
      console.error('[bulk parse]', err);
      toast('파일을 파싱하지 못했습니다: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  };

  const renderBulk = () => {
    const fileInputId = 'bulk-file-input-' + Math.random().toString(36).slice(2, 8);

    // V6-3: 드래그앤드롭 영역
    const dropZone = el('div', {
      class: 'bulk-dropzone',
      ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('is-drag'); },
      ondragleave: (e) => { e.currentTarget.classList.remove('is-drag'); },
      ondrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('is-drag');
        const f = e.dataTransfer.files?.[0];
        if (f) parseAndFill(f);
      },
      onclick: () => $(`#${fileInputId}`)?.click(),
    },
      el('i', { class: 'fa-solid fa-file-arrow-up', style: 'font-size:28px;color:#0066cc;margin-bottom:8px;' }),
      el('div', { class: 'bulk-dropzone-title' }, '엑셀(.xlsx) · CSV(.csv) 파일을 드래그하거나 클릭해서 업로드'),
      el('div', { class: 'bulk-dropzone-sub' }, '헤더: 이름 · 이메일 · 부서 · 직책 (자동 매핑)'),
      state.bulkSource ? el('div', { class: 'bulk-dropzone-source' }, el('i', { class: 'fa-solid fa-circle-check', style: 'color:#0a8a0a;margin-right:6px;' }), state.bulkSource) : null,
      el('input', {
        type: 'file',
        id: fileInputId,
        accept: '.xlsx,.xls,.csv',
        style: 'display:none;',
        onchange: (e) => { const f = e.target.files?.[0]; if (f) parseAndFill(f); }
      })
    );

    return el('div', null,
      dropZone,
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin:12px 0;' },
        el('div', { style: 'font-size:14px;color:#7a7a7a;' }, `현재 ${state.bulkRows.length}행 · 초기 패스워드 user1234`),
        el('div', { style: 'display:flex;gap:8px;' },
          el('button', { class: 'btn-ghost', onclick: () => { state.bulkRows.push(...Array.from({ length: 5 }, () => ({ name: '', email: '', department: '', position: '' }))); render(); } }, '+ 5명 더'),
          el('button', { class: 'btn-ghost', onclick: () => { state.bulkRows = Array.from({ length: 5 }, () => ({ name: '', email: '', department: '', position: '' })); state.bulkSource = ''; render(); } }, '초기화')
        )
      ),
      el('div', { style: 'overflow:auto;max-height:300px;border:1px solid #e0e0e0;border-radius:11px;' },
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
                  ...OrgCache.departments.map(d => el('option', { value: d.name, selected: row.department === d.name ? 'selected' : null }, d.name)),
                  // 엑셀에서 들어온 부서가 마스터에 없으면 그대로 보존
                  row.department && !OrgCache.departments.some(d => d.name === row.department)
                    ? el('option', { value: row.department, selected: 'selected' }, row.department + ' (미등록)') : null
                )),
                el('td', null, el('select', { style: 'width:100%;border:none;background:transparent;outline:none;font-size:13px;', onchange: e => state.bulkRows[i].position = e.target.value },
                  el('option', { value: '' }, '—'),
                  ...OrgCache.positions.map(p => el('option', { value: p.name, selected: row.position === p.name ? 'selected' : null }, p.name)),
                  row.position && !OrgCache.positions.some(p => p.name === row.position)
                    ? el('option', { value: row.position, selected: 'selected' }, row.position + ' (미등록)') : null
                ))
              )
            )
          )
        )
      )
    );
  };

  const submit = async () => {
    if (mode === 'single') {
      if (!state.name || !state.email) { toast('이름과 이메일은 필수입니다.', 'error'); return; }
      // V7 최종본 §3: 초기 비밀번호는 백엔드에서 user1234 로 자동 할당
      const payload = {
        name: state.name, email: state.email,
        department: state.department || null, position: state.position || null,
        role: state.role,
      };
      const res = await api('/api/members', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) { toast(res.data?.error || '생성 실패', 'error'); return; }
      toast('멤버 계정이 생성되었습니다. (초기 비밀번호: user1234)', 'success');
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
  // V11 §3: 회사정보/디바이스 카드 소거. 멤버/공간 + 일정/공간 팔레트만 표시.
  const [membersRes, spacesRes, tenantsRes] = await Promise.all([
    api('/api/members'),
    api('/api/spaces'),
    api('/api/tenants'), // V11 §3-3: 테넌트별 일정 색상 조회
  ]);
  const memberCount = (membersRes?.data?.members || []).length;
  const spaceCount = (spacesRes?.data?.spaces || []).length;
  const spaces = spacesRes?.data?.spaces || [];
  const tenants = tenantsRes?.data?.tenants || [];

  // V11 §3-3: CSS 변수에 즉시 적용 (다른 페이지 이동 시 일정 블록 색 즉시 반영)
  applyTenantColorVars(tenants);

  const main = el('main', { class: 'page-wrap' },
    el('div', { class: 'page-header is-admin-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '서비스 기본 환경과 색상 팔레트를 설정합니다.')
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('general'),
      el('div', { class: 'admin-content' },
        el('h2', { style: 'margin:0 0 24px;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '일반'),

        // V11 §3-2: 멤버/공간 2분할 그리드 (디바이스 카드 영구 삭제)
        el('div', { class: 'summary-card-grid-container' },
          el('div', { class: 'summary-card summary-card-item' },
            el('div', { class: 'summary-card-icon' }, el('i', { class: 'fa-solid fa-users' })),
            el('div', { class: 'summary-card-text' },
              el('div', { class: 'label card-title' }, '멤버'),
              el('div', { class: 'value card-value' }, `${memberCount}명`)
            )
          ),
          el('div', { class: 'summary-card summary-card-item' },
            el('div', { class: 'summary-card-icon' }, el('i', { class: 'fa-solid fa-cube' })),
            el('div', { class: 'summary-card-text' },
              el('div', { class: 'label card-title' }, '공간'),
              el('div', { class: 'value card-value' }, `${spaceCount}개`)
            )
          ),
        ),

        // V11 §3-1: 회사정보 카드 완전 소거 — 이 위치에 있던 마크업은 영구 삭제

        // V11 §3-3: 팔레트 관리 래퍼 — 일정 팔레트(상단) + 공간 팔레트(하단)
        el('div', { class: 'palette-management-wrapper' },
          buildSchedulePaletteCard(tenants), // V11 §3-3: 테넌트별 일정 컬러 팔레트 (신규)
          buildColorPaletteCard(spaces)        // V10 §6: 공간 색상 팔레트 (유지)
        )
      )
    )
  );

  renderShell(main);
}

/* ============================================================================
   ███ V14 — 테넌트 컬러 시스템 완전 재작성 ███
   ----------------------------------------------------------------------------
   1. applyTenantColors(tenants)  → 단일 진입점. 어디서 호출되든 동일 동작.
       - DB의 schedule_color 두 값을 :root CSS 변수(--tenant-wylie/--tenant-lush)에 주입
       - 별도 <style id="__tenant_colors__">에도 강제 규칙 inject (인라인 background 잔재까지 덮음)
       - 모든 .tenant-color-dot / 범례 점 / 인라인 background까지 즉시 반영
   2. buildSchedulePaletteCard(tenants) → 어드민 설정 카드
       - 색상 선택 즉시 applyTenantColors() 호출 + DB PATCH + 타임라인/공간 페이지 강제 리렌더
   3. State.tenants에 캐시 보관 (어디서든 동기 접근 가능)
   ============================================================================ */

const TENANT_DEFAULTS = {
  WYLIE: { id: 'WYLIE', name: '와일리',     schedule_color: '#703b96' }, // 보라
  LUSH:  { id: 'LUSH',  name: '러쉬코리아', schedule_color: '#d81b60' }, // 진핑크
};

/**
 * V14: 단일 진입점 — DB의 tenants 배열을 받아 화면 전체에 컬러 즉시 반영.
 * @param {Array<{id:string, schedule_color:string}>} tenants
 */
function applyTenantColors(tenants) {
  const w = (tenants || []).find(t => t.id === 'WYLIE') || TENANT_DEFAULTS.WYLIE;
  const l = (tenants || []).find(t => t.id === 'LUSH')  || TENANT_DEFAULTS.LUSH;
  const wColor = w.schedule_color || TENANT_DEFAULTS.WYLIE.schedule_color;
  const lColor = l.schedule_color || TENANT_DEFAULTS.LUSH.schedule_color;

  // (a) :root CSS 변수 주입 — 새 이름 + 옛 이름 둘 다 (호환)
  const root = document.documentElement;
  root.style.setProperty('--tenant-wylie', wColor);
  root.style.setProperty('--tenant-lush',  lColor);
  root.style.setProperty('--wylie-schedule-color', wColor);
  root.style.setProperty('--lush-korea-schedule-color', lColor);

  // (b) 동적 <style> 강제 inject — legacy 인라인 background 잔재까지 덮어쓰는 최종 방어선
  let st = document.getElementById('__tenant_colors__');
  if (!st) {
    st = document.createElement('style');
    st.id = '__tenant_colors__';
    document.head.appendChild(st);
  }
  st.textContent = `
    .timeline-event[data-tenant-id="WYLIE"],
    .timeline-event.tenant-wylie,
    .month-event.tenant-wylie,
    .reservation-block.tenant-wylie {
      background-color: ${wColor} !important;
    }
    .timeline-event[data-tenant-id="LUSH"],
    .timeline-event.tenant-lush,
    .month-event.tenant-lush,
    .reservation-block.tenant-lush {
      background-color: ${lColor} !important;
    }
    .legend-square.tenant-wylie, .legend-dot.tenant-wylie, .tenant-color-dot.tenant-wylie { background-color: ${wColor} !important; }
    .legend-square.tenant-lush,  .legend-dot.tenant-lush,  .tenant-color-dot.tenant-lush  { background-color: ${lColor} !important; }
  `;

  // (c) State 캐시 갱신
  State.tenants = [
    { ...TENANT_DEFAULTS.WYLIE, ...w, schedule_color: wColor },
    { ...TENANT_DEFAULTS.LUSH,  ...l, schedule_color: lColor },
  ];
}

// V13 호환 alias — 기존 코드가 옛 이름으로 호출해도 동일하게 동작
function applyTenantColorVars(tenants) { return applyTenantColors(tenants); }

/**
 * V14: 어드민 설정 — 테넌트 일정 색상 팔레트 카드.
 * 색상 변경 시 (1) DB PATCH (2) applyTenantColors() (3) 활성 페이지 강제 리렌더
 */
function buildSchedulePaletteCard(tenants) {
  const wylie = tenants.find(t => t.id === 'WYLIE') || TENANT_DEFAULTS.WYLIE;
  const lush  = tenants.find(t => t.id === 'LUSH')  || TENANT_DEFAULTS.LUSH;

  /**
   * 공통 핸들러: id ∈ {'WYLIE','LUSH'}, color = '#rrggbb'
   *   1) hex 라벨 즉시 갱신
   *   2) applyTenantColors() — 화면 전체 CSS 변수 + 동적 <style> 즉시 갱신
   *   3) DB PATCH (실패 시 토스트로 알림, 다음 새로고침 때 원복)
   *   4) 현재 활성 페이지가 'spaces'(공간 타임라인)면 타임라인 이벤트만 빠르게 리렌더
   */
  const onChange = async (id, color) => {
    const hexId = id === 'WYLIE' ? 'wylieTenantColorHex' : 'lushTenantColorHex';
    const lbl = document.getElementById(hexId);
    if (lbl) lbl.textContent = color;

    // 옵티미스틱 업데이트: 캐시 즉시 수정 후 화면 반영
    const cached = (State.tenants || []).map(t =>
      t.id === id ? { ...t, schedule_color: color } : t
    );
    if (!cached.find(t => t.id === id)) {
      cached.push({ id, schedule_color: color });
    }
    applyTenantColors(cached);

    // 타임라인이 떠 있다면 이벤트 블록 즉시 다시 그림 (CSS 변수만으로 안 잡히는 잔재 컬러 잡기)
    if (State.page === 'spaces' && typeof refreshTimelineEvents === 'function') {
      refreshTimelineEvents();
    }

    const r = await api(`/api/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ schedule_color: color }),
    });
    if (!r.ok) {
      toast(`${id === 'WYLIE' ? '와일리' : '러쉬코리아'} 색상 저장에 실패했습니다.`, 'error');
    } else {
      toast(`${id === 'WYLIE' ? '와일리' : '러쉬코리아'} 일정 색상을 ${color}로 변경했습니다.`, 'success');
    }
  };

  return el('div', { class: 'setting-section-box schedule-palette-box' },
    el('h3', null,
      el('i', { class: 'fa-solid fa-palette', style: 'margin-right:8px;color:var(--tenant-wylie);' }),
      '일정 컬러 팔레트'
    ),
    el('p', { class: 'section-desc' },
      '각 회사별 독립된 팔레트입니다. 변경 시 화면 전체(타임라인 / 공간 페이지 / 범례 점)에 실시간 반영됩니다.'
    ),
    el('div', { class: 'picker-row' },
      // 와일리 (WYLIE) 셀
      el('div', { class: 'picker-cell' },
        el('label', { for: 'wylieTenantColorPicker' }, '와일리 (WYLIE) 일정 색상'),
        el('input', {
          type: 'color',
          id: 'wylieTenantColorPicker',
          class: 'tenant-color-picker',
          value: wylie.schedule_color || TENANT_DEFAULTS.WYLIE.schedule_color,
          'data-tenant': 'WYLIE',
          // input 이벤트 = 드래그 중에도 실시간 미리보기, change 이벤트 = 확정 시 DB 저장
          oninput: (e) => {
            // 미리보기만 (DB 호출 X)
            applyTenantColors((State.tenants || []).map(t =>
              t.id === 'WYLIE' ? { ...t, schedule_color: e.target.value } : t
            ));
            const lbl = document.getElementById('wylieTenantColorHex');
            if (lbl) lbl.textContent = e.target.value;
          },
          onchange: (e) => onChange('WYLIE', e.target.value),
        }),
        el('div', { id: 'wylieTenantColorHex', class: 'tenant-color-hex' }, wylie.schedule_color || TENANT_DEFAULTS.WYLIE.schedule_color)
      ),
      // 러쉬코리아 (LUSH) 셀
      el('div', { class: 'picker-cell' },
        el('label', { for: 'lushTenantColorPicker' }, '러쉬코리아 (LUSH) 일정 색상'),
        el('input', {
          type: 'color',
          id: 'lushTenantColorPicker',
          class: 'tenant-color-picker',
          value: lush.schedule_color || TENANT_DEFAULTS.LUSH.schedule_color,
          'data-tenant': 'LUSH',
          oninput: (e) => {
            applyTenantColors((State.tenants || []).map(t =>
              t.id === 'LUSH' ? { ...t, schedule_color: e.target.value } : t
            ));
            const lbl = document.getElementById('lushTenantColorHex');
            if (lbl) lbl.textContent = e.target.value;
          },
          onchange: (e) => onChange('LUSH', e.target.value),
        }),
        el('div', { id: 'lushTenantColorHex', class: 'tenant-color-hex' }, lush.schedule_color || TENANT_DEFAULTS.LUSH.schedule_color)
      ),
    )
  );
}

/** V10 §6: 색상 팔레트 카드 — 공간별 색상을 동시에 편집 → DB 저장 → 캘린더 실시간 재렌더 */
function buildColorPaletteCard(spaces) {
  // 임시 변경 상태 (저장 전까지 보관)
  const draft = {};
  spaces.forEach(s => { draft[s.id] = s.color; });

  // 프리셋 팔레트 (Deep Sapphire 계열 + 보조)
  const presets = [
    '#0f2647', '#0066cc', '#2563eb', '#1e88e5', '#0288d1',
    '#00838f', '#00897b', '#43a047', '#7cb342', '#fdd835',
    '#fb8c00', '#e53935', '#d81b60', '#8e24aa', '#5e35b1',
    '#3949ab', '#546e7a', '#6d4c41', '#424242', '#0066cc',
  ];

  const card = el('div', {
    class: 'color-palette-card',
    style: 'margin-top:24px;background:#fafafc;padding:24px;border-radius:11px;'
  },
    el('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;'
    },
      el('div', null,
        el('h3', { style: 'margin:0;font-size:17px;font-weight:600;' },
          el('i', { class: 'fa-solid fa-palette', style: 'margin-right:8px;color:#0066cc;' }),
          '공간 색상 팔레트'
        ),
        el('p', { style: 'margin:6px 0 0;color:#7a7a7a;font-size:13px;' },
          '공간별 색상을 변경하면 캘린더의 모든 예약 블록에 즉시 반영됩니다.'
        )
      ),
      el('div', { style: 'display:flex;gap:8px;' },
        el('button', {
          type: 'button',
          class: 'btn-secondary color-palette-reset',
          onclick: () => {
            // 원래 색으로 되돌리기
            spaces.forEach(s => {
              draft[s.id] = s.color;
              const picker = document.getElementById(`color-input-${s.id}`);
              const preview = document.getElementById(`color-preview-${s.id}`);
              const text = document.getElementById(`color-text-${s.id}`);
              if (picker) picker.value = s.color;
              if (preview) preview.style.background = s.color;
              if (text) text.textContent = s.color;
            });
            toast('변경사항을 되돌렸습니다.', 'info');
          },
        },
          el('i', { class: 'fa-solid fa-rotate-left', style: 'margin-right:6px;' }), '되돌리기'
        ),
        el('button', {
          type: 'button',
          class: 'btn-primary color-palette-apply',
          onclick: async () => {
            // 변경된 공간만 PATCH
            const changed = spaces.filter(s => draft[s.id] !== s.color);
            if (changed.length === 0) {
              toast('변경된 색상이 없습니다.', 'info');
              return;
            }
            try {
              await Promise.all(changed.map(s =>
                api(`/api/spaces/${s.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ color: draft[s.id] }),
                })
              ));
              toast(`${changed.length}개 공간의 색상이 저장되었습니다.`, 'success');
              // 캘린더가 다음 진입 시 새 색상으로 갱신되도록 어드민 일반 탭 재렌더
              await renderAdminGeneral();
            } catch (err) {
              toast('색상 저장 중 오류가 발생했습니다: ' + (err?.message || err), 'error');
            }
          },
        },
          el('i', { class: 'fa-solid fa-check', style: 'margin-right:6px;' }), '저장'
        ),
      )
    ),
    // 프리셋 스와치
    el('div', { style: 'margin-bottom:16px;' },
      el('div', { style: 'font-size:12px;color:#7a7a7a;margin-bottom:8px;' }, '프리셋 색상 (클릭하면 마지막 선택 공간에 적용)'),
      el('div', { class: 'color-preset-row', style: 'display:flex;flex-wrap:wrap;gap:6px;' },
        ...presets.map(c =>
          el('button', {
            type: 'button',
            class: 'color-swatch',
            'data-color': c,
            title: c,
            style: `width:24px;height:24px;border-radius:6px;background:${c};border:1px solid rgba(0,0,0,0.08);cursor:pointer;padding:0;`,
            onclick: () => {
              const focused = window.__paletteFocusedSpaceId;
              if (!focused) {
                toast('먼저 적용할 공간을 클릭해 주세요.', 'info');
                return;
              }
              draft[focused] = c;
              const picker = document.getElementById(`color-input-${focused}`);
              const preview = document.getElementById(`color-preview-${focused}`);
              const text = document.getElementById(`color-text-${focused}`);
              if (picker) picker.value = c;
              if (preview) preview.style.background = c;
              if (text) text.textContent = c;
            },
          })
        )
      )
    ),
    // 공간별 컬러피커 목록
    el('div', { class: 'color-palette-list', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;' },
      ...spaces.map(s =>
        el('div', {
          class: 'color-palette-item',
          'data-space-id': s.id,
          onclick: () => { window.__paletteFocusedSpaceId = s.id; },
          style: 'display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border-radius:9px;border:1px solid #ebebeb;cursor:pointer;',
        },
          el('div', {
            id: `color-preview-${s.id}`,
            class: 'color-palette-preview',
            style: `width:40px;height:40px;border-radius:8px;background:${s.color};flex-shrink:0;border:1px solid rgba(0,0,0,0.05);`,
          }),
          el('div', { style: 'flex:1;min-width:0;' },
            el('div', { style: 'font-size:14px;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, s.name),
            el('div', {
              id: `color-text-${s.id}`,
              style: 'font-size:12px;color:#7a7a7a;font-family:monospace;margin-top:2px;'
            }, s.color)
          ),
          el('input', {
            type: 'color',
            id: `color-input-${s.id}`,
            class: 'color-picker-input',
            value: s.color,
            onclick: (e) => { e.stopPropagation(); window.__paletteFocusedSpaceId = s.id; },
            oninput: (e) => {
              draft[s.id] = e.target.value;
              const preview = document.getElementById(`color-preview-${s.id}`);
              const text = document.getElementById(`color-text-${s.id}`);
              if (preview) preview.style.background = e.target.value;
              if (text) text.textContent = e.target.value;
            },
            style: 'width:40px;height:40px;border:none;border-radius:8px;cursor:pointer;background:transparent;padding:0;',
          })
        )
      )
    )
  );

  return card;
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
    el('div', { class: 'page-header is-admin-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '공간 자원을 추가·수정·삭제합니다. 변경 사항은 타임라인에 즉시 반영됩니다.')
        // V7 통합본 §1: 부모 div.page-header 에 is-admin-header 클래스 적용됨
      )
    ),
    el('div', { class: 'admin-layout' },
      buildAdminSidebar('spaces'),
      el('div', { class: 'admin-content' },
        // V7 통합본 §4: 헤더 액션바 — 버튼은 nowrap + 모바일 패딩 축소 CSS 클래스 적용
        el('div', { class: 'admin-content-header' },
          el('div', null,
            el('h2', { style: 'margin:0;font-size:24px;font-weight:600;letter-spacing:-0.3px;' }, '공간'),
            el('p', { style: 'margin:4px 0 0;color:#7a7a7a;font-size:14px;' }, '운영 중인 공간 자원 목록입니다.')
          ),
          el('button', { class: 'btn-primary btn-compact-mobile', onclick: () => openSpaceModal(null) },
            el('i', { class: 'fa-solid fa-plus', style: 'margin-right:6px;' }), '공간 추가')
        ),
        // V7 통합본 §4: 데스크톱 테이블 + 모바일 카드 UI 듀얼 렌더
        el('table', { class: 'data-table space-table-desktop' },
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
        ),
        // V7 통합본 §4: 모바일 카드 UI
        el('div', { class: 'space-cards-mobile' },
          ...spaces.map(s =>
            el('div', { class: 'member-card space-card' },
              el('div', { class: 'member-card-head' },
                el('div', { class: 'space-color-chip', style: `background:${s.color};` }),
                el('div', { class: 'member-card-id' },
                  el('div', { class: 'member-card-name' }, s.name),
                  el('div', { class: 'member-card-email' },
                    (s.type === 'meeting_room' ? '미팅룸' : '공용공간') + ' · ' + s.capacity + '명'
                  )
                ),
                el('div', { class: 'member-card-badges' },
                  s.tenant_scope
                    ? el('span', { class: 'status-badge s-active', style: 'background:rgba(0,102,204,0.12);color:#0066cc;' }, s.tenant_scope + ' 전용')
                    : el('span', { class: 'status-badge s-member' }, '모두 공개')
                )
              ),
              el('div', { class: 'member-card-meta' },
                el('div', { class: 'meta-row' },
                  el('span', { class: 'meta-label' }, '3개 제한'),
                  el('span', { class: 'meta-value' },
                    s.count_in_limit === 1
                      ? el('span', { class: 'status-badge s-active' }, '포함')
                      : el('span', { class: 'status-badge s-member' }, '제외')
                  )
                ),
                el('div', { class: 'meta-row' },
                  el('span', { class: 'meta-label' }, '색상'),
                  el('span', { class: 'meta-value', style: 'display:flex;align-items:center;gap:6px;' },
                    el('span', { style: `display:inline-block;width:14px;height:14px;border-radius:4px;background:${s.color};` }),
                    s.color
                  )
                )
              ),
              el('div', { class: 'member-card-actions' },
                el('button', { class: 'btn-card-action', onclick: () => openSpaceModal(s) },
                  el('i', { class: 'fa-solid fa-pen', style: 'margin-right:6px;font-size:11px;' }), '수정'),
                el('button', { class: 'btn-card-action is-danger', onclick: () => deleteSpace(s) },
                  el('i', { class: 'fa-solid fa-trash', style: 'margin-right:6px;font-size:11px;' }), '삭제')
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
    el('div', { class: 'page-header is-admin-header' },
      el('div', { class: 'page-title-block' },
        el('h1', null, '관리'),
        el('p', null, '부서와 직책을 한 화면에서 통합 관리합니다. 멤버 생성 폼의 드롭다운에 즉시 반영됩니다.')
        // V7 통합본 §1: 부모 div.page-header 에 is-admin-header 클래스 적용됨
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

    // V11 §3-3: 테넌트별 일정 색상 한 번 로드 → CSS 변수 적용 (모든 페이지에서 사용)
    try {
      const tRes = await api('/api/tenants');
      State.tenants = tRes?.data?.tenants || [];
      if (typeof applyTenantColorVars === 'function') {
        applyTenantColorVars(State.tenants);
      }
    } catch (e) {
      console.warn('[app] tenants load failed (will use defaults):', e?.message);
    }

    switch (State.page) {
      case 'home': await renderHome(); break;
      case 'spaces': await renderSpaces(); break;
      case 'insights':
        // V10 §4-1: 어드민 아닐 경우 홈으로 리디렉션 (백엔드 미들웨어가 한 번 더 차단)
        if (State.user.role !== 'admin') { location.href = '/home'; return; }
        await renderInsights(); break;
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
// V7 최종본 §6: 진입점에서 Global locale을 한국어(ko)로 강제 설정
//   → 모든 dayjs(date).format(...) 호출이 한글 월/요일을 자동 사용
//   → 'JUL 17' 등의 영문 월 표기 오노출 차단
function waitAndBoot() {
  if (typeof dayjs === 'undefined') {
    setTimeout(waitAndBoot, 50);
    return;
  }
  try {
    dayjs.locale('ko'); // ko locale 스크립트가 로드되어 있다면 글로벌 적용
  } catch (e) {
    console.warn('[app] dayjs locale(ko) 설정 실패:', e);
  }
  boot();
}
waitAndBoot();
