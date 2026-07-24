import { useState } from "react";
import type { RoomLive } from "../../shared/types";
import { api } from "../lib/api";
import { timeOptions, hhmmToday } from "../lib/time";

const OPTS = timeOptions();

function plusOne(t: string): string {
  const i = OPTS.indexOf(t);
  return OPTS[Math.min(OPTS.length - 1, i + 2)] ?? t; // +1시간(30분*2)
}

export default function ReservationEditor({
  rooms,
  presetRoomId,
  presetStart,
  presetEnd,
  onClose,
  onSaved,
}: {
  rooms: RoomLive[];
  presetRoomId: string;
  presetStart: string;
  presetEnd?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roomId, setRoomId] = useState(presetRoomId);
  const [start, setStart] = useState(presetStart);
  const [end, setEnd] = useState(presetEnd ?? plusOne(presetStart));
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return setErr("회의 제목을 입력하세요.");
    const startsAt = hhmmToday(start);
    const endsAt = hhmmToday(end);
    if (endsAt <= startsAt) return setErr("종료 시간이 시작보다 빨라요.");
    setBusy(true);
    setErr(null);
    try {
      await api.createReservation({ roomId, title: title.trim(), startsAt, endsAt });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "예약 실패");
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>회의실 예약</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="field">
          <label>회의 제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 팀 주간회의"
            autoFocus
          />
        </div>

        <div className="field">
          <label>회의실</label>
          <select className="select" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.capacity}명
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label>시작</label>
            <select
              className="select"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (hhmmToday(e.target.value) >= hhmmToday(end)) setEnd(plusOne(e.target.value));
              }}
            >
              {OPTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>종료</label>
            <select className="select" value={end} onChange={(e) => setEnd(e.target.value)}>
              {OPTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {err && <div className="auth-err" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-foot">
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "예약 중…" : "예약하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
