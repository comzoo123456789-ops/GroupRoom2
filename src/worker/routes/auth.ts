import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../types";
import { verifyPassword, hashPassword, newToken } from "../lib/crypto";
import { currentUser } from "../lib/session";

export const auth = new Hono<{ Bindings: Env }>();

auth.post("/login", async (c) => {
  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({}) as { email?: string; password?: string });
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return c.json({ error: "이메일과 비밀번호를 입력하세요." }, 400);
  }
  const user = await c.env.DB.prepare(
    `SELECT id, password_hash, password_salt FROM users WHERE email = ? LIMIT 1`,
  )
    .bind(email)
    .first<{ id: string; password_hash: string; password_salt: string }>();
  if (!user) return c.json({ error: "계정을 찾을 수 없습니다." }, 401);

  const ok = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!ok) return c.json({ error: "비밀번호가 일치하지 않습니다." }, 401);

  const token = newToken();
  const now = Date.now();
  const exp = now + 7 * 24 * 3600_000;
  await c.env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?,?,?,?)`,
  )
    .bind(token, user.id, exp, now)
    .run();

  setCookie(c, "gr_session", token, {
    httpOnly: true,
    path: "/",
    maxAge: 7 * 24 * 3600,
    sameSite: "Lax",
    secure: c.req.url.startsWith("https"),
  });
  return c.json({ ok: true });
});

auth.post("/logout", async (c) => {
  const m = (c.req.header("Cookie") ?? "").match(/gr_session=([^;]+)/);
  if (m) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(m[1]).run();
  }
  deleteCookie(c, "gr_session", { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ user: null, org: null });
  const profile = await c.env.DB.prepare(
    `SELECT avatar_color AS avatarColor, department, must_reset_pw AS mustResetPw FROM users WHERE id = ?`,
  )
    .bind(u.userId)
    .first<{ avatarColor: string; department: string | null; mustResetPw: number }>();
  const org = await c.env.DB.prepare(
    `SELECT id, name, slug, logo_url AS logoUrl, brand_color AS brandColor, timezone
       FROM organizations WHERE id = ?`,
  )
    .bind(u.orgId)
    .first();
  return c.json({
    user: {
      ...u,
      avatarColor: profile?.avatarColor ?? "#3B5BDB",
      department: profile?.department ?? null,
      mustResetPw: profile?.mustResetPw === 1,
    },
    org,
  });
});

// 비밀번호 변경 (첫 로그인 강제 변경 포함)
auth.post("/change-password", async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "로그인이 필요합니다." }, 401);
  const b = await c.req
    .json<{ currentPassword?: string; newPassword?: string }>()
    .catch(() => ({}) as { currentPassword?: string; newPassword?: string });
  const next = b.newPassword ?? "";
  if (next.length < 8) {
    return c.json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, 400);
  }
  const row = await c.env.DB.prepare(
    `SELECT password_hash, password_salt FROM users WHERE id = ?`,
  )
    .bind(u.userId)
    .first<{ password_hash: string; password_salt: string }>();
  if (!row) return c.json({ error: "계정을 찾을 수 없습니다." }, 404);
  const ok = await verifyPassword(b.currentPassword ?? "", row.password_salt, row.password_hash);
  if (!ok) return c.json({ error: "현재 비밀번호가 일치하지 않습니다." }, 400);

  const { hash, salt } = await hashPassword(next);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, password_salt = ?, must_reset_pw = 0 WHERE id = ?`,
  )
    .bind(hash, salt, u.userId)
    .run();
  return c.json({ ok: true });
});
