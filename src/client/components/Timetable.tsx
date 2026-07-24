import type { MouseEvent } from "react";
import type { Reservation, RoomLive } from "../../shared/types";
import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  HOUR_PX,
  SNAP_MIN,
  tsToTop,
  hhmm,
} from "../lib/time";
import "./Timetable.css";

const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i,
);
const BODY_H = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;

export default function Timetable({
  rooms,
  reservations,
  now,
  canBook,
  onSlot,
  onBlock,
}: {
  rooms: RoomLive[];
  reservations: Reservation[];
  now: number;
  canBook: boolean;
  onSlot: (roomId: string, hhmmStr: string) => void;
  onBlock: (r: Reservation) => void;
}) {
  const byRoom = new Map<string, Reservation[]>();
  for (const r of reservations) {
    const arr = byRoom.get(r.roomId) ?? [];
    arr.push(r);
    byRoom.set(r.roomId, arr);
  }

  const nowInRange =
    new Date(now).getHours() >= DAY_START_HOUR && new Date(now).getHours() < DAY_END_HOUR;

  const handleCol = (roomId: string) => (e: MouseEvent<HTMLDivElement>) => {
    if (!canBook) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let mins = Math.round((y / HOUR_PX) * (60 / SNAP_MIN)) * SNAP_MIN;
    let total = DAY_START_HOUR * 60 + mins;
    total = Math.min(DAY_END_HOUR * 60 - SNAP_MIN, Math.max(DAY_START_HOUR * 60, total));
    const h = Math.floor(total / 60);
    const m = total % 60;
    onSlot(roomId, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  return (
    <div className="tt card">
      <div className="tt-scroll">
        <div
          className="tt-grid"
          style={{ gridTemplateColumns: `56px repeat(${rooms.length}, minmax(132px, 1fr))` }}
        >
          {/* 헤더 행 */}
          <div className="tt-corner" />
          {rooms.map((r) => (
            <div key={r.id} className="tt-colhead">
              <span className="tt-dot" style={{ background: r.color }} />
              {r.name}
            </div>
          ))}

          {/* 본문 행 */}
          <div className="tt-gutter" style={{ height: BODY_H }}>
            {HOURS.map((h) => (
              <div key={h} className="tt-hour" style={{ top: (h - DAY_START_HOUR) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {rooms.map((room) => (
            <div
              key={room.id}
              className={"tt-col" + (canBook ? " bookable" : "")}
              style={{ height: BODY_H }}
              onClick={handleCol(room.id)}
            >
              {(byRoom.get(room.id) ?? []).map((r) => {
                const top = tsToTop(r.startsAt);
                const h = Math.max(20, tsToTop(r.endsAt) - top);
                return (
                  <div
                    key={r.id}
                    className="tt-block"
                    style={{
                      top,
                      height: h,
                      background: `color-mix(in srgb, ${room.color} 14%, #fff)`,
                      borderLeftColor: room.color,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlock(r);
                    }}
                  >
                    <div className="tt-block-title">{r.title}</div>
                    <div className="tt-block-time">
                      {hhmm(r.startsAt)}–{hhmm(r.endsAt)}
                    </div>
                  </div>
                );
              })}

              {nowInRange && (
                <div className="tt-now" style={{ top: tsToTop(now) }}>
                  <span className="tt-now-dot" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {canBook && <div className="tt-hint muted">빈 곳을 클릭하면 예약할 수 있어요</div>}
    </div>
  );
}
