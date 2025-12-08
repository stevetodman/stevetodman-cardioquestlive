import WebSocket from "ws";
import { ClientContext, send } from "./transport";
import { CharacterId, ClientToServerMessage } from "./messageTypes";
import { SessionManager } from "./sessionManager";
import { log, logError, logEvent } from "./logger";

type MessageHandler = (simId: string, parsed: ClientToServerMessage, ws: WebSocket) => void;

export function makeOrchestrator(opts: {
  sessionManager: SessionManager;
  handleMessage: MessageHandler;
}) {
  const { sessionManager, handleMessage } = opts;

  return async function orchestrate(ws: WebSocket, ctx: ClientContext, raw: WebSocket.RawData) {
    let parsedRaw: any;
    try {
      parsedRaw = JSON.parse(raw.toString());
    } catch (err) {
      logError("Invalid JSON", err);
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    const parsed = parsedRaw as ClientToServerMessage;
    if (!parsed?.type) {
      send(ws, { type: "error", message: "Invalid message shape" });
      return;
    }

    if (parsed.type === "join") {
      if (!parsed.sessionId || !parsed.userId || !parsed.role) {
        send(ws, { type: "error", message: "Missing join fields" });
        return;
      }
      ctx.joined = true;
      ctx.sessionId = parsed.sessionId;
      ctx.role = parsed.role;
      sessionManager.addClient(parsed.sessionId, parsed.role, ws);
      send(ws, { type: "joined", sessionId: parsed.sessionId, role: parsed.role });
      logEvent("ws.join", { sessionId: parsed.sessionId, role: parsed.role, userId: parsed.userId });
      log("Client joined", parsed.sessionId, parsed.role, parsed.userId);
      return;
    }

    if (!ctx.joined || !ctx.sessionId || !ctx.role) {
      send(ws, { type: "error", message: "Must join first" });
      return;
    }

    const simId = ctx.sessionId as string;
    await handleMessage(simId, parsed, ws);
  };
}
