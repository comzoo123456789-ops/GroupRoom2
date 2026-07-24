import { useEffect, useRef, useState } from "react";
import type { RoomLive, Reservation, Member } from "../../shared/types";
import { api } from "../lib/api";
import { timeOptions, hhmmToday, minToHHMM, tsToMin } from "../lib/time";

const OPTS = timeOptions();

function plusOne(t: string): string {
  const i = OPTS.indexOf(t);
  return OPTS[Math.min(OPTS.length - 1, i + 2)] ?? t; // +1시간(30분*2)
}

const initials = (name: string) => name.trim().slice(-2);

export default function ReservationEditor({
  rooms,
  editing,
  presetRoomId,
  presetStart,
  presetEnd,
  onClose,
  onSaved,
}: {
  rooms: RoomLive[];
  editing?: Reservation | null;
  presetRoomId?: string;
  presetStart?: string;
  presetEnd?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [roomId, setRoomId] = useState(
    editing?.roomId ?? presetRoomId ?? rooms[0]?.id ?? "",
  );
  const [start, setStart] = useState(
    editing ? minToHHMM(tsToMin(editing.startsAt)) : presetStart ?? "09:00",
  );
  const [end, setEnd] = useState(
    editing
      ? minToHHMM(tsToMin(editing.endsAt))
      : presetEnd ?? plusOne(presetStart ?? "09:00"),
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 참석자
  const [invited, setInvited] = useState<Member[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);

  // 수정 모드면 기존 참석자 로드
  useEffect(() => {
    if (!editing) return;
    api
      .attendees(editing.id)
      .then((r) =>
        setInvited(
          r.attendees.map((a) => ({
            id: a.userId,
            name: a.name,
            email: a.email,
            department: a.department,
            avatarColor: a.avatarColor,
            role: "member",
          })),
        ),
      )
      .catch(() => {});
  }, [editing]);

  // 이름 검색 (디바운스)
  const qRef = useRef(q);
  qRef.current = q;
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api
        .members(term)
        .then((r) => {
          if (qRef.current.trim() === term) setResults(r.members);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const invitedIds = new Set(invited.map((m) => m.id));
  const shown = results.filter((m) => !invitedIds.has(m.id));

  const add = (m: Member) => {
    setInvited((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    setQ("");
    setResults([]);
  };
  const remove = (id: string) => setInvited((cur) => cur.filter((m) => m.id !== id));

  const save = async () => {
    if (!title.trim()) return setErr("회의 제목을 입력하세요.");
    const startsAt = hhmmToday(start);
    const endsAt = hhmmToday(end);
    if (endsAt <= startsAt) return setErr("종료 시간이 시작보다 빨라요.");
    setBusy(true);
    setErr(null);
    try {
      const ids = invited.map((m) => m.id);
      if (isEdit && editing) {
        await api.updateReservation(editing.id, {
          title: title.trim(),
          startsAt,
          endsAt,
          roomId,
        });
        await api.setAttendees(editing.id, ids);
      } else {
        const { id } = await api.createReservation({
          roomId,
          title: title.trim(),
          startsAt,
          endsAt,
        });
        if (ids.length) await api.setAttendees(id, ids);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : isEdit ? "수정 실패" : "예약 실패");
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "예약 수정" : "회의실 예약"}</h2>
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

        {/* 참석자 초대 */}
        <div className="field">
          <label>참석자 초대 {invited.length > 0 && `· ${invited.length}명`}</label>
          {invited.length > 0 && (
            <div className="att-chips">
              {invited.map((m) => (
                <span key={m.id} className="att-chip">
                  <span className="att-ava" style={{ background: m.avatarColor }}>
                    {initials(m.name)}
                  </span>
                  {m.name}
                  {m.department && <span className="att-dept">{m.department}</span>}
                  <button className="att-x" onClick={() => remove(m.id)} aria-label="제외">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="att-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름·부서로 임직원 검색"
            />
            {q.trim() && (
              <div className="att-results">
                {searching && shown.length === 0 && <div className="att-empty">검색 중…</div>}
                {!searching && shown.length === 0 && (
                  <div className="att-empty">일치하는 임직원이 없어요</div>
                )}
                {shown.map((m) => (
                  <button key={m.id} className="att-opt" onClick={() => add(m)}>
                    <span className="att-ava" style={{ background: m.avatarColor }}>
                      {initials(m.name)}
                    </span>
                    <span className="att-opt-name">{m.name}</span>
                    {m.department && <span className="att-dept">{m.department}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {err && <div className="auth-err" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-foot">
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? (isEdit ? "저장 중…" : "예약 중…") : isEdit ? "저장" : "예약하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
