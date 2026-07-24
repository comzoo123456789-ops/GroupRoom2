// Cloudflare 바인딩(Env). wrangler.jsonc의 바인딩과 1:1 대응.
export interface Env {
  DB: D1Database;
  ROOM_HUB: DurableObjectNamespace;
}
