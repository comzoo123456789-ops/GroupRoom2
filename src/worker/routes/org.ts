import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types";
import { currentUser, resolveOrgId } from "../lib/session";
import { newId } from "../lib/crypto";
import type { OrgMaster } from "../../shared/types";

// 부서/직급 마스터 관리. /api/org 에 마운트.
export const org = new Hono<{ Bindings: Env }>();

// 테이블 ↔ users 컬럼 매핑 (부서=department, 직급=position)
const MAP = {
  departments: { table: "departments", col: "department" },
  positions: { table: "positions", col: "position" },
} as const;
type Kind = keyof typeof MAP;

async function requireAdmin(c: Context<{ Bindings: Env }>) {
  const u = await currentUser(c);
  if (!u) return { error: c.json({ error: "로그인이 필요합니다." }, 401), user: null };
  if (u.role !== "admin") return { error: c.json({ error: "관리자만 가능합니다." }, 403), user: null };
  return { error: null, user: u };
}

async function list(c: Context<{ Bindings: Env }>, kind: Kind): Promise<OrgMaster[]> {
  const orgId = await resolveOrgId(c);
  if (!orgId) return [];
  const rows = await c.env.DB.prepare(
    `SELECT id, name FROM ${MAP[kind].table} WHERE org_id = ? ORDER BY sort, name`,
  )
    .bind(orgId)
    .all<OrgMaster>();
  return rows.results;
}

// 부서+직급 한 번에 조회 (로그인 사용자)
org.get("/masters", async (c) => {
  const [departments, positions] = await Promise.all([list(c, "departments"), list(c, "positions")]);
  return c.json({ departments, positions });
});

org.get("/:kind", async (c) => {
  const kind = c.req.param("kind") as Kind;
  if (!MAP[kind]) return c.json({ error: "not found" }, 404);
  return c.json({ items: await list(c, kind) });
});

// 추가
org.post("/:kind", async (c) => {
  const kind = c.req.param("kind") as Kind;
  if (!MAP[kind]) return c.json({ error: "not found" }, 404);
  const { error, user } = await requireAdmin(c);
  if (error) return error;

  const b = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const name = b.name?.trim();
  if (!name) return c.json({ error: "이름을 입력하세요." }, 400);

  const dup = await c.env.DB.prepare(
    `SELECT 1 FROM ${MAP[kind].table} WHERE org_id = ? AND name = ?`,
  )
    .bind(user!.orgId, name)
    .first();
  if (dup) return c.json({ error: "이미 있는 이름입니다." }, 409);

  const max = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort), -1) AS m FROM ${MAP[kind].table} WHERE org_id = ?`,
  )
    .bind(user!.orgId)
    .first<{ m: number }>();
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO ${MAP[kind].table} (id, org_id, name, sort, created_at) VALUES (?,?,?,?,?)`,
  )
    .bind(id, user!.orgId, name, (max?.m ?? -1) + 1, Date.now())
    .run();
  return c.json({ ok: true, id, name }, 201);
});

// 이름 수정 (기존 이름을 쓰는 멤버들도 함께 갱신)
org.patch("/:kind/:id", async (c) => {
  const kind = c.req.param("kind") as Kind;
  if (!MAP[kind]) return c.json({ error: "not found" }, 404);
  const { error, user } = await requireAdmin(c);
  if (error) return error;
  const id = c.req.param("id");

  const cur = await c.env.DB.prepare(
    `SELECT name FROM ${MAP[kind].table} WHERE id = ? AND org_id = ?`,
  )
    .bind(id, user!.orgId)
    .first<{ name: string }>();
  if (!cur) return c.json({ error: "항목을 찾을 수 없습니다." }, 404);

  const b = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const name = b.name?.trim();
  if (!name) return c.json({ error: "이름을 입력하세요." }, 400);
  if (name === cur.name) return c.json({ ok: true });

  const dup = await c.env.DB.prepare(
    `SELECT 1 FROM ${MAP[kind].table} WHERE org_id = ? AND name = ? AND id <> ?`,
  )
    .bind(user!.orgId, name, id)
    .first();
  if (dup) return c.json({ error: "이미 있는 이름입니다." }, 409);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE ${MAP[kind].table} SET name = ? WHERE id = ?`).bind(name, id),
    c.env.DB.prepare(
      `UPDATE users SET ${MAP[kind].col} = ? WHERE org_id = ? AND ${MAP[kind].col} = ?`,
    ).bind(name, user!.orgId, cur.name),
  ]);
  return c.json({ ok: true });
});

// 삭제 (해당 이름을 쓰던 멤버는 값 비움)
org.delete("/:kind/:id", async (c) => {
  const kind = c.req.param("kind") as Kind;
  if (!MAP[kind]) return c.json({ error: "not found" }, 404);
  const { error, user } = await requireAdmin(c);
  if (error) return error;
  const id = c.req.param("id");

  const cur = await c.env.DB.prepare(
    `SELECT name FROM ${MAP[kind].table} WHERE id = ? AND org_id = ?`,
  )
    .bind(id, user!.orgId)
    .first<{ name: string }>();
  if (!cur) return c.json({ error: "항목을 찾을 수 없습니다." }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM ${MAP[kind].table} WHERE id = ?`).bind(id),
    c.env.DB.prepare(
      `UPDATE users SET ${MAP[kind].col} = NULL WHERE org_id = ? AND ${MAP[kind].col} = ?`,
    ).bind(user!.orgId, cur.name),
  ]);
  return c.json({ ok: true });
});
