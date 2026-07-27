import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { Reservation, RoomLive } from "../../shared/types";
import type { ShellContext } from "../components/AppShell";
import { api, connectLive } from "../lib/api";
import {
  dayRange,
  hhmm,
  startOfDay,
  isSameDay,
  dateInputValue,
  dateFromInput,
  dayLabel,
} from "../lib/time";
import { IconBolt, IconWifi } from "../components/icons";
import RoomEditor from "../components/RoomEditor";
import ReservationEditor from "../components/ReservationEditor";
import Timetable from "../components/Timetable";
import InvitationsBell from "../components/InvitationsBell";
import "./LiveBoard.css";

export default function LiveBoard() {
  const nav = useNavigate();
  const { setTopbar } = useOutletContext<ShellContext>();
  const [rooms, setRooms] = useState<RoomLive[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [liveVersion, setLiveVersion] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ room: RoomLive | null } | null>(null);
  const [booking, setBooking] = useState<{ roomId: string; start: string; end: string } | null>(null);
  const [editRes, setEditRes] = useState<Reservation | null>(null);
  // 조회·예약 대상 날짜(00:00 epoch). 기본 오늘. 날짜 이동으로 미리 예약 가능.
  const [dayStart, setDayStart] = useState(startOfDay(Date.now()));

  const load = useCallback(async () => {
    try {
      const [from, to] = dayRange(dayStart);
      const [live, res] = await Promise.all([
        api.roomsLive(),
        api.reservations(from, to),
      ]);
      setRooms(live.rooms);
      setReservations(res.reservations);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [dayStart]);

  // 날짜 변경 시 재조회
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    load();
  }, [load]);

  // 마운트 1회: 로그인 정보 + 실시간 연결 + 시계/폴링
  useEffect(() => {
    api
      .me()
      .then((r) => {
        setIsAdmin(r.user?.role === "admin");
        setLoggedIn(!!r.user);
        setMeId(r.user?.userId ?? null);
      })
      .catch(() => {});
    const stopWs = connectLive(() => {
      setConnected(true);
      setLiveVersion((v) => v + 1);
      loadRef.current();
    });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => loadRef.current(), 30_000);
    return () => {
      stopWs();
      clearInterval(clock);
      clearInterval(poll);
    };
  }, []);

  const counts = {
    available: rooms.filter((r) => r.status === "available").length,
    soon: rooms.filter((r) => r.status === "soon").length,
    busy: rooms.filter((r) => r.status === "busy").length,
  };
  const clockLabel = hhmm(now);

  // 상단바(실시간 현황 옆)에 통계·컨트롤 주입
  useEffect(() => {
    setTopbar(
      <div className="tb-slot">
        <div className="stat-strip">
          <Stat n={counts.available} label="비어있음" cls="s-ok" />
          <Stat n={counts.soon} label="곧 시작" cls="s-soon" />
          <Stat n={counts.busy} label="사용중" cls="s-busy" />
        </div>
        <div className="spacer" />
        {isAdmin && rooms.length > 0 && (
          <button className="btn btn-primary" style={{ height: 36 }} onClick={() => setEditing({ room: null })}>
            + 회의실 추가
          </button>
        )}
        {loggedIn && <InvitationsBell liveVersion={liveVersion} />}
        <span className={"conn " + (connected ? "on" : "")}>
          <IconWifi size={15} />
          {connected ? "실시간" : "연결 중…"}
        </span>
        <span className="clock">{clockLabel}</span>
      </div>,
    );
    return () => setTopbar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.available, counts.soon, counts.busy, connected, isAdmin, clockLabel, rooms.length, loggedIn, liveVersion]);

  const seed = async () => {
    setSeeding(true);
    try {
      await api.bootstrap();
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const onCreate = (roomId: string, start: string, end: string) => {
    if (!loggedIn) return nav("/login");
    setBooking({ roomId, start, end });
  };
  const onResize = (id: string, startsAt: number, endsAt: number, roomId?: string) => {
    if (!loggedIn) return nav("/login");
    api
      .updateReservation(id, { startsAt, endsAt, roomId })
      .then(load)
      .catch((e) => {
        alert(e instanceof Error ? e.message : "수정 실패");
        load();
      });
  };
  const onCancel = (r: Reservation) => {
    if (!loggedIn) return nav("/login");
    if (confirm(`'${r.title}' (${hhmm(r.startsAt)}–${hhmm(r.endsAt)}) 예약을 취소할까요?`)) {
      api
        .cancelReservation(r.id)
        .then(load)
        .catch((e) => alert(e instanceof Error ? e.message : "취소 실패"));
    }
  };

  return (
    <div className="live">
      {loading ? (
        <div className="tt-loading card" />
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
          <div className="day-nav">
            <button
              className="day-btn"
              onClick={() => setDayStart((d) => startOfDay(d - 86_400_000))}
              aria-label="이전 날"
            >
              ‹
            </button>
            <input
              type="date"
              className="day-input"
              value={dateInputValue(dayStart)}
              onChange={(e) => e.target.value && setDayStart(dateFromInput(e.target.value))}
            />
            <span className="day-label">{dayLabel(dayStart)}</span>
            <button
              className="day-btn"
              onClick={() => setDayStart((d) => startOfDay(d + 86_400_000))}
              aria-label="다음 날"
            >
              ›
            </button>
            {!isSameDay(dayStart, now) && (
              <button className="btn btn-ghost day-today" onClick={() => setDayStart(startOfDay(Date.now()))}>
                오늘
              </button>
            )}
          </div>
          <Timetable
            rooms={rooms}
            reservations={reservations}
            now={now}
            dayStart={dayStart}
            canBook={loggedIn}
            isAdmin={isAdmin}
            meId={meId}
            onCreate={onCreate}
            onResize={onResize}
            onCancel={onCancel}
            onEditRoom={(room) => setEditing({ room })}
            onEditReservation={(r) => setEditRes(r)}
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
          meId={meId}
          presetRoomId={booking.roomId}
          presetStart={booking.start}
          presetEnd={booking.end}
          dayStart={dayStart}
          onClose={() => setBooking(null)}
          onSaved={() => {
            setBooking(null);
            load();
          }}
        />
      )}

      {editRes && (
        <ReservationEditor
          rooms={rooms}
          meId={meId}
          editing={editRes}
          onClose={() => setEditRes(null)}
          onSaved={() => {
            setEditRes(null);
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
