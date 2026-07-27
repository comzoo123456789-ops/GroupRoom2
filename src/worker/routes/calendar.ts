import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser } from "../lib/session";
import { buildIcs, type IcsEvent } from "../lib/ics";

export const calendar = new Hono<{ Bindings: Env }>();

// 내 일정 .ics — 내가 주최했거나 참석(초대)한 다가오는 예약 전체
calendar.get("/mine.ics", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  const from = Date.now() - 60 * 60_000;

  const rows = await c.env.DB.prepare(
    `SELECT r.id AS id, r.title AS title, r.starts_at AS startsAt, r.ends_at AS endsAt,
            rm.name AS roomName, host.name AS organizerName
       FROM reservations r
       JOIN rooms rm ON rm.id = r.room_id
       JOIN users host ON host.id = r.user_id
      WHERE r.org_id = ? AND r.status IN ('confirmed','checked_in') AND r.ends_at > ?
        AND (r.user_id = ?
             OR EXISTS (SELECT 1 FROM reservation_attendees a
                         WHERE a.reservation_id = r.id AND a.user_id = ?))
      ORDER BY r.starts_at`,
  )
    .bind(user.orgId, from, user.userId, user.userId)
    .all<{
      id: string;
      title: string;
      startsAt: number;
      endsAt: number;
      roomName: string;
      organizerName: string;
    }>();

  const events: IcsEvent[] = rows.results.map((r) => ({
    uid: `${r.id}@grouproom`,
    title: r.title,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    location: r.roomName,
    description: `주최: ${r.organizerName}`,
  }));

  return new Response(buildIcs(events, "Wylie Meeting · 내 일정"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="grouproom-my-schedule.ics"`,
    },
  });
});
