import type { LiveEvent } from "../../shared/types";

/**
 * RoomHub — 조직(테넌트)별 실시간 허브.
 * WebSocket으로 접속한 현황판 클라이언트들에게 예약 변경을 즉시 브로드캐스트한다.
 * Hibernation WebSocket API 사용 → 유휴 시 과금 없이 연결 유지.
 */
export class RoomHub {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 클라이언트 WebSocket 접속
    if (url.pathname.endsWith("/ws")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      const hello: LiveEvent = { type: "hello", at: Date.now() };
      server.send(JSON.stringify(hello));
      return new Response(null, { status: 101, webSocket: client });
    }

    // 서버(워커)에서 밀어넣는 브로드캐스트
    if (request.method === "POST" && url.pathname.endsWith("/broadcast")) {
      const body = await request.text();
      this.broadcast(body);
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  }

  private broadcast(message: string): void {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        // 끊긴 소켓 무시
      }
    }
  }

  // Hibernation 콜백 -------------------------------------------------------
  webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): void {
    // 클라이언트 메시지는 전체에 중계 (프레즌스/타이핑 등 확장 지점)
    if (typeof message === "string") this.broadcast(message);
  }

  webSocketClose(ws: WebSocket, code: number): void {
    try {
      ws.close(code >= 1000 && code < 5000 ? code : 1000);
    } catch {
      // noop
    }
  }
}
