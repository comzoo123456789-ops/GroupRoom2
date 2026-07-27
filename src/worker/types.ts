// Cloudflare 바인딩(Env). wrangler.jsonc의 바인딩과 1:1 대응.
// Cloudflare Email Sending 바인딩 (send_email)
export interface SendEmailBinding {
  send(message: {
    to: string;
    from: { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  ROOM_HUB: DurableObjectNamespace;
  ATTACH_KV: KVNamespace;
  EMAIL?: SendEmailBinding; // 도메인 온보딩 전엔 미설정일 수 있음
  EMAIL_FROM?: string; // 발신 주소 (온보딩된 도메인)
}
