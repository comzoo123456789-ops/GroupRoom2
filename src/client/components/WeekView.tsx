import type { MouseEvent } from "react";
import type { Reservation, RoomLive } from "../../shared/types";
import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  HOUR_PX,
  minToTop,
  minToHHMM,
  tsToMin,
  snapMin,
  clampMin,
  isSameDay,
  startOfDay,
} from "../lib/time";
import "./Timetable.css";
import "./WeekView.css";

const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i,
);
const BODY_H = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;
const WD = ["일", "월", "화", "수", "목", "금", "토"];

export default function WeekView({
  room,
  reservations,
  now,
  days,
  canBook,
  onSlot,
  onBlock,
}: {
  room: RoomLive | null;
  reservations: Reservation[];
  now: number;
  days: number[];
  canBook: boolean;
  onSlot: (dayMs: number, hhmm: string) => void;
  onBlock: (r: Reservation) => void;
}) {
  const color = room?.color ?? "#703b96";
  // 선택된 회의실의 예약만, 날짜별로 그룹
  const byDay = new Map<number, Reservation[]>();
  if (room) {
    for (const r of reservations) {
      if (r.roomId !== room.id) continue;
      const key = startOfDay(r.startsAt);
      const arr = byDay.get(key) ?? [];
      arr.push(r);
      byDay.set(key, arr);
    }
  }

  const colClick = (dayMs: number) => (e: MouseEvent<HTMLDivElement>) => {
    if (!canBook) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = clampMin(snapMin(DAY_START_HOUR * 60 + (y / HOUR_PX) * 60));
    onSlot(dayMs, minToHHMM(min));
  };

  if (!room) {
    return <div className="card" style={{ padding: 32, textAlign: "center" }} >회의실을 선택하세요.</div>;
  }

  return (
    <div className="tt card">
      <div className="tt-scroll">
        <div
          className="tt-grid"
          style={{ gridTemplateColumns: `56px repeat(7, minmax(96px, 1fr))` }}
        >
          {/* 헤더: 요일 + 날짜 */}
          <div className="tt-corner" />
          {days.map((d) => {
            const date = new Date(d);
            const today = isSameDay(d, now);
            return (
              <div key={d} className={"tt-colhead wk-head" + (today ? " today" : "")}>
                <span className="wk-wd">{WD[date.getDay()]}</span>
                <span className="wk-date">{date.getDate()}</span>
              </div>
            );
          })}

          {/* 시간 눈금 */}
          <div className="tt-gutter" style={{ height: BODY_H }}>
            {HOURS.map((h) => (
              <div key={h} className="tt-hour" style={{ top: (h - DAY_START_HOUR) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 요일 컬럼 */}
          {days.map((d) => (
            <div
              key={d}
              className={"tt-col" + (canBook ? " bookable" : "")}
              style={{ height: BODY_H }}
              onClick={colClick(d)}
            >
              {(byDay.get(d) ?? []).map((r) => {
                const top = minToTop(tsToMin(r.startsAt));
                const h = Math.max(20, minToTop(tsToMin(r.endsAt)) - top);
                return (
                  <div
                    key={r.id}
                    className="tt-block"
                    style={{
                      top,
                      height: h,
                      background: `color-mix(in srgb, ${color} 14%, #fff)`,
                      borderLeftColor: color,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlock(r);
                    }}
                  >
                    <div className="tt-block-title">{r.title}</div>
                    <div className="tt-block-time">
                      {minToHHMM(tsToMin(r.startsAt))}–{minToHHMM(tsToMin(r.endsAt))}
                    </div>
                  </div>
                );
              })}
              {isSameDay(d, now) &&
                new Date(now).getHours() >= DAY_START_HOUR &&
                new Date(now).getHours() < DAY_END_HOUR && (
                  <div className="tt-now" style={{ top: minToTop(tsToMin(now)) }}>
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
