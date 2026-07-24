import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, resolveOrgId } from "../lib/session";
import type { Member } from "../../shared/types";

export const members = new Hono<{ Bindings: Env }>();

interface MemberRow {
  id: string;
  name: string;
  email: string;
  department: string | null;
  avatar_color: string;
  role: string;
}

const mapMember = (r: MemberRow): Member => ({
  id: r.id,
  name: r.name,
  email: r.email,
  department: r.department,
  avatarColor: r.avatar_color,
  role: r.role === "admin" ? "admin" : "member",
});

// 조직 임직원 목록/검색. q가 있으면 이름·부서·이메일 부분일치.
members.get("/", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);

  const q = (c.req.query("q") ?? "").trim();
  const base = `SELECT id, name, email, department, avatar_color, role
                  FROM users
                 WHERE org_id = ? AND status = 'active'`;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await c.env.DB.prepare(
      `${base} AND (name LIKE ? OR department LIKE ? OR email LIKE ?)
        ORDER BY name LIMIT 20`,
    )
      .bind(orgId, like, like, like)
      .all<MemberRow>();
  } else {
    rows = await c.env.DB.prepare(`${base} ORDER BY name LIMIT 50`)
      .bind(orgId)
      .all<MemberRow>();
  }
  return c.json({ members: rows.results.map(mapMember) });
});

// (자기 자신 확인용) 현재 로그인 사용자 id
members.get("/me", async (c) => {
  const u = await currentUser(c);
  return c.json({ userId: u?.userId ?? null });
});
