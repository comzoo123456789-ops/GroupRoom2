import { Hono } from 'hono';
import { renderer } from './renderer';
import { authMiddleware } from './auth';
import authApi from './api/auth';
import spacesApi from './api/spaces';
import reservationsApi from './api/reservations';
import membersApi from './api/members';
import insightsApi from './api/insights';
import orgApi from './api/org';
import type { Bindings, User } from './types';

import { LoginPage } from './pages/login';
import { ShellPage } from './pages/shell';

const app = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

app.use(renderer);

// Favicon (inline SVG to avoid 404)
app.get('/favicon.svg', (c) => {
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d1d1f"/><g fill="#fff"><rect x="14" y="22" width="8" height="28" rx="2"/><rect x="28" y="14" width="8" height="36" rx="2"/></g><rect x="42" y="34" width="8" height="16" rx="2" fill="#0066cc"/></svg>',
    { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } }
  );
});
app.get('/favicon.ico', (c) => c.redirect('/favicon.svg'));

// ============================================
// API ROUTES
// ============================================
app.route('/api/auth', authApi);
app.use('/api/spaces/*', authMiddleware);
app.route('/api/spaces', spacesApi);
app.use('/api/reservations/*', authMiddleware);
app.route('/api/reservations', reservationsApi);
app.use('/api/members/*', authMiddleware);
app.route('/api/members', membersApi);
app.use('/api/insights/*', authMiddleware);
app.route('/api/insights', insightsApi);
app.use('/api/org/*', authMiddleware);
app.route('/api/org', orgApi);

// ============================================
// PAGES
// ============================================
app.get('/login', (c) => c.render(<LoginPage />, { title: '로그인 · 메이트리그라운드' }));

// 보호된 페이지 - 모든 경로는 SPA 셸에서 처리
app.use('/', authMiddleware);
app.use('/home', authMiddleware);
app.use('/spaces', authMiddleware);
app.use('/insights', authMiddleware);
app.use('/admin/*', authMiddleware);

app.get('/', (c) => c.redirect('/home'));
app.get('/home', (c) => c.render(<ShellPage page="home" />, { title: '홈 · 메이트리그라운드' }));
app.get('/spaces', (c) => c.render(<ShellPage page="spaces" />, { title: '공간 · 메이트리그라운드' }));
app.get('/insights', (c) => c.render(<ShellPage page="insights" />, { title: '인사이트 · 메이트리그라운드' }));
app.get('/admin/members', (c) => c.render(<ShellPage page="admin-members" />, { title: '관리 · 멤버' }));
app.get('/admin/general', (c) => c.render(<ShellPage page="admin-general" />, { title: '관리 · 일반' }));
app.get('/admin/spaces', (c) => c.render(<ShellPage page="admin-spaces" />, { title: '관리 · 공간' }));
app.get('/admin/org', (c) => c.render(<ShellPage page="admin-org" />, { title: '관리 · 부서/직책' }));

export default app;
