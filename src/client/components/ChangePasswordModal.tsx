import { useState } from "react";
import { api } from "../lib/api";

// 첫 로그인 시 강제 표시(닫기 불가). 일반 변경으로도 재사용 가능.
export default function ChangePasswordModal({
  forced,
  onClose,
  onDone,
}: {
  forced?: boolean;
  onClose?: () => void;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (next.length < 8) return setErr("새 비밀번호는 8자 이상이어야 합니다.");
    if (next !== confirm) return setErr("새 비밀번호 확인이 일치하지 않습니다.");
    setBusy(true);
    setErr(null);
    try {
      await api.changePassword(current, next);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "변경 실패");
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={forced ? undefined : onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-head">
          <h2>{forced ? "비밀번호 설정" : "비밀번호 변경"}</h2>
          {!forced && (
            <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
          )}
        </div>
        {forced && (
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            첫 로그인입니다. 안전을 위해 새 비밀번호를 설정해주세요.
          </p>
        )}
        <div className="field">
          <label>현재 비밀번호</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>새 비밀번호 (8자 이상)</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label>새 비밀번호 확인</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        {err && <div className="auth-err" style={{ marginTop: 4 }}>{err}</div>}
        <div className="modal-foot">
          <div style={{ flex: 1 }} />
          {!forced && (
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
