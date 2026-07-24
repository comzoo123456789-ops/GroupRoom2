import { Hono } from "hono";
import type { Env } from "../types";
import { currentUser, resolveOrgId } from "../lib/session";
import { hashPassword, newId } from "../lib/crypto";
import type { Member } from "../../shared/types";

export const members = new Hono<{ Bindings: Env }>();

interface MemberRow {
  id: string;
  name: string;
  email: string;
  department: string | null;
  avatar_color: string;
  role: string;
  status: string;
}

const mapMember = (r: MemberRow): Member => ({
  id: r.id,
  name: r.name,
  email: r.email,
  department: r.department,
  avatarColor: r.avatar_color,
  role: r.role === "admin" ? "admin" : "member",
  status: r.status === "invited" ? "invited" : r.status === "inactive" ? "inactive" : "active",
});

const AVATAR_COLORS = [
  "#3B5BDB", "#0CA678", "#7048E8", "#F76707", "#1098AD",
  "#E8590C", "#D6336C", "#2F9E44", "#5C7CFA", "#9C36B5",
];
const pickColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// 조직 임직원 목록/검색 (페이지네이션·부서/역할/상태 필터·부서 집계)
members.get("/", async (c) => {
  const orgId = await resolveOrgId(c);
  if (!orgId) return c.json({ error: "조직을 찾을 수 없습니다." }, 404);
  const me = await currentUser(c);
  const isAdmin = me?.role === "admin";

  const q = (c.req.query("q") ?? "").trim();
  const dept = (c.req.query("dept") ?? "").trim();
  const role = (c.req.query("role") ?? "").trim();
  const statusQ = (c.req.query("status") ?? "").trim();
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 30)));
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0));

  // 비관리자는 활성 멤버만 조회 가능(디렉터리). 관리자는 상태 필터 자유.
  const where: string[] = ["org_id = ?"];
  const args: unknown[] = [orgId];
  if (isAdmin && (statusQ === "active" || statusQ === "invited" || statusQ === "inactive")) {
    where.push("status = ?");
    args.push(statusQ);
  } else if (!isAdmin) {
    where.push("status = 'active'");
  }
  if (q) {
    where.push("(name LIKE ? OR department LIKE ? OR email LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  if (dept) {
    where.push("department = ?");
    args.push(dept);
  }
  if (role === "admin" || role === "member") {
    where.push("role = ?");
    args.push(role);
  }
  const whereSql = where.join(" AND ");

  const rows = await c.env.DB.prepare(
    `SELECT id, name, email, department, avatar_color, role, status
       FROM users WHERE ${whereSql}
      ORDER BY (role = 'admin') DESC, name
      LIMIT ? OFFSET ?`,
  )
    .bind(...args, limit, offset)
    .all<MemberRow>();

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM users WHERE ${whereSql}`,
  )
    .bind(...args)
    .first<{ n: number }>();

  // 부서 집계(필터 칩). 관리자는 전체, 아니면 활성만.
  const facetWhere = isAdmin ? "org_id = ?" : "org_id = ? AND status = 'active'";
  const deptRows = await c.env.DB.prepare(
    `SELECT COALESCE(department, '') AS name, COUNT(*) AS n
       FROM users WHERE ${facetWhere}
      GROUP BY department ORDER BY n DESC, name`,
  )
    .bind(orgId)
    .all<{ name: string; n: number }>();

  return c.json({
    members: rows.results.map(mapMember),
    total: totalRow?.n ?? 0,
    departments: deptRows.results.filter((d) => d.name),
  });
});

// 현재 로그인 사용자 id (자기 예약 판별용)
members.get("/me", async (c) => {
  const u = await currentUser(c);
  return c.json({ userId: u?.userId ?? null, role: u?.role ?? null });
});

// 멤버 추가 (관리자)
members.post("/", async (c) => {
  const me = await currentUser(c);
  if (!me) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (me.role !== "admin") return c.json({ error: "관리자만 멤버를 추가할 수 있습니다." }, 403);

  const b = await c.req
    .json<{ name?: string; email?: string; department?: string; role?: string; password?: string }>()
    .catch(() => ({}) as Record<string, string>);
  const name = b.name?.trim();
  const email = b.email?.trim().toLowerCase();
  if (!name || !email) return c.json({ error: "이름과 이메일을 입력하세요." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "이메일 형식이 올바르지 않아요." }, 400);
  }

  const dup = await c.env.DB.prepare(
    `SELECT 1 FROM users WHERE org_id = ? AND email = ?`,
  )
    .bind(me.orgId, email)
    .first();
  if (dup) return c.json({ error: "이미 등록된 이메일입니다." }, 409);

  const role = b.role === "admin" ? "admin" : "member";
  const { hash, salt } = await hashPassword(b.password?.trim() || "welcome1234");
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO users (id, org_id, email, name, password_hash, password_salt, role, department, avatar_color, status, must_reset_pw, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)`,
  )
    .bind(id, me.orgId, email, name, hash, salt, role, b.department?.trim() || null, pickColor(), Date.now())
    .run();

  return c.json({ ok: true, id, tempPassword: b.password?.trim() || "welcome1234" }, 201);
});

// 멤버 수정 (관리자): 역할·상태·부서·이름
members.patch("/:id", async (c) => {
  const me = await currentUser(c);
  if (!me) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (me.role !== "admin") return c.json({ error: "관리자만 수정할 수 있습니다." }, 403);
  const id = c.req.param("id");

  const target = await c.env.DB.prepare(
    `SELECT id, role, status FROM users WHERE id = ? AND org_id = ?`,
  )
    .bind(id, me.orgId)
    .first<{ id: string; role: string; status: string }>();
  if (!target) return c.json({ error: "멤버를 찾을 수 없습니다." }, 404);

  const b = await c.req
    .json<{ role?: string; status?: string; department?: string; name?: string }>()
    .catch(() => ({}) as Record<string, string>);

  // 안전장치: 마지막 관리자를 강등/비활성화하면 잠금 발생 → 차단
  const demoting =
    (b.role && b.role !== "admin" && target.role === "admin") ||
    (b.status && b.status !== "active" && target.status === "active" && target.role === "admin");
  if (demoting) {
    const admins = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM users WHERE org_id = ? AND role = 'admin' AND status = 'active'`,
    )
      .bind(me.orgId)
      .first<{ n: number }>();
    if ((admins?.n ?? 0) <= 1) {
      return c.json({ error: "마지막 관리자는 강등/비활성화할 수 없습니다." }, 400);
    }
  }
  // 자기 자신 비활성화 방지
  if (id === me.userId && b.status && b.status !== "active") {
    return c.json({ error: "본인 계정은 비활성화할 수 없습니다." }, 400);
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.role === "admin" || b.role === "member") {
    sets.push("role = ?");
    vals.push(b.role);
  }
  if (b.status === "active" || b.status === "invited" || b.status === "inactive") {
    sets.push("status = ?");
    vals.push(b.status);
  }
  if (typeof b.department === "string") {
    sets.push("department = ?");
    vals.push(b.department.trim() || null);
  }
  if (typeof b.name === "string" && b.name.trim()) {
    sets.push("name = ?");
    vals.push(b.name.trim());
  }
  if (!sets.length) return c.json({ error: "변경할 내용이 없습니다." }, 400);

  vals.push(id);
  await c.env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals)
    .run();
  return c.json({ ok: true });
});
