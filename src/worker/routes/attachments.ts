import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types";
import { currentUser } from "../lib/session";
import { newId } from "../lib/crypto";
import type { Attachment } from "../../shared/types";

// /api/reservations 에 마운트. 예약 첨부파일을 KV에 저장하고 24시간 후 자동 만료(삭제).
export const attachments = new Hono<{ Bindings: Env }>();

const TTL_SECONDS = 24 * 60 * 60; // 하루 뒤 자동 삭제
const MAX_BYTES = 10 * 1024 * 1024; // 파일당 10MB

interface AttachMeta {
  filename: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  orgId: string;
  createdAt: number;
}

const keyOf = (rid: string, aid: string) => `att:${rid}:${aid}`;

/** 예약이 사용자 조직 소속인지 확인하고 (있으면) 소유자/관리자 여부 반환 */
async function loadRes(c: Context<{ Bindings: Env }>, rid: string) {
  const user = await currentUser(c);
  if (!user) return { user: null, res: null };
  const res = await c.env.DB.prepare(
    `SELECT user_id FROM reservations WHERE id = ? AND org_id = ?`,
  )
    .bind(rid, user.orgId)
    .first<{ user_id: string }>();
  return { user, res };
}

// 업로드 (소유자 또는 관리자)
attachments.post("/:rid/attachments", async (c) => {
  const rid = c.req.param("rid");
  const { user, res } = await loadRes(c, rid);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (!res) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);
  if (res.user_id !== user.userId && user.role !== "admin") {
    return c.json({ error: "첨부 권한이 없습니다." }, 403);
  }

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return c.json({ error: "파일이 없습니다." }, 400);
  }
  if (file.size === 0) return c.json({ error: "빈 파일입니다." }, 400);
  if (file.size > MAX_BYTES) {
    return c.json({ error: "파일이 너무 큽니다 (최대 10MB)." }, 413);
  }

  const aid = newId();
  const createdAt = Date.now();
  const meta: AttachMeta = {
    filename: file.name || "file",
    contentType: file.type || "application/octet-stream",
    size: file.size,
    uploadedBy: user.userId,
    orgId: user.orgId,
    createdAt,
  };
  await c.env.ATTACH_KV.put(keyOf(rid, aid), await file.arrayBuffer(), {
    metadata: meta,
    expirationTtl: TTL_SECONDS,
  });

  const attachment: Attachment = {
    id: aid,
    filename: meta.filename,
    contentType: meta.contentType,
    size: meta.size,
    createdAt,
    expiresAt: createdAt + TTL_SECONDS * 1000,
  };
  return c.json({ ok: true, attachment }, 201);
});

// 목록 (같은 조직 로그인 사용자)
attachments.get("/:rid/attachments", async (c) => {
  const rid = c.req.param("rid");
  const { user, res } = await loadRes(c, rid);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (!res) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);

  const list = await c.env.ATTACH_KV.list<AttachMeta>({ prefix: `att:${rid}:` });
  const items: Attachment[] = list.keys
    .filter((k) => k.metadata)
    .map((k) => {
      const m = k.metadata as AttachMeta;
      return {
        id: k.name.split(":")[2],
        filename: m.filename,
        contentType: m.contentType,
        size: m.size,
        createdAt: m.createdAt,
        expiresAt: m.createdAt + TTL_SECONDS * 1000,
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);
  return c.json({ attachments: items });
});

// 다운로드 (같은 조직 로그인 사용자) — <a href>로 열림
attachments.get("/:rid/attachments/:aid/download", async (c) => {
  const rid = c.req.param("rid");
  const aid = c.req.param("aid");
  const { user, res } = await loadRes(c, rid);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (!res) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);

  const obj = await c.env.ATTACH_KV.getWithMetadata<AttachMeta>(keyOf(rid, aid), "arrayBuffer");
  if (!obj.value || !obj.metadata) {
    return c.json({ error: "파일이 없거나 만료되었습니다." }, 404);
  }
  const m = obj.metadata;
  const encoded = encodeURIComponent(m.filename);
  return new Response(obj.value, {
    headers: {
      "Content-Type": m.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
});

// 삭제 (소유자 또는 관리자)
attachments.delete("/:rid/attachments/:aid", async (c) => {
  const rid = c.req.param("rid");
  const aid = c.req.param("aid");
  const { user, res } = await loadRes(c, rid);
  if (!user) return c.json({ error: "로그인이 필요합니다." }, 401);
  if (!res) return c.json({ error: "예약을 찾을 수 없습니다." }, 404);
  if (res.user_id !== user.userId && user.role !== "admin") {
    return c.json({ error: "삭제 권한이 없습니다." }, 403);
  }
  await c.env.ATTACH_KV.delete(keyOf(rid, aid));
  return c.json({ ok: true });
});
