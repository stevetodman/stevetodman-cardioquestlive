import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { SessionManager } from "./sessionManager";
import { ClientToServerMessage, ServerToClientMessage } from "./messageTypes";
import { log, logError } from "./logger";

const PORT = Number(process.env.PORT || 8081);
const sessionManager = new SessionManager();

type ClientContext = {
  joined: boolean;
  sessionId: string | null;
  role: "presenter" | "participant" | null;
};

function send(ws: WebSocket, msg: ServerToClientMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(ws: WebSocket, ctx: ClientContext, raw: WebSocket.RawData) {
  let parsed: ClientToServerMessage;
  try {
    parsed = JSON.parse(raw.toString());
  } catch (err) {
    logError("Invalid JSON", err);
    send(ws, { type: "error", message: "Invalid JSON" });
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
    log("Client joined", parsed.sessionId, parsed.role, parsed.userId);
    return;
  }

  if (!ctx.joined || !ctx.sessionId || !ctx.role) {
    send(ws, { type: "error", message: "Must join first" });
    return;
  }

  switch (parsed.type) {
    case "start_speaking": {
      sessionManager.broadcastToSession(ctx.sessionId, {
        type: "participant_state",
        sessionId: ctx.sessionId,
        userId: parsed.userId,
        speaking: true,
      });
      break;
    }
    case "stop_speaking": {
      sessionManager.broadcastToSession(ctx.sessionId, {
        type: "participant_state",
        sessionId: ctx.sessionId,
        userId: parsed.userId,
        speaking: false,
      });
      break;
    }
    case "voice_command": {
      log("Voice command", parsed.commandType, "by", parsed.userId, "session", ctx.sessionId);
      if (parsed.commandType === "force_reply") {
        sessionManager.broadcastToSession(ctx.sessionId, {
          type: "patient_state",
          sessionId: ctx.sessionId,
          state: "speaking",
        });
        sessionManager.broadcastToSession(ctx.sessionId, {
          type: "patient_transcript_delta",
          sessionId: ctx.sessionId,
          text: "Hi doctor, I’m here as a test patient.",
        });
      } else if (parsed.commandType === "pause_ai") {
        sessionManager.broadcastToSession(ctx.sessionId, {
          type: "patient_state",
          sessionId: ctx.sessionId,
          state: "idle",
        });
      } else if (parsed.commandType === "resume_ai") {
        sessionManager.broadcastToSession(ctx.sessionId, {
          type: "patient_state",
          sessionId: ctx.sessionId,
          state: "listening",
        });
      } else if (parsed.commandType === "end_turn") {
        sessionManager.broadcastToSession(ctx.sessionId, {
          type: "patient_state",
          sessionId: ctx.sessionId,
          state: "idle",
        });
      }
      // mute_user currently no-op beyond log
      break;
    }
    case "ping": {
      send(ws, { type: "pong" });
      break;
    }
    default: {
      send(ws, { type: "error", message: "Unknown message type" });
    }
  }
}

function main() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server, path: "/ws/voice" });

  wss.on("connection", (ws) => {
    const ctx: ClientContext = { joined: false, sessionId: null, role: null };

    ws.on("message", (data) => handleMessage(ws, ctx, data));

    ws.on("close", () => {
      if (ctx.joined && ctx.sessionId && ctx.role) {
        sessionManager.removeClient(ctx.sessionId, ctx.role, ws);
        log("Client disconnected", ctx.sessionId, ctx.role);
      }
    });

    ws.on("error", (err) => {
      logError("Socket error", err);
    });
  });

  server.listen(PORT, () => {
    log(`Voice gateway listening on :${PORT} (path: /ws/voice)`);
  });
}

main();
