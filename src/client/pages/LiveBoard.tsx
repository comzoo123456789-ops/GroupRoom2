import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { RoomLive, LiveStatus } from "../../shared/types";
import { api, connectLive } from "../lib/api";
import { amenityIcon, IconUsers, IconBolt, IconWifi } from "../components/icons";
import RoomEditor from "../components/RoomEditor";
import "./LiveBoard.css";

const STATUS_LABEL: Record<LiveStatus, string> = {
  available: "비어있음",
  soon: "곧 시작",
  busy: "사용중",
};
const STATUS_CLASS: Record<LiveStatus, string> = {
  available: "s-ok",
  soon: "s-soon",
  busy: "s-busy",
};

function hhmm(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function minutesLeft(ts: number, now: number): number {
  return Math.max(0, Math.round((ts - now) / 60000));
}
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function LiveBoard() {
  const [rooms, setRooms] = useState<RoomLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // null=닫힘, {room:null}=신규, {room}=수정
  const [editing, setEditing] = useState<{ room: RoomLive | null } | null>(null);
  const planRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.roomsLive();
      setRooms(r.rooms);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.me().then((r) => setIsAdmin(r.user?.role === "admin")).catch(() => {});
    const stopWs = connectLive(() => {
      setConnected(true);
      load();
    });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(load, 30_000);
    return () => {
      stopWs();
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      await api.bootstrap();
      await load();
    } finally {
      setSeeding(false);
    }
  };

  // 드래그/리사이즈 후 위치 저장 (낙관적 반영 후 서버 커밋)
  const commitPlan = useCallback(
    async (id: string, plan: RoomLive["plan"]) => {
      setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, plan } : r)));
      try {
        await api.updateRoom(id, { plan });
      } catch {
        load();
      }
    },
    [load],
  );

  const counts = {
    available: rooms.filter((r) => r.status === "available").length,
    soon: rooms.filter((r) => r.status === "soon").length,
    busy: rooms.filter((r) => r.status === "busy").length,
  };

  return (
    <div className="live">
      <div className="live-top">
        <div className="stat-strip">
          <Stat n={counts.available} label="비어있음" cls="s-ok" />
          <Stat n={counts.soon} label="곧 시작" cls="s-soon" />
          <Stat n={counts.busy} label="사용중" cls="s-busy" />
        </div>
        <div className="live-meta">
          {isAdmin && (
            <>
              <button
                className={"btn btn-ghost" + (editMode ? " on" : "")}
                style={{ height: 36 }}
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? "편집 완료" : "도면 편집"}
              </button>
              {editMode && (
                <button
                  className="btn btn-primary"
                  style={{ height: 36 }}
                  onClick={() => setEditing({ room: null })}
                >
                  + 회의실 추가
                </button>
              )}
            </>
          )}
          <span className={"conn " + (connected ? "on" : "")}>
            <IconWifi size={15} />
            {connected ? "실시간" : "연결 중…"}
          </span>
          <span className="clock">{hhmm(now)}</span>
        </div>
      </div>

      {loading ? (
        <div className="plan-skeleton card" />
      ) : rooms.length === 0 ? (
        <div className="empty card">
          <IconBolt size={28} />
          <h3>아직 회의실 데이터가 없어요</h3>
          <p className="muted">데모 조직·회의실·예약을 한 번에 생성합니다.</p>
          <button className="btn btn-primary" onClick={seed} disabled={seeding}>
            {seeding ? "생성 중…" : "데모 데이터 생성"}
          </button>
        </div>
      ) : (
        <div className={"plan card" + (editMode ? " editing" : "")} ref={planRef}>
          <div className="plan-grid" />
          {rooms.map((room) => (
            <RoomTile
              key={room.id}
              room={room}
              now={now}
              editMode={editMode}
              planRef={planRef}
              onOpen={(r) => setEditing({ room: r })}
              onCommit={commitPlan}
            />
          ))}
          {editMode && <div className="edit-hint">드래그로 이동 · 모서리로 크기조절 · 탭하여 수정</div>}
        </div>
      )}

      {editing && (
        <RoomEditor
          room={editing.room}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className="stat">
      <span className={"stat-dot " + cls} />
      <b>{n}</b>
      <span className="muted">{label}</span>
    </div>
  );
}

function RoomTile({
  room,
  now,
  editMode,
  planRef,
  onOpen,
  onCommit,
}: {
  room: RoomLive;
  now: number;
  editMode: boolean;
  planRef: RefObject<HTMLDivElement | null>;
  onOpen: (room: RoomLive) => void;
  onCommit: (id: string, plan: RoomLive["plan"]) => void;
}) {
  const cls = STATUS_CLASS[room.status];
  const [plan, setPlan] = useState(room.plan);
  const drag = useRef<{
    mode: "move" | "resize";
    cx: number;
    cy: number;
    start: RoomLive["plan"];
    moved: boolean;
  } | null>(null);

  // 외부에서 room.plan이 바뀌면(다른 사람 편집 등) 동기화 (드래그 중이 아닐 때만)
  useEffect(() => {
    if (!drag.current) setPlan(room.plan);
  }, [room.plan.x, room.plan.y, room.plan.w, room.plan.h]);

  const onPointerDown = (mode: "move" | "resize") => (e: ReactPointerEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, cx: e.clientX, cy: e.clientY, start: { ...plan }, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || !planRef.current) return;
    const rect = planRef.current.getBoundingClientRect();
    const dx = ((e.clientX - d.cx) / rect.width) * 100;
    const dy = ((e.clientY - d.cy) / rect.height) * 100;
    if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) d.moved = true;
    if (d.mode === "move") {
      setPlan({
        ...d.start,
        x: clamp(d.start.x + dx, 0, 100 - d.start.w),
        y: clamp(d.start.y + dy, 0, 100 - d.start.h),
      });
    } else {
      setPlan({
        ...d.start,
        w: clamp(d.start.w + dx, 8, 100 - d.start.x),
        h: clamp(d.start.h + dy, 8, 100 - d.start.y),
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    if (d.moved) {
      onCommit(room.id, {
        x: Math.round(plan.x * 10) / 10,
        y: Math.round(plan.y * 10) / 10,
        w: Math.round(plan.w * 10) / 10,
        h: Math.round(plan.h * 10) / 10,
      });
    } else if (editMode) {
      onOpen(room);
    }
  };

  return (
    <div
      className={"room " + cls}
      style={{
        left: `${plan.x}%`,
        top: `${plan.y}%`,
        width: `${plan.w}%`,
        height: `${plan.h}%`,
      }}
      onPointerDown={onPointerDown("move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="room-head">
        <span className="room-name">{room.name}</span>
        <span className={"badge " + cls}>
          <i className="dot" />
          {STATUS_LABEL[room.status]}
        </span>
      </div>

      <div className="room-info">
        {room.status === "busy" && room.current ? (
          <>
            <div className="room-title">{room.current.title}</div>
            <div className="room-time">
              ~{hhmm(room.current.endsAt)} · {minutesLeft(room.current.endsAt, now)}분 남음
            </div>
          </>
        ) : room.status === "soon" && room.next ? (
          <>
            <div className="room-title">곧: {room.next.title}</div>
            <div className="room-time">
              {hhmm(room.next.startsAt)} 시작 · {minutesLeft(room.next.startsAt, now)}분 후
            </div>
          </>
        ) : (
          <div className="room-free">
            지금 이용 가능
            {room.next && <span className="room-time"> · 다음 {hhmm(room.next.startsAt)}</span>}
          </div>
        )}
      </div>

      <div className="room-foot">
        <span className="cap">
          <IconUsers size={14} /> {room.capacity}
        </span>
        <span className="amen">
          {room.amenities.map((a) => {
            const Ico = amenityIcon[a];
            return Ico ? <Ico key={a} size={14} /> : null;
          })}
        </span>
      </div>

      {editMode && (
        <span
          className="resize-handle"
          onPointerDown={onPointerDown("resize")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}
    </div>
  );
}
