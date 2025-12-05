import WebSocket from "ws";
import { ServerToClientMessage } from "./messageTypes";

type SessionSockets = {
  presenters: Set<WebSocket>;
  participants: Set<WebSocket>;
};

export class SessionManager {
  private sessions: Map<string, SessionSockets> = new Map();

  private ensureSession(sessionId: string): SessionSockets {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { presenters: new Set(), participants: new Set() });
    }
    return this.sessions.get(sessionId)!;
  }

  addClient(sessionId: string, role: "presenter" | "participant", ws: WebSocket) {
    const session = this.ensureSession(sessionId);
    if (role === "presenter") {
      session.presenters.add(ws);
    } else {
      session.participants.add(ws);
    }
  }

  removeClient(sessionId: string, role: "presenter" | "participant", ws: WebSocket) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (role === "presenter") {
      session.presenters.delete(ws);
    } else {
      session.participants.delete(ws);
    }
    if (session.presenters.size === 0 && session.participants.size === 0) {
      this.sessions.delete(sessionId);
    }
  }

  broadcastToSession(sessionId: string, msg: ServerToClientMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const payload = JSON.stringify(msg);
    [...session.presenters, ...session.participants].forEach((sock) => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(payload);
      }
    });
  }

  broadcastToPresenters(sessionId: string, msg: ServerToClientMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const payload = JSON.stringify(msg);
    session.presenters.forEach((sock) => {
      if (sock.readyState === WebSocket.OPEN) sock.send(payload);
    });
  }

  broadcastToParticipants(sessionId: string, msg: ServerToClientMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const payload = JSON.stringify(msg);
    session.participants.forEach((sock) => {
      if (sock.readyState === WebSocket.OPEN) sock.send(payload);
    });
  }
}
