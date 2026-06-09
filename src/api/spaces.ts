import { Hono } from 'hono';
import type { Bindings, User, Space } from '../types';

const spaces = new Hono<{ Bindings: Bindings, Variables: { user: User } }>();

spaces.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM spaces ORDER BY display_order ASC'
  ).all<Space>();
  return c.json({ spaces: result.results });
});

export default spaces;
