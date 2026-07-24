import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { IconMap } from "../components/icons";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("admin1234");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.login(email, password);
      nav("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "로그인 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="auth-card card" onSubmit={submit}>
        <div className="brand-mark" style={{ width: 44, height: 44 }}>
          <IconMap size={24} />
        </div>
        <h1>GroupRoom 로그인</h1>
        <p className="muted">사내 회의실을 한눈에 보고 즉시 예약하세요.</p>

        <label>이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <label>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {err && <div className="auth-err">{err}</div>}

        <button className="btn btn-primary" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
          {busy ? "로그인 중…" : "로그인"}
        </button>
        <div className="auth-hint muted">
          데모 계정: admin@demo.com / admin1234
          <br />
          (계정이 없다면 현황판에서 <b>데모 데이터 생성</b>을 먼저 눌러주세요)
        </div>
      </form>

      <style>{`
        .auth { min-height: 100vh; display: grid; place-items: center; padding: 24px;
          background: radial-gradient(1200px 600px at 50% -10%, var(--brand-wash), var(--bg)); }
        .auth-card { width: 100%; max-width: 380px; padding: 36px 32px;
          display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-lg); }
        .auth-card h1 { font-size: 22px; margin-top: 8px; letter-spacing: -0.02em; }
        .auth-card label { font-size: 12px; font-weight: 600; color: var(--text-2); margin-top: 10px; }
        .auth-card input { height: 44px; padding: 0 14px; border-radius: var(--r-sm);
          border: 1px solid var(--border-strong); background: var(--surface-2); outline: none;
          transition: border .14s, box-shadow .14s; }
        .auth-card input:focus { border-color: var(--brand);
          box-shadow: 0 0 0 3px var(--brand-wash); background: var(--surface); }
        .auth-err { color: var(--busy); background: var(--busy-wash); font-size: 13px;
          padding: 10px 12px; border-radius: var(--r-sm); font-weight: 500; }
        .auth-hint { font-size: 12px; text-align: center; margin-top: 12px; line-height: 1.6; }
      `}</style>
    </div>
  );
}
