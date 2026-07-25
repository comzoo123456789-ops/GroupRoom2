import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, resolveOrgId } from "../lib/session";
import { mapReservation, notifyLive } from "../lib/live";
import { newId } from "../lib/crypto";
import { buildIcs } from "../lib/ics";

export const reservations = new Hono<{ Bindings: Env }>();

// 기간 내 예약 목록
reservations.get("/", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const now = Date.now();
  const from = Number(c.req.query("from") ?? now - 12 * 3600_000);
  const to = Number(c.req.query("to") ?? now + 24 * 3600_000);
  const rs = await c.env.DB.prepare(
    `SELECT reservations.*,
            (SELECT COUNT(*) FROM reservation_attendees a WHERE a.reservation_id = reservations.id) AS attendee_count,
            (SELECT COUNT(*) FROM reservation_attendees a WHERE a.reservation_id = reservations.id AND a.status = 'accepted') AS accepted_count
       FROM reservations
      WHERE org_id = ? AND status IN ('confirmed','checked_in')
        AND ends_at > ? AND starts_at < ?
      ORDER BY starts_at`,
  )
    .bind(orgId, from, to)
    .all();
  return c.json({ reservations: rs.results.map((r) => mapReservation(r as never)) });
});

// 예약 생성 (충돌 검증 + 실시간 브로드캐스트)
reservations.post("/", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);

  const body = await c.req.json<{
    roomId?: string;
    title?: string;
    purpose?: string;
    startsAt?: number;
    endsAt?: number;
    agenda?: string;
    videoUrl?: string;
    notes?: string;
    recurrence?: {
      freq?: "daily" | "weekly" | "monthly";
      interval?: number;
      count?: number;
      until?: number;
    };
  }>();
  const { roomId, title, startsAt, endsAt } = body;
  if (!roomId || !title || !startsAt || !endsAt) {
    return c.json({ error: "필수 항목이 누락되었습니다." }, 400);
  }
  if (endsAt <= startsAt) {
    return c.json({ error: "종료 시간이 시작 시간보다 빨라요." }, 400);
  }

  // 룸 소속 조직 확인
  const room = await c.env.DB.prepare(
    `SELECT org_id FROM rooms WHERE id = ? AND active = 1`,
  )
    .bind(roomId)
    .first<{ org_id: string }>();
  if (!room || room.org_id !== user.orgId) {
    return c.json({ error: "회의실을 찾을 수 없습니다." }, 404);
  }

  const now = Date.now();
  const dur = endsAt - startsAt;

  // 반복 규칙 → 발생 시각 목록 생성 (최대 52회)
  const MAX_OCCUR = 52;
  const rec = body.recurrence;
  const freq = rec?.freq;
  const occ: { s: number; e: number }[] = [];
  if (freq === "daily" || freq === "weekly" || freq === "monthly") {
    const interval = Math.min(12, Math.max(1, rec?.interval ?? 1));
    const count = rec?.count ? Math.min(MAX_OCCUR, Math.max(1, rec.count)) : MAX_OCCUR;
    let s = startsAt;
    while (occ.length < count) {
      if (rec?.until && s > rec.until) break;
      occ.push({ s, e: s + dur });
      if (freq === "daily") s = s + interval * 86400_000;
      else if (freq === "weekly") s = s + interval * 7 * 86400_000;
      else {
        const d = new Date(s);
        d.setMonth(d.getMonth() + interval);
        s = d.getTime();
      }
    }
  } else {
    occ.push({ s: startsAt, e: endsAt });
  }

  const isClash = async (s: number, e: number) => {
    const clash = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM reservations
        WHERE room_id = ? AND status IN ('confirmed','checked_in')
          AND starts_at < ? AND ends_at > ?`,
    )
      .bind(roomId, e, s)
      .first<{ n: number }>();
    return (clash?.n ?? 0) > 0;
  };

  // 단건이면 기존과 동일하게 충돌 시 409
  if (occ.length === 1) {
    if (await isClash(occ[0].s, occ[0].e)) {
      return c.json({ error: "이미 예약된 시간과 겹칩니다." }, 409);
    }
  }

  // 반복이면 규칙 행 생성
  let recurringId: string | null = null;
  if (occ.length > 1) {
    recurringId = newId();
    await c.env.DB.prepare(
      `INSERT INTO recurring_rules (id, org_id, freq, interval_n, end_type, end_date, end_count)
       VALUES (?,?,?,?,?,?,?)`,
    )
      .bind(
        recurringId,
        user.orgId,
        freq,
        Math.min(12, Math.max(1, rec?.interval ?? 1)),
        rec?.until ? "date" : "count",
        rec?.until ?? null,
        rec?.count ?? occ.length,
      )
      .run();
  }

  // 충돌하지 않는 회차만 생성, 겹치는 회차는 건너뜀
  let firstId: string | null = null;
  let created = 0;
  let skipped = 0;
  for (const o of occ) {
    if (await isClash(o.s, o.e)) {
      skipped++;
      continue;
    }
    const rid = newId();
    if (!firstId) firstId = rid;
    await c.env.DB.prepare(
      `INSERT INTO reservations
         (id, org_id, room_id, user_id, title, purpose, starts_at, ends_at, status, recurring_id, agenda, video_url, notes, created_by_admin, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?, 'confirmed', ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        rid,
        user.orgId,
        roomId,
        user.userId,
        title,
        body.purpose ?? null,
        o.s,
        o.e,
        recurringId,
        body.agenda?.trim() || null,
        body.videoUrl?.trim() || null,
        body.notes?.trim() || null,
        user.role === "admin" ? 1 : 0,
        now,
        now,
      )
      .run();
    created++;
  }

  if (created === 0) {
    return c.json({ error: "모든 회차가 기존 예약과 겹쳐 생성되지 않았어요." }, 409);
  }

  await notifyLive(c.env, user.orgId, { type: "reservation.changed", roomId, at: now });
  return c.json({ ok: true, id: firstId, created, skipped }, 201);
});

// 예약 수정 (시간 드래그 리사이즈/이동, 제목 변경) — 본인 또는 관리자
reservations.patch("/:id", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  const id = c.req.param("id");

  const cur = await c.env.DB.prepare(
    `SELECT room_id, user_id, starts_at, ends_at FROM reservations
      WHERE id = ? AND org_id = ? AND status IN ('confirmed','checked_in')`,
  )
    .bind(id, user.orgId)
    .first<{ room_id: string; user_id: string; starts_at: number; ends_at: number }>();
  if (!cur) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);
  if (cur.user_id !== user.userId && user.role !== "admin") {
    return c.json({ error: "수정 권한이 없습니다." }, 403);
  }

  const b = await c.req
    .json<{
      startsAt?: number;
      endsAt?: number;
      title?: string;
      roomId?: string;
      agenda?: string;
      videoUrl?: string;
      notes?: string;
    }>()
    .catch(() => ({}) as Record<string, never>);
  const startsAt = b.startsAt ?? cur.starts_at;
  const endsAt = b.endsAt ?? cur.ends_at;
  if (endsAt <= startsAt) return c.json({ error: "종료 시간이 시작보다 빨라요." }, 400);

  // 회의실 이동(A→B 등): 대상 룸이 같은 조직 소속인지 확인
  const targetRoomId = b.roomId ?? cur.room_id;
  if (targetRoomId !== cur.room_id) {
    const room = await c.env.DB.prepare(
      `SELECT org_id FROM rooms WHERE id = ? AND active = 1`,
    )
      .bind(targetRoomId)
      .first<{ org_id: string }>();
    if (!room || room.org_id !== user.orgId) {
      return c.json({ error: "옮길 회의실을 찾을 수 없습니다." }, 404);
    }
  }

  // 자기 자신 제외 충돌 검증 (대상 룸 기준)
  const clash = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM reservations
      WHERE room_id = ? AND id <> ? AND status IN ('confirmed','checked_in')
        AND starts_at < ? AND ends_at > ?`,
  )
    .bind(targetRoomId, id, endsAt, startsAt)
    .first<{ n: number }>();
  if ((clash?.n ?? 0) > 0) return c.json({ error: "다른 예약과 겹칩니다." }, 409);

  const sets: string[] = ["starts_at = ?", "ends_at = ?", "updated_at = ?"];
  const vals: unknown[] = [startsAt, endsAt, Date.now()];
  if (targetRoomId !== cur.room_id) {
    sets.push("room_id = ?");
    vals.push(targetRoomId);
  }
  if (typeof b.title === "string" && b.title.trim()) {
    sets.push("title = ?");
    vals.push(b.title.trim());
  }
  // 회의 상세: 빈 문자열이면 NULL로 지움
  if (typeof b.agenda === "string") {
    sets.push("agenda = ?");
    vals.push(b.agenda.trim() || null);
  }
  if (typeof b.videoUrl === "string") {
    sets.push("video_url = ?");
    vals.push(b.videoUrl.trim() || null);
  }
  if (typeof b.notes === "string") {
    sets.push("notes = ?");
    vals.push(b.notes.trim() || null);
  }
  vals.push(id);
  await c.env.DB.prepare(`UPDATE reservations SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals)
    .run();

  await notifyLive(c.env, user.orgId, { type: "reservation.changed", roomId: cur.room_id, at: Date.now() });
  if (targetRoomId !== cur.room_id) {
    await notifyLive(c.env, user.orgId, { type: "reservation.changed", roomId: targetRoomId, at: Date.now() });
  }
  return c.json({ ok: true });
});

// 회의 상세(안건·화상링크·메모) 조회
reservations.get("/:id/detail", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const id = c.req.param("id");
  const r = await c.env.DB.prepare(
    `SELECT agenda, video_url AS videoUrl, notes FROM reservations WHERE id = ? AND org_id = ?`,
  )
    .bind(id, orgId)
    .first<{ agenda: string | null; videoUrl: string | null; notes: string | null }>();
  if (!r) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);
  return c.json({ detail: r });
});

// 내가 관여한(주최 or 참석) 다가오는 회의 — 시작 전 리마인더용
reservations.get("/mine/upcoming", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ upcoming: [] });
  const now = Date.now();
  const rows = await c.env.DB.prepare(
    `SELECT r.id AS id, r.title AS title, r.starts_at AS startsAt, r.ends_at AS endsAt,
            r.video_url AS videoUrl, rm.name AS roomName
       FROM reservations r
       JOIN rooms rm ON rm.id = r.room_id
      WHERE r.org_id = ? AND r.status IN ('confirmed','checked_in')
        AND r.starts_at > ? AND r.starts_at < ?
        AND (r.user_id = ?
             OR EXISTS (SELECT 1 FROM reservation_attendees a
                         WHERE a.reservation_id = r.id AND a.user_id = ? AND a.status <> 'declined'))
      ORDER BY r.starts_at`,
  )
    .bind(user.orgId, now - 60_000, now + 2 * 3600_000, user.userId, user.userId)
    .all();
  return c.json({ upcoming: rows.results });
});

// 단일 예약 iCalendar(.ics) 다운로드 — 캘린더에 추가
reservations.get("/:id/ics", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT r.id AS id, r.title AS title, r.starts_at AS startsAt, r.ends_at AS endsAt,
            r.video_url AS videoUrl, r.agenda AS agenda,
            rm.name AS roomName, host.name AS organizerName
       FROM reservations r
       JOIN rooms rm ON rm.id = r.room_id
       JOIN users host ON host.id = r.user_id
      WHERE r.id = ? AND r.org_id = ?`,
  )
    .bind(id, orgId)
    .first<{
      id: string;
      title: string;
      startsAt: number;
      endsAt: number;
      videoUrl: string | null;
      agenda: string | null;
      roomName: string;
      organizerName: string;
    }>();
  if (!row) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);

  const desc = [
    `주최: ${row.organizerName}`,
    row.videoUrl ? `화상회의: ${row.videoUrl}` : "",
    row.agenda ? `안건:\n${row.agenda}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const body = buildIcs([
    {
      uid: `${row.id}@grouproom`,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      location: row.videoUrl || row.roomName,
      description: desc,
    },
  ]);
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="grouproom-${row.id}.ics"`,
    },
  });
});

// 참석자 목록
reservations.get("/:id/attendees", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const id = c.req.param("id");
  const rows = await c.env.DB.prepare(
    `SELECT u.id AS userId, u.name AS name, u.email AS email,
            u.department AS department, u.avatar_color AS avatarColor, a.status AS status
       FROM reservation_attendees a
       JOIN users u ON u.id = a.user_id
      WHERE a.reservation_id = ? AND u.org_id = ?
      ORDER BY u.name`,
  )
    .bind(id, orgId)
    .all();
  return c.json({ attendees: rows.results });
});

// 참석자 일괄 설정(초대) — 본인 또는 관리자. body: { userIds: string[] }
reservations.put("/:id/attendees", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  const id = c.req.param("id");

  const res = await c.env.DB.prepare(
    `SELECT room_id, user_id FROM reservations
      WHERE id = ? AND org_id = ? AND status IN ('confirmed','checked_in')`,
  )
    .bind(id, user.orgId)
    .first<{ room_id: string; user_id: string }>();
  if (!res) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);
  if (res.user_id !== user.userId && user.role !== "admin") {
    return c.json({ error: "참석자를 수정할 권한이 없습니다." }, 403);
  }

  const body = await c.req
    .json<{ userIds?: string[] }>()
    .catch(() => ({}) as { userIds?: string[] });
  // 주최자는 참석자 목록에서 제외(항상 host로 취급)
  const wanted = Array.from(new Set(body.userIds ?? []))
    .filter((uid) => uid !== res.user_id)
    .slice(0, 100);

  // 같은 조직 활성 사용자만 허용
  let valid: string[] = [];
  if (wanted.length) {
    const placeholders = wanted.map(() => "?").join(",");
    const rows = await c.env.DB.prepare(
      `SELECT id FROM users WHERE org_id = ? AND status = 'active' AND id IN (${placeholders})`,
    )
      .bind(user.orgId, ...wanted)
      .all<{ id: string }>();
    valid = rows.results.map((r) => r.id);
  }

  // 상태 보존 diff: 빠진 사람만 삭제, 새 사람만 pending으로 추가.
  // (이미 수락/거절한 참석자를 재저장 때 pending으로 되돌리지 않음)
  const existingRows = await c.env.DB.prepare(
    `SELECT user_id FROM reservation_attendees WHERE reservation_id = ?`,
  )
    .bind(id)
    .all<{ user_id: string }>();
  const existing = new Set(existingRows.results.map((r) => r.user_id));
  const wantedSet = new Set(valid);

  const toRemove = [...existing].filter((u) => !wantedSet.has(u));
  const toAdd = valid.filter((u) => !existing.has(u));

  for (const uid of toRemove) {
    await c.env.DB.prepare(
      `DELETE FROM reservation_attendees WHERE reservation_id = ? AND user_id = ?`,
    )
      .bind(id, uid)
      .run();
  }
  for (const uid of toAdd) {
    await c.env.DB.prepare(
      `INSERT INTO reservation_attendees (reservation_id, user_id, status) VALUES (?, ?, 'pending')`,
    )
      .bind(id, uid)
      .run();
  }

  await notifyLive(c.env, user.orgId, {
    type: "reservation.changed",
    roomId: res.room_id,
    at: Date.now(),
  });
  return c.json({ ok: true, count: valid.length, added: toAdd.length, removed: toRemove.length });
});

// 내 초대함: 내가 참석자로 등록된 다가오는 예약들 + 내 응답상태
reservations.get("/inbox", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  const now = Date.now();
  const rows = await c.env.DB.prepare(
    `SELECT r.id AS reservationId, r.title AS title, r.starts_at AS startsAt, r.ends_at AS endsAt,
            rm.name AS roomName, rm.color AS roomColor,
            host.name AS organizerName, a.status AS myStatus
       FROM reservation_attendees a
       JOIN reservations r ON r.id = a.reservation_id
       JOIN rooms rm ON rm.id = r.room_id
       JOIN users host ON host.id = r.user_id
      WHERE a.user_id = ? AND r.org_id = ?
        AND r.status IN ('confirmed','checked_in')
        AND r.ends_at > ?
      ORDER BY r.starts_at`,
  )
    .bind(user.userId, user.orgId, now - 60 * 60_000)
    .all();
  return c.json({ invitations: rows.results });
});

// RSVP: 초대받은 본인이 수락/거절
reservations.post("/:id/rsvp", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  const id = c.req.param("id");
  const body = await c.req
    .json<{ status?: string }>()
    .catch(() => ({}) as { status?: string });
  const status = body.status;
  if (status !== "accepted" && status !== "declined" && status !== "pending") {
    return c.json({ error: "잘못된 응답 상태입니다." }, 400);
  }
  const r = await c.env.DB.prepare(
    `UPDATE reservation_attendees SET status = ?
      WHERE reservation_id = ? AND user_id = ?`,
  )
    .bind(status, id, user.userId)
    .run();
  if (!r.meta.changes) return c.json({ error: "초대를 찾을 수 없습니다." }, 404);

  const row = await c.env.DB.prepare(`SELECT room_id FROM reservations WHERE id = ?`)
    .bind(id)
    .first<{ room_id: string }>();
  if (row) {
    await notifyLive(c.env, user.orgId, {
      type: "reservation.changed",
      roomId: row.room_id,
      at: Date.now(),
    });
  }
  return c.json({ ok: true, status });
});

// 체크인
reservations.post("/:id/checkin", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  const id = c.req.param("id");
  const now = Date.now();
  const r = await c.env.DB.prepare(
    `UPDATE reservations SET status='checked_in', checked_in_at=?, updated_at=?
      WHERE id=? AND org_id=? AND status='confirmed'`,
  )
    .bind(now, now, id, user.orgId)
    .run();
  if (!r.meta.changes) return c.json({ error: "체크인할 예약이 없습니다." }, 404);

  const row = await c.env.DB.prepare(
    `SELECT room_id FROM reservations WHERE id = ?`,
  )
    .bind(id)
    .first<{ room_id: string }>();
  if (row) {
    await notifyLive(c.env, user.orgId, {
      type: "reservation.changed",
      roomId: row.room_id,
      at: now,
    });
  }
  return c.json({ ok: true });
});

// 예약 취소 (소프트 삭제)
reservations.delete("/:id", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  const id = c.req.param("id");
  const scope = c.req.query("scope"); // 'series' 이면 반복 전체 취소
  const row = await c.env.DB.prepare(
    `SELECT room_id, user_id, recurring_id FROM reservations WHERE id = ? AND org_id = ?`,
  )
    .bind(id, user.orgId)
    .first<{ room_id: string; user_id: string; recurring_id: string | null }>();
  if (!row) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);
  if (row.user_id !== user.userId && user.role !== "admin") {
    return c.json({ error: "취소 권한이 없습니다." }, 403);
  }
  const now = Date.now();

  // 반복 전체 취소: 같은 시리즈의 '앞으로 남은' 예약을 모두 취소
  if (scope === "series" && row.recurring_id) {
    const r = await c.env.DB.prepare(
      `UPDATE reservations SET status='cancelled', updated_at=?
        WHERE recurring_id=? AND org_id=? AND status IN ('confirmed','checked_in') AND ends_at > ?`,
    )
      .bind(now, row.recurring_id, user.orgId, now)
      .run();
    await notifyLive(c.env, user.orgId, { type: "reservation.changed", roomId: row.room_id, at: now });
    return c.json({ ok: true, cancelled: r.meta.changes });
  }

  await c.env.DB.prepare(
    `UPDATE reservations SET status='cancelled', updated_at=? WHERE id=?`,
  )
    .bind(now, id)
    .run();
  await notifyLive(c.env, user.orgId, {
    type: "reservation.changed",
    roomId: row.room_id,
    at: now,
  });
  return c.json({ ok: true });
});
