import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomLive, LiveStatus } from "../../shared/types";
import { api, connectLive } from "../lib/api";
import { amenityIcon, IconUsers, IconBolt, IconWifi } from "../components/icons";
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

export default function LiveBoard() {
  const [rooms, setRooms] = useState<RoomLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const connRef = useRef(false);

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
    const stopWs = connectLive(() => {
      connRef.current = true;
      setConnected(true);
      load();
    });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(load, 30_000); // 상태 전환(soon→busy 등) 반영
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
          <span className={"conn " + (connected ? "on" : "")}>
            <IconWifi size={15} />
            {connected ? "실시간 연결됨" : "연결 중…"}
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
        <div className="plan card">
          <div className="plan-grid" />
          {rooms.map((room) => (
            <RoomTile key={room.id} room={room} now={now} />
          ))}
        </div>
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

function RoomTile({ room, now }: { room: RoomLive; now: number }) {
  const cls = STATUS_CLASS[room.status];
  return (
    <div
      className={"room " + cls}
      style={{
        left: `${room.plan.x}%`,
        top: `${room.plan.y}%`,
        width: `${room.plan.w}%`,
        height: `${room.plan.h}%`,
      }}
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
            {room.next && (
              <span className="room-time"> · 다음 {hhmm(room.next.startsAt)}</span>
            )}
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
    </div>
  );
}
