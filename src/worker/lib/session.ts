import type { Context } from "hono";
import type { Env } from "../types";

export interface SessionUser {
  userId: string;
  orgId: string;
  role: string;
  name: string;
}

const DEMO_ORG_SLUG = "demo";

/** 쿠키의 세션 토큰으로 현재 사용자 조회 (없거나 만료면 null) */
export async function currentUser(
  c: Context<{ Bindings: Env }>,
): Promise<SessionUser | null> {
  const cookie = c.req.header("Cookie") ?? "";
  const m = cookie.match(/gr_session=([^;]+)/);
  if (!m) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id AS userId, u.org_id AS orgId, u.role AS role, u.name AS name, s.expires_at AS exp
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
  )
    .bind(m[1])
    .first<{
      userId: string;
      orgId: string;
      role: string;
      name: string;
      exp: number;
    }>();
  if (!row || row.exp < Date.now()) return null;
  return { userId: row.userId, orgId: row.orgId, role: row.role, name: row.name };
}

/**
 * 현재 요청의 조직 id 결정.
 * 로그인 상태면 사용자의 org, 아니면 데모 조직(demo)으로 폴백 —
 * 데모 현황판을 로그인 없이도 보여주기 위함. (판매 배포 시 폴백 제거)
 */
export async function resolveOrgId(
  c: Context<{ Bindings: Env }>,
): Promise<string | null> {
  const user = await currentUser(c);
  if (user) return user.orgId;
  const org = await c.env.DB.prepare(
    `SELECT id FROM organizations WHERE slug = ?`,
  )
    .bind(DEMO_ORG_SLUG)
    .first<{ id: string }>();
  return org?.id ?? null;
}
