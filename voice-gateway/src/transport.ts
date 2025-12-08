import WebSocket from "ws";
import http from "http";
import { ServerToClientMessage } from "./messageTypes";
import { SessionManager } from "./sessionManager";

const MAX_WS_PAYLOAD_BYTES = Number(process.env.MAX_WS_PAYLOAD_BYTES || 262144); // ~256KB guardrail
const HEALTH_PATH = "/health";

export type ClientContext = {
  joined: boolean;
  sessionId: string | null;
  role: "presenter" | "participant" | null;
};

export function createTransport(opts: {
  port: number;
  handleMessage: (ws: WebSocket, ctx: ClientContext, raw: WebSocket.RawData) => void;
  sessionManager: SessionManager;
  log: (...args: any[]) => void;
  logError: (...args: any[]) => void;
  logEvent: (type: string, payload?: Record<string, any>) => void;
}) {
  const { port, handleMessage, sessionManager, log, logEvent, logError } = opts;
  const server = http.createServer();
  const wss = new WebSocket.Server({ server, path: "/ws/voice" });

  server.on("request", (req, res) => {
    if (req.url === HEALTH_PATH) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  wss.on("connection", (ws) => {
    const ctx: ClientContext = { joined: false, sessionId: null, role: null };

    ws.on("message", (data) => {
      if (typeof data === "string") {
        if (Buffer.byteLength(data, "utf8") > MAX_WS_PAYLOAD_BYTES) {
          send(ws, { type: "error", message: "Payload too large" });
          ws.close();
          return;
        }
      } else if (data instanceof Buffer || Array.isArray(data)) {
        const bytes = data instanceof Buffer ? data.byteLength : Buffer.byteLength(Buffer.from(data as any));
        if (bytes > MAX_WS_PAYLOAD_BYTES) {
          send(ws, { type: "error", message: "Payload too large" });
          ws.close();
          return;
        }
      }
      void handleMessage(ws, ctx, data);
    });

    ws.on("close", () => {
      if (ctx.joined && ctx.sessionId && ctx.role) {
        sessionManager.removeClient(ctx.sessionId, ctx.role, ws);
        log("Client disconnected", ctx.sessionId, ctx.role);
        logEvent("ws.disconnect", { sessionId: ctx.sessionId, role: ctx.role });
      }
    });

    ws.on("error", (err) => {
      logError("Socket error", err);
    });
  });

  server.listen(port, () => {
    log(`Voice gateway listening on :${port} (path: /ws/voice)`);
  });
}

export function send(ws: WebSocket, msg: ServerToClientMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
