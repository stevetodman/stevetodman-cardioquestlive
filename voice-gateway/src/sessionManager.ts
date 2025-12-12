import WebSocket from "ws";
import { ServerToClientMessage } from "./messageTypes";

type SessionSockets = {
  presenters: Set<WebSocket>;
  participants: Set<WebSocket>;
  floorHolder?: string;
  fallback: boolean;
};

export class SessionManager {
  private sessions: Map<string, SessionSockets> = new Map();
  private onSessionEmptyCallback?: (sessionId: string) => void;

  /** Register callback to be notified when a session has no more clients */
  onSessionEmpty(callback: (sessionId: string) => void) {
    this.onSessionEmptyCallback = callback;
  }

  private ensureSession(sessionId: string): SessionSockets {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        presenters: new Set(),
        participants: new Set(),
        floorHolder: undefined,
        fallback: false,
      });
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
      this.onSessionEmptyCallback?.(sessionId);
    }
  }

  requestFloor(sessionId: string, userId: string): { granted: boolean; previous?: string } {
    const session = this.ensureSession(sessionId);
    if (!session.floorHolder || session.floorHolder === userId) {
      const previous = session.floorHolder;
      session.floorHolder = userId;
      return { granted: true, previous };
    }
    return { granted: false, previous: session.floorHolder };
  }

  releaseFloor(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.floorHolder !== userId) return false;
    session.floorHolder = undefined;
    return true;
  }

  getFloorHolder(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.floorHolder;
  }

  setFallback(sessionId: string, fallback: boolean) {
    const session = this.ensureSession(sessionId);
    session.fallback = fallback;
  }

  isFallback(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.fallback ?? false;
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
