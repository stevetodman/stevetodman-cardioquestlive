import { ClientRole, ClientToServerMessage, ServerToClientMessage, PatientState, GatewayStatus } from "../types/voiceGateway";

type PatientStateListener = (state: PatientState) => void;
type TranscriptListener = (text: string) => void;
type ParticipantStateListener = (info: { userId: string; speaking: boolean }) => void;
type StatusListener = (status: GatewayStatus) => void;

const DEFAULT_URL =
  (typeof globalThis !== "undefined" && (globalThis as any).__VITE_VOICE_GATEWAY_URL) ||
  (typeof process !== "undefined" ? process.env.VITE_VOICE_GATEWAY_URL : undefined) ||
  "ws://localhost:8081/ws/voice";
const WebSocketCtor: typeof WebSocket | undefined =
  typeof WebSocket !== "undefined"
    ? WebSocket
    : typeof globalThis !== "undefined"
    ? (globalThis as any).WebSocket
    : undefined;

class VoiceGatewayClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private displayName: string | null = null;
  private role: ClientRole | null = null;
  private status: GatewayStatus = "disconnected";
  private patientListeners = new Set<PatientStateListener>();
  private transcriptListeners = new Set<TranscriptListener>();
  private participantListeners = new Set<ParticipantStateListener>();
  private statusListeners = new Set<StatusListener>();

  private setStatus(next: GatewayStatus) {
    this.status = next;
    this.statusListeners.forEach((cb) => cb(next));
  }

  connect(sessionId: string, userId: string, displayName: string, role: ClientRole) {
    // Reuse existing connection if it matches session/user and is healthy
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) &&
      this.sessionId === sessionId &&
      this.userId === userId &&
      this.role === role
    ) {
      console.debug("[voice-gateway] Reusing existing socket", { sessionId, role });
      return;
    }

    this.disconnect();
    this.sessionId = sessionId;
    this.userId = userId;
    this.displayName = displayName;
    this.role = role;

    const url = DEFAULT_URL;
    if (!WebSocketCtor) {
      console.warn("WebSocket not available in this environment");
      this.setStatus("disconnected");
      return;
    }
    try {
      this.ws = new WebSocketCtor(url);
      console.debug("[voice-gateway] Creating socket", url);
    } catch (err) {
      console.error("Failed to create WebSocket", err);
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("connecting");

    this.ws.onopen = () => {
      this.setStatus("connected");
      console.debug("[voice-gateway] socket open");
      this.send({
        type: "join",
        sessionId,
        userId,
        displayName,
        role,
      });
    };

    this.ws.onmessage = (evt) => {
      this.handleMessage(evt.data);
    };

    this.ws.onerror = (err) => {
      console.error("Voice gateway socket error", err);
    };

    this.ws.onclose = (event) => {
      console.debug("[voice-gateway] socket close", { code: event.code, reason: event.reason });
      this.setStatus("disconnected");
      this.ws = null;
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
    this.sessionId = null;
    this.userId = null;
    this.displayName = null;
    this.role = null;
    this.setStatus("disconnected");
  }

  private send(msg: ClientToServerMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.debug("[voice-gateway] send skipped; socket not open", this.ws?.readyState);
      return;
    }
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error("Failed to send WS message", err);
    }
  }

  startSpeaking() {
    if (!this.sessionId || !this.userId) return;
    this.send({ type: "start_speaking", sessionId: this.sessionId, userId: this.userId });
  }

  stopSpeaking() {
    if (!this.sessionId || !this.userId) return;
    this.send({ type: "stop_speaking", sessionId: this.sessionId, userId: this.userId });
  }

  sendVoiceCommand(
    commandType: "pause_ai" | "resume_ai" | "force_reply" | "end_turn" | "mute_user",
    payload?: Record<string, unknown>
  ) {
    if (!this.sessionId || !this.userId) return;
    this.send({
      type: "voice_command",
      sessionId: this.sessionId,
      userId: this.userId,
      commandType,
      payload,
    });
  }

  onPatientState(cb: PatientStateListener) {
    this.patientListeners.add(cb);
    return () => this.patientListeners.delete(cb);
  }

  onPatientTranscriptDelta(cb: TranscriptListener) {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  onParticipantState(cb: ParticipantStateListener) {
    this.participantListeners.add(cb);
    return () => this.participantListeners.delete(cb);
  }

  onStatus(cb: StatusListener) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  private handleMessage(raw: any) {
    let msg: ServerToClientMessage;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw?.toString?.() ?? "");
    } catch (err) {
      console.error("Voice gateway invalid JSON", err);
      return;
    }

    switch (msg.type) {
      case "patient_state": {
        this.patientListeners.forEach((cb) => cb(msg.state));
        break;
      }
      case "patient_transcript_delta": {
        this.transcriptListeners.forEach((cb) => cb(msg.text));
        break;
      }
      case "participant_state": {
        this.participantListeners.forEach((cb) =>
          cb({ userId: msg.userId, speaking: msg.speaking })
        );
        break;
      }
      case "error": {
        console.warn("Voice gateway error", msg.message);
        break;
      }
      case "joined":
      case "pong":
      default:
        break;
    }
  }
}

export const voiceGatewayClient = new VoiceGatewayClient();
