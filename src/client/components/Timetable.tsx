import { useEffect, useRef, useState } from "react";
import type { PointerEvent as RPE } from "react";
import type { Reservation, RoomLive, LiveStatus } from "../../shared/types";
import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  HOUR_PX,
  SNAP_MIN,
  minToTop,
  minToHHMM,
  minToday,
  tsToMin,
  snapMin,
  clampMin,
} from "../lib/time";
import { IconPencil, IconX } from "./icons";
import "./Timetable.css";

const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i,
);
const BODY_H = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;

const STATUS_COLOR: Record<LiveStatus, string> = {
  available: "var(--ok)",
  soon: "var(--warn)",
  busy: "var(--busy)",
};

type DragState =
  | { kind: "create"; roomId: string; colTop: number; startMin: number; curMin: number }
  | { kind: "resize"; id: string; roomId: string; edge: "top" | "bottom"; colTop: number; startMin: number; endMin: number }
  | { kind: "move"; id: string; roomId: string; colTop: number; startMin: number; endMin: number; grabMin: number };

export default function Timetable({
  rooms,
  reservations,
  now,
  canBook,
  isAdmin,
  onCreate,
  onResize,
  onCancel,
  onEditRoom,
}: {
  rooms: RoomLive[];
  reservations: Reservation[];
  now: number;
  canBook: boolean;
  isAdmin: boolean;
  onCreate: (roomId: string, startHHMM: string, endHHMM: string) => void;
  onResize: (id: string, startsAt: number, endsAt: number) => void;
  onCancel: (r: Reservation) => void;
  onEditRoom: (room: RoomLive) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const setD = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };
  const dragging = drag !== null;

  const minFromY = (clientY: number, colTop: number) =>
    clampMin(snapMin(DAY_START_HOUR * 60 + ((clientY - colTop) / HOUR_PX) * 60));

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const min = minFromY(e.clientY, d.colTop);
      if (d.kind === "create") {
        setD({ ...d, curMin: min });
      } else if (d.kind === "resize") {
        if (d.edge === "top") setD({ ...d, startMin: Math.min(min, d.endMin - SNAP_MIN) });
        else setD({ ...d, endMin: Math.max(min, d.startMin + SNAP_MIN) });
      } else {
        const dur = d.endMin - d.startMin;
        let s = clampMin(min - d.grabMin);
        s = Math.min(s, DAY_END_HOUR * 60 - dur);
        setD({ ...d, startMin: s, endMin: s + dur });
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      setD(null);
      if (!d) return;
      if (d.kind === "create") {
        let s = Math.min(d.startMin, d.curMin);
        let e = Math.max(d.startMin, d.curMin);
        if (e - s < SNAP_MIN) e = Math.min(DAY_END_HOUR * 60, s + 60); // 짧은 클릭 = 1시간 기본
        onCreate(d.roomId, minToHHMM(s), minToHHMM(e));
      } else {
        onResize(d.id, minToday(d.startMin), minToday(d.endMin));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const byRoom = new Map<string, Reservation[]>();
  for (const r of reservations) {
    const arr = byRoom.get(r.roomId) ?? [];
    arr.push(r);
    byRoom.set(r.roomId, arr);
  }

  const nowH = new Date(now).getHours();
  const nowInRange = nowH >= DAY_START_HOUR && nowH < DAY_END_HOUR;

  const colDown = (roomId: string) => (e: RPE<HTMLDivElement>) => {
    if (!canBook) return;
    e.preventDefault();
    const colTop = e.currentTarget.getBoundingClientRect().top;
    const min = minFromY(e.clientY, colTop);
    setD({ kind: "create", roomId, colTop, startMin: min, curMin: min });
  };

  const colTopOf = (el: Element) =>
    (el.closest(".tt-col") as HTMLElement).getBoundingClientRect().top;

  const startResize = (r: Reservation, edge: "top" | "bottom") => (e: RPE) => {
    if (!canBook) return;
    e.preventDefault();
    e.stopPropagation();
    setD({
      kind: "resize",
      id: r.id,
      roomId: r.roomId,
      edge,
      colTop: colTopOf(e.currentTarget as Element),
      startMin: tsToMin(r.startsAt),
      endMin: tsToMin(r.endsAt),
    });
  };
  const startMove = (r: Reservation) => (e: RPE) => {
    if (!canBook) return;
    e.preventDefault();
    e.stopPropagation();
    const colTop = colTopOf(e.currentTarget as Element);
    const sm = tsToMin(r.startsAt);
    setD({
      kind: "move",
      id: r.id,
      roomId: r.roomId,
      colTop,
      startMin: sm,
      endMin: tsToMin(r.endsAt),
      grabMin: minFromY(e.clientY, colTop) - sm,
    });
  };

  return (
    <div className={"tt card" + (dragging ? " dragging" : "")}>
      <div className="tt-scroll">
        <div
          className="tt-grid"
          style={{ gridTemplateColumns: `56px repeat(${rooms.length}, minmax(140px, 1fr))` }}
        >
          {/* 헤더 */}
          <div className="tt-corner" />
          {rooms.map((room) => (
            <div key={room.id} className="tt-colhead">
              <span className="tt-status" style={{ background: STATUS_COLOR[room.status] }} />
              <span className="tt-colname">{room.name}</span>
              <span className="tt-cap">{room.capacity}</span>
              {isAdmin && (
                <button
                  className="tt-edit"
                  onClick={() => onEditRoom(room)}
                  aria-label="회의실 수정"
                >
                  <IconPencil size={13} />
                </button>
              )}
            </div>
          ))}

          {/* 시간 눈금 */}
          <div className="tt-gutter" style={{ height: BODY_H }}>
            {HOURS.map((h) => (
              <div key={h} className="tt-hour" style={{ top: (h - DAY_START_HOUR) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 룸 컬럼 */}
          {rooms.map((room) => {
            const showGhost = drag?.kind === "create" && drag.roomId === room.id;
            const gS = showGhost ? Math.min(drag.startMin, drag.curMin) : 0;
            const gE = showGhost ? Math.max(drag.startMin, drag.curMin) : 0;
            return (
              <div
                key={room.id}
                className="tt-col"
                style={{ height: BODY_H }}
                onPointerDown={colDown(room.id)}
              >
                {(byRoom.get(room.id) ?? []).map((r) => {
                  const active =
                    drag && "id" in drag && drag.id === r.id
                      ? { s: drag.startMin, e: drag.endMin }
                      : { s: tsToMin(r.startsAt), e: tsToMin(r.endsAt) };
                  const top = minToTop(active.s);
                  const height = Math.max(22, minToTop(active.e) - top);
                  return (
                    <div
                      key={r.id}
                      className="tt-block"
                      style={{
                        top,
                        height,
                        background: `color-mix(in srgb, ${room.color} 14%, #fff)`,
                        borderLeftColor: room.color,
                      }}
                      onPointerDown={canBook ? startMove(r) : undefined}
                    >
                      {canBook && (
                        <span className="tt-handle top" onPointerDown={startResize(r, "top")} />
                      )}
                      <div className="tt-block-title">{r.title}</div>
                      <div className="tt-block-time">
                        {minToHHMM(active.s)}–{minToHHMM(active.e)}
                      </div>
                      {canBook && (
                        <>
                          <button
                            className="tt-block-x"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancel(r);
                            }}
                            aria-label="예약 취소"
                          >
                            <IconX size={12} />
                          </button>
                          <span className="tt-handle bottom" onPointerDown={startResize(r, "bottom")} />
                        </>
                      )}
                    </div>
                  );
                })}

                {showGhost && gE > gS && (
                  <div className="tt-ghost" style={{ top: minToTop(gS), height: minToTop(gE) - minToTop(gS) }}>
                    {minToHHMM(gS)}–{minToHHMM(gE)}
                  </div>
                )}

                {nowInRange && (
                  <div className="tt-now" style={{ top: minToTop(tsToMin(now)) }}>
                    <span className="tt-now-dot" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {canBook && (
        <div className="tt-hint muted">
          빈 곳을 드래그해 예약 · 블록 가장자리를 끌어 시간 조절 · ✕로 취소
        </div>
      )}
    </div>
  );
}
