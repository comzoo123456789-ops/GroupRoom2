/**
 * V11 §3-3: 테넌트(회사) API — 일정 컬러 팔레트 격리 제어
 *
 * 엔드포인트:
 *  - GET    /api/tenants        : 모든 테넌트 목록 (id, name, color, schedule_color)
 *  - PATCH  /api/tenants/:id    : 특정 테넌트의 schedule_color 수정 (admin only)
 *
 * 격리 원칙:
 *  - WYLIE 팔레트 조작은 id='WYLIE' 레코드만 PATCH
 *  - LUSH 팔레트 조작은 id='LUSH' 레코드만 PATCH
 *  - 한 쪽 수정이 다른 쪽에 절대 간섭 못함 (WHERE id=? 단건 업데이트)
 */
import { Hono } from 'hono';
import type { Bindings, User } from '../types';

const tenants = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

interface TenantRow {
  id: string;
  name: string;
  color: string;
  schedule_color: string;
  created_at: string;
}

/** GET /api/tenants — 인증된 모든 사용자가 조회 가능 (예약 블록 컬러 렌더링용) */
tenants.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, name, color, schedule_color, created_at FROM tenants ORDER BY id ASC`
  ).all<TenantRow>();
  return c.json({ tenants: result.results || [] });
});

/** PATCH /api/tenants/:id — admin only. schedule_color만 수정 가능 */
tenants.patch('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: '관리자만 접근할 수 있습니다.' }, 403);
  }

  const id = String(c.req.param('id') || '').toUpperCase();
  // 화이트리스트 — 알려진 테넌트만 허용 (SQL 인젝션 추가 방어)
  const ALLOWED = ['WYLIE', 'LUSH'];
  if (!ALLOWED.includes(id)) {
    return c.json({ error: '허용되지 않는 테넌트 ID 입니다.' }, 400);
  }

  const body = await c.req.json<{ schedule_color?: string }>().catch(() => ({}));
  const sc = body?.schedule_color;
  if (!sc || typeof sc !== 'string') {
    return c.json({ error: 'schedule_color 가 필요합니다.' }, 400);
  }
  // HEX 형식 검증 (#fff 또는 #ffffff)
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(sc)) {
    return c.json({ error: '올바른 HEX 컬러 형식이 아닙니다.' }, 400);
  }

  // 단건 업데이트 — 다른 테넌트는 절대 건드리지 않음
  const result = await c.env.DB.prepare(
    `UPDATE tenants SET schedule_color = ? WHERE id = ?`
  ).bind(sc, id).run();

  if (!result.meta?.changes) {
    return c.json({ error: '대상 테넌트를 찾을 수 없습니다.' }, 404);
  }

  return c.json({ ok: true, id, schedule_color: sc });
});

export default tenants;
