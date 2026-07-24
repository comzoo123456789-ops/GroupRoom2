import { useCallback, useEffect, useRef, useState } from "react";
import type { Invitation, AttendeeStatus } from "../../shared/types";
import { api } from "../lib/api";
import { hhmm } from "../lib/time";
import { IconBell, IconCheck, IconX } from "./icons";

function whenLabel(startsAt: number, endsAt: number): string {
  const s = new Date(startsAt);
  const today = new Date();
  const sameDay =
    s.getFullYear() === today.getFullYear() &&
    s.getMonth() === today.getMonth() &&
    s.getDate() === today.getDate();
  const day = sameDay ? "오늘" : `${s.getMonth() + 1}/${s.getDate()}`;
  return `${day} ${hhmm(startsAt)}–${hhmm(endsAt)}`;
}

const STATUS_LABEL: Record<AttendeeStatus, string> = {
  pending: "대기",
  accepted: "수락함",
  declined: "거절함",
};

/** 내 초대함: 상단바 벨 + 대기중 배지 + 수락/거절 패널. liveVersion이 바뀌면 갱신. */
export default function InvitationsBell({ liveVersion }: { liveVersion: number }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api
      .invitations()
      .then((r) => setItems(r.invitations))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load, liveVersion]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pendingCount = items.filter((i) => i.myStatus === "pending").length;

  const respond = async (id: string, status: AttendeeStatus) => {
    setPendingId(id);
    try {
      await api.rsvp(id, status);
      setItems((cur) =>
        cur.map((i) => (i.reservationId === id ? { ...i, myStatus: status } : i)),
      );
    } catch {
      /* noop */
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="inv-wrap" ref={wrapRef}>
      <button
        className={"inv-bell" + (pendingCount > 0 ? " has" : "")}
        onClick={() => setOpen((o) => !o)}
        aria-label={`초대 ${pendingCount}건`}
      >
        <IconBell size={18} />
        {pendingCount > 0 && <span className="inv-badge">{pendingCount}</span>}
      </button>

      {open && (
        <div className="inv-panel card">
          <div className="inv-head">
            <b>내 초대</b>
            {pendingCount > 0 && <span className="inv-head-n">대기 {pendingCount}</span>}
          </div>

          {items.length === 0 ? (
            <div className="inv-empty">받은 초대가 없어요</div>
          ) : (
            <div className="inv-list">
              {items.map((i) => (
                <div key={i.reservationId} className="inv-item">
                  <span className="inv-dot" style={{ background: i.roomColor }} />
                  <div className="inv-body">
                    <div className="inv-title">{i.title}</div>
                    <div className="inv-meta">
                      {i.roomName} · {whenLabel(i.startsAt, i.endsAt)}
                    </div>
                    <div className="inv-org">{i.organizerName} 주최</div>
                  </div>
                  {i.myStatus === "pending" ? (
                    <div className="inv-actions">
                      <button
                        className="inv-btn accept"
                        disabled={pendingId === i.reservationId}
                        onClick={() => respond(i.reservationId, "accepted")}
                        aria-label="수락"
                      >
                        <IconCheck size={15} />
                      </button>
                      <button
                        className="inv-btn decline"
                        disabled={pendingId === i.reservationId}
                        onClick={() => respond(i.reservationId, "declined")}
                        aria-label="거절"
                      >
                        <IconX size={15} />
                      </button>
                    </div>
                  ) : (
                    <span className={"inv-status " + i.myStatus}>
                      {STATUS_LABEL[i.myStatus]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
