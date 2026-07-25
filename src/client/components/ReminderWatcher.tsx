import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { UpcomingMeeting } from "../../shared/types";
import { api } from "../lib/api";
import { hhmm } from "../lib/time";
import { IconBell, IconCam, IconX } from "./icons";

const LEAD_MIN = 10; // 시작 N분 전부터 알림

function minsLabel(startsAt: number): string {
  const m = Math.round((startsAt - Date.now()) / 60000);
  if (m <= 0) return "지금 시작";
  return `${m}분 후 시작`;
}

/** 로그인 사용자의 다가오는 회의를 감시해 시작 10분 전 토스트 + 브라우저 알림. */
export default function ReminderWatcher({ liveVersion }: { liveVersion: number }) {
  const [toasts, setToasts] = useState<UpcomingMeeting[]>([]);
  const alerted = useRef<Set<string>>(new Set());
  const upcoming = useRef<UpcomingMeeting[]>([]);

  useEffect(() => {
    let stop = false;
    const check = () => {
      const now = Date.now();
      for (const m of upcoming.current) {
        const mins = (m.startsAt - now) / 60000;
        if (mins <= LEAD_MIN && mins > -1 && !alerted.current.has(m.id)) {
          alerted.current.add(m.id);
          setToasts((t) => [...t, m]);
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`곧 회의 시작 · ${m.title}`, {
                body: `${m.roomName} · ${hhmm(m.startsAt)}`,
                tag: m.id,
              });
            } catch {
              /* noop */
            }
          }
          // 60초 뒤 자동 닫힘
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== m.id)), 60_000);
        }
      }
    };
    const fetchUp = () =>
      api
        .upcomingMine()
        .then((r) => {
          if (stop) return;
          upcoming.current = r.upcoming;
          check();
        })
        .catch(() => {});

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    fetchUp();
    const poll = setInterval(fetchUp, 60_000);
    const tick = setInterval(check, 20_000);
    return () => {
      stop = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [liveVersion]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-stack">
      {toasts.map((m) => (
        <div className="toast" key={m.id}>
          <span className="toast-ic">
            <IconBell size={16} />
          </span>
          <div className="toast-body">
            <div className="toast-title">{m.title}</div>
            <div className="toast-meta">
              {minsLabel(m.startsAt)} · {m.roomName} · {hhmm(m.startsAt)}
            </div>
          </div>
          {m.videoUrl && (
            <a className="toast-join" href={m.videoUrl} target="_blank" rel="noreferrer">
              <IconCam size={14} /> 참여
            </a>
          )}
          <button className="toast-x" onClick={() => dismiss(m.id)} aria-label="닫기">
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
