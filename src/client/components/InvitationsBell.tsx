import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // 데스크톱: 벨 아래 고정 좌표 / 모바일: null → 하단 시트
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    api
      .invitations()
      .then((r) => setItems(r.invitations))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load, liveVersion]);

  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;

  const toggle = () => {
    if (open) return setOpen(false);
    const r = btnRef.current?.getBoundingClientRect();
    if (r && !isMobile()) {
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    } else {
      setPos(null);
    }
    setOpen(true);
  };

  // 크기 변경 시 위치가 어긋나지 않도록 닫기
  useEffect(() => {
    if (!open) return;
    const onResize = () => setOpen(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    <div className="inv-wrap">
      <button
        ref={btnRef}
        className={"inv-bell" + (pendingCount > 0 ? " has" : "")}
        onClick={toggle}
        aria-label={`초대 ${pendingCount}건`}
      >
        <IconBell size={18} />
        {pendingCount > 0 && <span className="inv-badge">{pendingCount}</span>}
      </button>

      {open &&
        createPortal(
          <>
            <div className="inv-scrim" onClick={() => setOpen(false)} />
            <div
              className={"inv-panel card" + (pos ? "" : " sheet")}
              style={pos ? { top: pos.top, right: pos.right } : undefined}
              role="dialog"
              aria-label="내 초대"
            >
              <div className="inv-head">
                <b>내 초대</b>
                {pendingCount > 0 && <span className="inv-head-n">대기 {pendingCount}</span>}
                <button
                  className="icon-btn inv-close"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
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
          </>,
          document.body,
        )}
    </div>
  );
}
