import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RoomLive,
  Reservation,
  Member,
  AttendeeStatus,
  Attachment,
} from "../../shared/types";
import { api } from "../lib/api";
import {
  timeOptions,
  hhmmToday,
  hhmmToTs,
  minToHHMM,
  tsToMin,
  startOfDay,
  dateInputValue,
  dateFromInput,
} from "../lib/time";
import { IconUsers, IconPaperclip, IconFile } from "./icons";

const OPTS = timeOptions();

const fmtSize = (n: number): string =>
  n < 1024
    ? `${n}B`
    : n < 1024 * 1024
      ? `${Math.round(n / 1024)}KB`
      : `${(n / 1024 / 1024).toFixed(1)}MB`;
const MAX_FILE = 10 * 1024 * 1024;

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
  dayStart,
  onClose,
  onSaved,
}: {
  rooms: RoomLive[];
  editing?: Reservation | null;
  meId?: string | null;
  presetRoomId?: string;
  presetStart?: string;
  presetEnd?: string;
  dayStart?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const baseDay = editing ? startOfDay(editing.startsAt) : dayStart ?? startOfDay(Date.now());
  const [dateVal, setDateVal] = useState(dateInputValue(baseDay));
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

  // 반복 (생성 모드에서만)
  const [recur, setRecur] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [count, setCount] = useState(4);

  // 회의 상세
  const [agenda, setAgenda] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState("");

  // 첨부파일 (업로드 24시간 후 자동 삭제)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 참석자
  const [invited, setInvited] = useState<Invited[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0); // 키보드 하이라이트 인덱스

  // 수정 모드면 기존 참석자 + 회의 상세 로드
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
            position: null,
            avatarColor: a.avatarColor,
            role: "member" as const,
            status: a.status,
          })),
        ),
      )
      .catch(() => {});
    api
      .reservationDetail(editing.id)
      .then((r) => {
        setAgenda(r.detail.agenda ?? "");
        setVideoUrl(r.detail.videoUrl ?? "");
        setNotes(r.detail.notes ?? "");
      })
      .catch(() => {});
    api
      .attachments(editing.id)
      .then((r) => setAttachments(r.attachments))
      .catch(() => {});
  }, [editing]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const tooBig = files.find((f) => f.size > MAX_FILE);
    if (tooBig) setErr(`${tooBig.name}은(는) 10MB를 초과해 제외했어요.`);
    setPendingFiles((prev) => [...prev, ...files.filter((f) => f.size <= MAX_FILE)]);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removePending = (i: number) =>
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));
  const removeUploaded = async (aid: string) => {
    if (!editing) return;
    try {
      await api.deleteAttachment(editing.id, aid);
      setAttachments((a) => a.filter((x) => x.id !== aid));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제 실패");
    }
  };

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

  const cancelOne = async (scope?: "series") => {
    if (!editing) return;
    const msg =
      scope === "series"
        ? "이 반복의 앞으로 남은 모든 회차를 취소할까요?"
        : `'${editing.title}' 예약을 취소할까요?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await api.cancelReservation(editing.id, scope);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "취소 실패");
      setBusy(false);
    }
  };

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
    const day = dateFromInput(dateVal);
    const startsAt = hhmmToTs(day, start);
    const endsAt = hhmmToTs(day, end);
    if (endsAt <= startsAt) return setErr("종료 시간이 시작보다 빨라요.");
    setBusy(true);
    setErr(null);
    try {
      const ids = invited.map((m) => m.id);
      let rid: string;
      if (isEdit && editing) {
        await api.updateReservation(editing.id, {
          title: title.trim(),
          startsAt,
          endsAt,
          roomId,
          agenda,
          videoUrl,
          notes,
        });
        await api.setAttendees(editing.id, ids);
        rid = editing.id;
      } else {
        const res = await api.createReservation({
          roomId,
          title: title.trim(),
          startsAt,
          endsAt,
          agenda: agenda.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          recurrence:
            recur !== "none" ? { freq: recur, count: Math.min(52, Math.max(2, count)) } : undefined,
        });
        rid = res.id;
        if (ids.length) await api.setAttendees(res.id, ids);
        if (recur !== "none" && res.skipped) {
          alert(`${res.created}개 회차를 만들었어요. ${res.skipped}개는 시간이 겹쳐 건너뛰었습니다.`);
        }
      }
      // 첨부파일 업로드 (예약 생성/수정 후, id 확보 뒤)
      if (pendingFiles.length) {
        setUploading(true);
        for (const f of pendingFiles) {
          await api.uploadAttachment(rid, f);
        }
        setUploading(false);
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

        <div className="field">
          <label>날짜</label>
          <input
            type="date"
            className="select"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
          />
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

        {/* 반복 (생성 모드) */}
        {!isEdit && (
          <div className="field">
            <label>반복</label>
            <div className="rec-row">
              <select
                className="select"
                value={recur}
                onChange={(e) => setRecur(e.target.value as typeof recur)}
              >
                <option value="none">반복 안 함</option>
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
              </select>
              {recur !== "none" && (
                <div className="rec-count">
                  총
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                  회
                </div>
              )}
            </div>
            {recur !== "none" && (
              <div className="rec-hint muted">시간이 겹치는 회차는 자동으로 건너뜁니다.</div>
            )}
          </div>
        )}

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

        {/* 회의 상세 */}
        <div className="field">
          <label>화상회의 링크</label>
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://zoom.us/j/… 또는 Teams/Meet 링크"
            inputMode="url"
          />
        </div>
        <div className="field">
          <label>안건</label>
          <textarea
            className="ta"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder={"논의할 안건을 줄바꿈으로 적어주세요\n예: 1. 지난주 리뷰\n2. 이번주 목표"}
            rows={3}
          />
        </div>
        <div className="field">
          <label>자료·메모</label>
          <textarea
            className="ta"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="참고 자료 링크나 메모"
            rows={2}
          />
        </div>

        {/* 첨부파일 */}
        <div className="field">
          <label className="att-label">
            <span>첨부파일</span>
            <span className="file-note">업로드 후 24시간 뒤 자동 삭제</span>
          </label>

          {(attachments.length > 0 || pendingFiles.length > 0) && (
            <div className="file-list">
              {attachments.map((a) => (
                <div key={a.id} className="file-item">
                  <IconFile size={16} />
                  <a
                    className="file-name"
                    href={api.attachmentUrl(editing!.id, a.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.filename}
                  </a>
                  <span className="file-size">{fmtSize(a.size)}</span>
                  <button className="att-x" onClick={() => removeUploaded(a.id)} aria-label="삭제">
                    ✕
                  </button>
                </div>
              ))}
              {pendingFiles.map((f, i) => (
                <div key={i} className="file-item pending">
                  <IconFile size={16} />
                  <span className="file-name">{f.name}</span>
                  <span className="file-size">{fmtSize(f.size)}</span>
                  <span className="file-badge">대기</span>
                  <button className="att-x" onClick={() => removePending(i)} aria-label="제외">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={onPickFiles}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="btn btn-ghost file-add"
            onClick={() => fileRef.current?.click()}
          >
            <IconPaperclip size={16} /> 파일 첨부
          </button>
        </div>

        {err && <div className="auth-err" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-foot">
          {isEdit && editing ? (
            <>
              <a
                className="btn btn-ghost"
                href={api.reservationIcsUrl(editing.id)}
                title="이 회의를 내 캘린더(.ics)에 추가"
              >
                캘린더에 추가
              </a>
              <button className="btn btn-ghost danger" onClick={() => cancelOne()} disabled={busy}>
                예약 취소
              </button>
              {editing.recurringId && (
                <button
                  className="btn btn-ghost danger"
                  onClick={() => cancelOne("series")}
                  disabled={busy}
                >
                  반복 전체
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {uploading ? "업로드 중…" : busy ? "저장 중…" : "저장"}
              </button>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
                취소
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {uploading ? "업로드 중…" : busy ? "예약 중…" : "예약하기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
