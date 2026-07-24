import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, resolveOrgId } from "../lib/session";
import { mapReservation, notifyLive } from "../lib/live";
import { newId } from "../lib/crypto";

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

  // 시간 충돌 검증 (INTEGER 비교 → 자정 넘김도 정확)
  const clash = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM reservations
      WHERE room_id = ? AND status IN ('confirmed','checked_in')
        AND starts_at < ? AND ends_at > ?`,
  )
    .bind(roomId, endsAt, startsAt)
    .first<{ n: number }>();
  if ((clash?.n ?? 0) > 0) {
    return c.json({ error: "이미 예약된 시간과 겹칩니다." }, 409);
  }

  const id = newId();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO reservations
       (id, org_id, room_id, user_id, title, purpose, starts_at, ends_at, status, created_by_admin, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?, 'confirmed', ?, ?, ?)`,
  )
    .bind(
      id,
      user.orgId,
      roomId,
      user.userId,
      title,
      body.purpose ?? null,
      startsAt,
      endsAt,
      user.role === "admin" ? 1 : 0,
      now,
      now,
    )
    .run();

  await notifyLive(c.env, user.orgId, {
    type: "reservation.changed",
    roomId,
    at: now,
  });
  return c.json({ ok: true, id }, 201);
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
    .json<{ startsAt?: number; endsAt?: number; title?: string; roomId?: string }>()
    .catch(() => ({}) as { startsAt?: number; endsAt?: number; title?: string; roomId?: string });
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
  const row = await c.env.DB.prepare(
    `SELECT room_id, user_id FROM reservations WHERE id = ? AND org_id = ?`,
  )
    .bind(id, user.orgId)
    .first<{ room_id: string; user_id: string }>();
  if (!row) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);
  if (row.user_id !== user.userId && user.role !== "admin") {
    return c.json({ error: "취소 권한이 없습니다." }, 403);
  }
  const now = Date.now();
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
