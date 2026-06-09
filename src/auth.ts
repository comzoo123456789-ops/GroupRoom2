import { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Bindings, User } from './types';

/** SHA-256 hash using Web Crypto API (Cloudflare Workers compatible) */
export async function sha256(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expiresAt).run();
  return token;
}

export async function getUserFromToken(db: D1Database, token: string): Promise<User | null> {
  if (!token) return null;
  const row = await db.prepare(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first<User>();
  return row || null;
}

export async function authMiddleware(c: Context<{ Bindings: Bindings, Variables: { user: User } }>, next: Next) {
  const token = getCookie(c, 'session') || '';
  const user = await getUserFromToken(c.env.DB, token);
  if (!user) {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.redirect('/login');
  }
  c.set('user', user);
  await next();
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, 'session', { path: '/' });
}
