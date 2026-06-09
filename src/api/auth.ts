import { Hono } from 'hono';
import { sha256, createSession, setSessionCookie, clearSessionCookie, getUserFromToken } from '../auth';
import { getCookie } from 'hono/cookie';
import type { Bindings, User } from '../types';

const auth = new Hono<{ Bindings: Bindings }>();

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) return c.json({ error: '이메일과 비밀번호를 입력해 주세요.' }, 400);

  const hashed = await sha256(password);
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ? AND password = ? AND status = 'active'"
  ).bind(email, hashed).first<User>();

  if (!user) return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);

  const token = await createSession(c.env.DB, user.id);
  setSessionCookie(c, token);

  return c.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
      department: user.department,
      position: user.position,
      avatar_color: user.avatar_color,
      is_first_login: user.is_first_login || 0, // V5 REQ-SEC-01
    },
  });
});

/**
 * V5 REQ-SEC-01: 최초 로그인 시 비밀번호 강제 변경
 * - 본인 비밀번호만 변경 가능
 * - 변경 성공 시 is_first_login 플래그를 0으로 업데이트
 */
auth.post('/change-password', async (c) => {
  const token = getCookie(c, 'session') || '';
  const me = await getUserFromToken(c.env.DB, token);
  if (!me) return c.json({ error: 'Unauthorized' }, 401);

  const { current_password, new_password } = await c.req.json<{ current_password?: string; new_password: string }>();
  if (!new_password || new_password.length < 8) {
    return c.json({ error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);
  }

  // 최초 로그인이 아닌 경우 현재 비밀번호 검증 필수
  if (!me.is_first_login) {
    if (!current_password) {
      return c.json({ error: '현재 비밀번호를 입력해 주세요.' }, 400);
    }
    const currentHash = await sha256(current_password);
    const row = await c.env.DB.prepare('SELECT password FROM users WHERE id = ?').bind(me.id).first<{ password: string }>();
    if (!row || row.password !== currentHash) {
      return c.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, 401);
    }
  }

  const newHash = await sha256(new_password);
  await c.env.DB.prepare(
    'UPDATE users SET password = ?, is_first_login = 0 WHERE id = ?'
  ).bind(newHash, me.id).run();

  return c.json({ ok: true });
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, 'session') || '';
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  const token = getCookie(c, 'session') || '';
  const user = await getUserFromToken(c.env.DB, token);
  if (!user) return c.json({ user: null }, 200);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
      department: user.department,
      position: user.position,
      avatar_color: user.avatar_color,
      is_first_login: user.is_first_login || 0, // V5 REQ-SEC-01
    },
  });
});

export default auth;
