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
    },
  });
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
    },
  });
});

export default auth;
