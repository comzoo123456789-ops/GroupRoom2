import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

// 페이지가 상단바에 컨트롤을 주입할 수 있게 하는 컨텍스트
export interface ShellContext {
  setTopbar: (node: ReactNode) => void;
}
import type { Organization } from "../../shared/types";
import { api, type SessionUser } from "../lib/api";
import ReminderWatcher from "./ReminderWatcher";
import ChangePasswordModal from "./ChangePasswordModal";
import {
  IconGrid,
  IconCalendar,
  IconChart,
  IconUsers,
  IconSettings,
  IconMap,
  IconMenu,
  IconLogout,
} from "./icons";

const TITLES: Record<string, string> = {
  "/": "실시간 현황",
  "/timeline": "예약 타임라인",
  "/insights": "이용 분석",
  "/members": "멤버",
};

export default function AppShell() {
  const loc = useLocation();
  const nav = useNavigate();
  const [org, setOrg] = useState<Organization | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [topbar, setTopbar] = useState<ReactNode>(null);
  const [navOpen, setNavOpen] = useState(false); // 모바일 드로어

  // 라우트 변경 시 주입된 상단바 초기화 + 모바일 드로어 닫기
  useEffect(() => {
    setTopbar(null);
    setNavOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    api
      .me()
      .then((r) => {
        setOrg(r.org);
        setUser(r.user);
      })
      .catch(() => {});
  }, []);

  // 데스크톱 폭으로 넓어지면 드로어 상태 해제(스크림 잔상 방지)
  useEffect(() => {
    if (!navOpen) return;
    const onResize = () => {
      if (window.innerWidth > 900) setNavOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [navOpen]);

  // 조직 브랜드색을 CSS 변수로 주입 (화이트라벨)
  useEffect(() => {
    if (org?.brandColor) {
      document.documentElement.style.setProperty("--brand", org.brandColor);
    }
  }, [org]);

  const title = TITLES[loc.pathname] ?? "Wylie Meeting";

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    nav("/login");
  };

  return (
    <div className="app">
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
      <aside className={"sidebar" + (navOpen ? " open" : "")}>
        <div className="brand">
          <div className="brand-mark">
            <IconMap size={18} />
          </div>
          <div>
            <div className="brand-name">Wylie Meeting</div>
            <div className="brand-sub">{org?.name ?? "회의실 예약"}</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">워크스페이스</div>
          <NavItem to="/" icon={<IconGrid size={18} />} label="실시간 현황" />
          <NavItem to="/timeline" icon={<IconCalendar size={18} />} label="예약 타임라인" />
          <NavItem to="/insights" icon={<IconChart size={18} />} label="이용 분석" />
          <div className="nav-label">관리</div>
          <NavItem to="/members" icon={<IconUsers size={18} />} label="멤버" />
          <NavItem to="/settings" icon={<IconSettings size={18} />} label="설정" disabled />
        </nav>

        <div className="sidebar-foot">
          <div className="nav-item" style={{ pointerEvents: "none" }}>
            <div
              className="avatar"
              style={{ background: user?.avatarColor ?? "var(--brand)", width: 26, height: 26 }}
            >
              {(user?.name ?? "G").slice(0, 1)}
            </div>
            <span style={{ fontSize: 13 }}>{user?.name ?? "게스트"}</span>
          </div>
          {user ? (
            <button className="nav-item logout-btn" onClick={logout}>
              <IconLogout size={18} />
              로그아웃
            </button>
          ) : (
            <NavLink to="/login" className="nav-item">
              <IconLogout size={18} />
              로그인
            </NavLink>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            className="hamburger"
            onClick={() => setNavOpen(true)}
            aria-label="메뉴 열기"
          >
            <IconMenu size={20} />
          </button>
          <h1>{title}</h1>
          {topbar ?? <div className="spacer" />}
          {user ? (
            <div className="user-chip">
              <span>{user.name}</span>
              <div className="avatar" style={{ background: user.avatarColor }}>
                {user.name.slice(0, 1)}
              </div>
            </div>
          ) : (
            <NavLink to="/login" className="btn btn-ghost" style={{ height: 36 }}>
              로그인
            </NavLink>
          )}
        </header>
        <main className="content">
          <Outlet context={{ setTopbar } satisfies ShellContext} />
        </main>
      </div>

      {user && <ReminderWatcher liveVersion={0} />}

      {user?.mustResetPw && (
        <ChangePasswordModal
          forced
          onDone={() => api.me().then((r) => setUser(r.user)).catch(() => {})}
        />
      )}
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  disabled,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="nav-item" style={{ opacity: 0.4, cursor: "default" }}>
        {icon}
        {label}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)" }}>준비중</span>
      </span>
    );
  }
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
    >
      {icon}
      {label}
    </NavLink>
  );
}
