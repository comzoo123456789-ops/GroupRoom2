import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Reservation, RoomLive, LiveStatus } from "../../shared/types";
import { api, connectLive } from "../lib/api";
import { todayRange, hhmm } from "../lib/time";
import { amenityIcon, IconUsers, IconBolt, IconWifi, IconPencil } from "../components/icons";
import RoomEditor from "../components/RoomEditor";
import ReservationEditor from "../components/ReservationEditor";
import Timetable from "../components/Timetable";
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

function minutesLeft(ts: number, now: number): number {
  return Math.max(0, Math.round((ts - now) / 60000));
}

export default function LiveBoard() {
  const nav = useNavigate();
  const [rooms, setRooms] = useState<RoomLive[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [editing, setEditing] = useState<{ room: RoomLive | null } | null>(null);
  const [booking, setBooking] = useState<{ roomId: string; start: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [live, res] = await Promise.all([
        api.roomsLive(),
        (() => {
          const [from, to] = todayRange();
          return api.reservations(from, to);
        })(),
      ]);
      setRooms(live.rooms);
      setReservations(res.reservations);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api
      .me()
      .then((r) => {
        setIsAdmin(r.user?.role === "admin");
        setLoggedIn(!!r.user);
      })
      .catch(() => {});
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

  const onSlot = (roomId: string, start: string) => {
    if (!loggedIn) {
      nav("/login");
      return;
    }
    setBooking({ roomId, start });
  };

  const onBlock = (r: Reservation) => {
    if (!loggedIn) {
      nav("/login");
      return;
    }
    if (confirm(`'${r.title}' (${hhmm(r.startsAt)}–${hhmm(r.endsAt)}) 예약을 취소할까요?`)) {
      api
        .cancelReservation(r.id)
        .then(load)
        .catch((e) => alert(e instanceof Error ? e.message : "취소 실패"));
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
          {isAdmin && rooms.length > 0 && (
            <button
              className="btn btn-primary"
              style={{ height: 36 }}
              onClick={() => setEditing({ room: null })}
            >
              + 회의실 추가
            </button>
          )}
          <span className={"conn " + (connected ? "on" : "")}>
            <IconWifi size={15} />
            {connected ? "실시간" : "연결 중…"}
          </span>
          <span className="clock">{hhmm(now)}</span>
        </div>
      </div>

      {loading ? (
        <div className="room-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rcard skeleton" />
          ))}
        </div>
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
        <>
          <div className="section-label">회의실 현황</div>
          <div className="room-grid">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                now={now}
                isAdmin={isAdmin}
                onEdit={() => setEditing({ room })}
              />
            ))}
          </div>

          <div className="section-label">오늘 예약 · 08:00–22:00</div>
          <Timetable
            rooms={rooms}
            reservations={reservations}
            now={now}
            canBook={loggedIn}
            onSlot={onSlot}
            onBlock={onBlock}
          />
        </>
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

      {booking && (
        <ReservationEditor
          rooms={rooms}
          presetRoomId={booking.roomId}
          presetStart={booking.start}
          onClose={() => setBooking(null)}
          onSaved={() => {
            setBooking(null);
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

function RoomCard({
  room,
  now,
  isAdmin,
  onEdit,
}: {
  room: RoomLive;
  now: number;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const cls = STATUS_CLASS[room.status];
  return (
    <div className={"rcard " + cls}>
      <div className="rcard-head">
        <span className="rcard-name">{room.name}</span>
        <span className={"badge " + cls}>
          <i className="dot" />
          {STATUS_LABEL[room.status]}
        </span>
      </div>

      <div className="rcard-body">
        {room.status === "busy" && room.current ? (
          <>
            <div className="rcard-title">{room.current.title}</div>
            <div className="rcard-time">
              ~{hhmm(room.current.endsAt)} · {minutesLeft(room.current.endsAt, now)}분 남음
            </div>
          </>
        ) : room.status === "soon" && room.next ? (
          <>
            <div className="rcard-title">곧: {room.next.title}</div>
            <div className="rcard-time">
              {hhmm(room.next.startsAt)} 시작 · {minutesLeft(room.next.startsAt, now)}분 후
            </div>
          </>
        ) : (
          <div className="rcard-free">
            지금 이용 가능
            {room.next && <span className="rcard-time"> · 다음 {hhmm(room.next.startsAt)}</span>}
          </div>
        )}
      </div>

      <div className="rcard-foot">
        <span className="cap">
          <IconUsers size={15} /> {room.capacity}명
        </span>
        <span className="amen">
          {room.amenities.map((a) => {
            const Ico = amenityIcon[a];
            return Ico ? <Ico key={a} size={15} /> : null;
          })}
        </span>
      </div>

      {isAdmin && (
        <button className="rcard-edit" onClick={onEdit} aria-label="회의실 수정">
          <IconPencil size={15} />
        </button>
      )}
    </div>
  );
}
