import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RoomLive,
  Reservation,
  Member,
  AttendeeStatus,
} from "../../shared/types";
import { api } from "../lib/api";
import { timeOptions, hhmmToday, minToHHMM, tsToMin } from "../lib/time";
import { IconUsers } from "./icons";

const OPTS = timeOptions();

function plusOne(t: string): string {
  const i = OPTS.indexOf(t);
  return OPTS[Math.min(OPTS.length - 1, i + 2)] ?? t; // +1시간(30분*2)
}

const initials = (name: string) => name.trim().slice(-2);

type Invited = Omit<Member, "status"> & { status: AttendeeStatus };

const STATUS_LABEL: Record<AttendeeStatus, string> = {
  pending: "대기",
  accepted: "수락",
  declined: "거절",
};

export default function ReservationEditor({
  rooms,
  editing,
  meId,
  presetRoomId,
  presetStart,
  presetEnd,
  onClose,
  onSaved,
}: {
  rooms: RoomLive[];
  editing?: Reservation | null;
  meId?: string | null;
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
  const [invited, setInvited] = useState<Invited[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0); // 키보드 하이라이트 인덱스

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
            status: a.status,
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
          if (qRef.current.trim() === term) {
            setResults(r.members);
            setHi(0);
          }
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const invitedIds = useMemo(() => new Set(invited.map((m) => m.id)), [invited]);
  // 이미 초대된 사람 + 본인(주최자)은 검색 결과에서 제외
  const shown = results.filter((m) => !invitedIds.has(m.id) && m.id !== meId);

  const room = rooms.find((r) => r.id === roomId);
  const cap = room?.capacity ?? null;
  const headcount = invited.length + 1; // 주최자 포함
  const overCap = cap != null && headcount > cap;

  const add = (m: Member) => {
    setInvited((cur) =>
      cur.some((x) => x.id === m.id) ? cur : [...cur, { ...m, status: "pending" }],
    );
    setQ("");
    setResults([]);
    setHi(0);
  };
  const remove = (id: string) => setInvited((cur) => cur.filter((m) => m.id !== id));

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) {
      if (e.key === "Escape") setQ("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = shown[hi];
      if (m) add(m);
    } else if (e.key === "Escape") {
      setQ("");
    }
  };

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
          <label className="att-label">
            <span>참석자 초대</span>
            {cap != null && (
              <span className={"att-count" + (overCap ? " over" : "")}>
                <IconUsers size={12} />
                {headcount} / {cap}
              </span>
            )}
          </label>

          {overCap && (
            <div className="att-warn">
              회의실 정원({cap}명)을 초과했어요. 인원을 줄이거나 더 큰 회의실을 선택하세요.
            </div>
          )}

          {invited.length > 0 && (
            <div className="att-chips">
              {invited.map((m) => (
                <span key={m.id} className="att-chip" title={m.email}>
                  <span className="att-ava" style={{ background: m.avatarColor }}>
                    {initials(m.name)}
                  </span>
                  {m.name}
                  {m.department && <span className="att-dept">{m.department}</span>}
                  <span className={"att-st " + m.status}>{STATUS_LABEL[m.status]}</span>
                  <button className="att-x" onClick={() => remove(m.id)} aria-label="제외">✕</button>
                </span>
              ))}
            </div>
          )}

          <div className="att-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="이름·부서로 임직원 검색"
            />
            {q.trim() && (
              <div className="att-results">
                {searching && shown.length === 0 && <div className="att-empty">검색 중…</div>}
                {!searching && shown.length === 0 && (
                  <div className="att-empty">일치하는 임직원이 없어요</div>
                )}
                {shown.map((m, i) => (
                  <button
                    key={m.id}
                    className={"att-opt" + (i === hi ? " hi" : "")}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => add(m)}
                  >
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
