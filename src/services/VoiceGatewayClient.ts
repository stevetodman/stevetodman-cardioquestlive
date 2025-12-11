import {
  ClientRole,
  ClientToServerMessage,
  ServerToClientMessage,
  PatientState,
  PatientScenarioId,
  DebriefTurn,
  AnalysisResult,
  VoiceConnectionStatus,
  CharacterId,
} from "../types/voiceGateway";
import { VoiceCommandType } from "../types";

type PatientStateListener = (state: PatientState, character?: CharacterId, displayName?: string) => void;
type TranscriptListener = (text: string) => void;
type ParticipantStateListener = (info: { userId: string; speaking: boolean }) => void;
type StatusListener = (status: VoiceConnectionStatus) => void;
type SimStateListener = (state: {
  stageId: string;
  stageIds?: string[];
  scenarioId?: PatientScenarioId;
  vitals: Record<string, unknown>;
  exam?: Record<string, string | undefined>;
  examAudio?: { type: "heart" | "lung"; label: string; url: string }[];
  interventions?: Record<string, unknown>;
  telemetry?: boolean;
  rhythmSummary?: string;
  telemetryWaveform?: number[];
  findings?: string[];
  fallback: boolean;
  budget?: { usdEstimate?: number; voiceSeconds?: number; throttled?: boolean; fallback?: boolean };
  orders?: any[];
  ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
  telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
}) => void;
type AudioListener = (audioUrl: string) => void;
type DoctorUtteranceListener = (text: string, userId: string, character?: CharacterId) => void;
type ScenarioListener = (scenarioId: PatientScenarioId) => void;
type AnalysisResultListener = (result: AnalysisResult) => void;
type TokenRefresher = () => Promise<string | undefined>;

const DEFAULT_URL =
  // Highest priority: explicit override injected for testing
  (typeof globalThis !== "undefined" && (globalThis as any).__VITE_VOICE_GATEWAY_URL) ||
  // Next: Node/env override if present (e.g., VITE_VOICE_GATEWAY_URL)
  (typeof process !== "undefined" && (process as any)?.env?.VITE_VOICE_GATEWAY_URL) ||
  // Fallback: derive from current host (dev/local)
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8081/ws/voice`
    : "ws://localhost:8081/ws/voice");

const WebSocketCtor: typeof WebSocket | undefined =
  typeof WebSocket !== "undefined"
    ? WebSocket
    : typeof globalThis !== "undefined"
    ? (globalThis as any).WebSocket
    : undefined;

// ============================================================================
// Configuration
// ============================================================================

const HEARTBEAT_INTERVAL_MS = 30_000; // Send ping every 30s
const HEARTBEAT_TIMEOUT_MS = 5_000;   // Expect pong within 5s
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000]; // Exponential backoff
const MAX_RECONNECT_ATTEMPTS = 10;

class VoiceGatewayClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private displayName: string | null = null;
  private role: ClientRole | null = null;
  private authToken: string | undefined = undefined;
  private connectionStatus: VoiceConnectionStatus = { state: "disconnected", lastChangedAt: Date.now() };
  private insecureMode: boolean = false;

  // Listeners
  private patientListeners = new Set<PatientStateListener>();
  private transcriptListeners = new Set<TranscriptListener>();
  private participantListeners = new Set<ParticipantStateListener>();
  private statusListeners = new Set<StatusListener>();
  private simStateListeners = new Set<SimStateListener>();
  private audioListeners = new Set<AudioListener>();
  private doctorListeners = new Set<DoctorUtteranceListener>();
  private scenarioListeners = new Set<ScenarioListener>();
  private analysisListeners = new Set<AnalysisResultListener>();
  private lastAudioUrl: string | null = null;

  // Heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastPongAt: number = 0;

  // Reconnection
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect: boolean = false;
  private tokenRefresher: TokenRefresher | null = null;
  private authRetryPending: boolean = false;

  /**
   * Set a function to refresh the auth token before reconnecting.
   * This should call Firebase auth.currentUser.getIdToken(true) or similar.
   */
  setTokenRefresher(refresher: TokenRefresher) {
    this.tokenRefresher = refresher;
  }

  private setStatus(next: VoiceConnectionStatus) {
    this.connectionStatus = { ...next, lastChangedAt: Date.now() };
    this.statusListeners.forEach((cb) => cb(this.connectionStatus));
  }

  connect(sessionId: string, userId: string, displayName: string, role: ClientRole, authToken?: string) {
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

    this.intentionalDisconnect = false;
    this.authRetryPending = false;
    this.cleanupConnection();

    this.sessionId = sessionId;
    this.userId = userId;
    this.displayName = displayName;
    this.role = role;
    this.authToken = authToken;

    // If tokenRefresher is configured and no authToken provided, try to get one first
    if (this.tokenRefresher && !this.authToken) {
      this.setStatus({ state: "connecting" });
      this.tokenRefresher()
        .then((token) => {
          if (token) {
            this.authToken = token;
            this.createConnection();
          } else {
            console.warn("[voice-gateway] Token refresher returned no token");
            this.setStatus({ state: "error", reason: "unauthorized" });
          }
        })
        .catch((err) => {
          console.warn("[voice-gateway] Token refresh failed on connect", err);
          this.setStatus({ state: "error", reason: "unauthorized" });
        });
      return;
    }

    this.createConnection();
  }

  private createConnection() {
    const url = DEFAULT_URL;
    if (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) {
      console.debug("[voice] Connecting to voice gateway:", url);
    }
    if (!WebSocketCtor) {
      console.warn("WebSocket not available in this environment");
      this.setStatus({ state: "error", reason: "unsupported" });
      return;
    }
    try {
      this.ws = new WebSocketCtor(url);
      console.debug("[voice-gateway] Creating socket", url);
    } catch (err) {
      console.error("Failed to create WebSocket", err);
      this.setStatus({ state: "error", reason: "socket_error" });
      this.scheduleReconnect();
      return;
    }

    this.setStatus({ state: "connecting" });

    this.ws.onopen = () => {
      this.setStatus({ state: "ready" });
      this.reconnectAttempts = 0; // Reset on successful connection
      console.debug("[voice-gateway] socket open");
      this.send(
        {
          type: "join",
          sessionId: this.sessionId!,
          userId: this.userId!,
          displayName: this.displayName!,
          role: this.role!,
          authToken: this.authToken,
        },
        true
      );
      this.startHeartbeat();
    };

    this.ws.onmessage = (evt) => {
      this.handleMessage(evt.data);
    };

    this.ws.onerror = (err) => {
      console.error("Voice gateway socket error", err);
      this.setStatus({ state: "error", reason: "socket_error" });
    };

    this.ws.onclose = (event) => {
      console.debug("[voice-gateway] socket close", { code: event.code, reason: event.reason });
      this.stopHeartbeat();
      this.ws = null;

      if (this.intentionalDisconnect) {
        this.setStatus({ state: "disconnected", reason: "closed" });
      } else {
        // Unexpected disconnect - try to reconnect
        this.setStatus({ state: "disconnected", reason: "connection_lost" });
        this.scheduleReconnect();
      }
    };
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.cleanupConnection();
    this.sessionId = null;
    this.userId = null;
    this.displayName = null;
    this.role = null;
    this.authToken = undefined;
    this.reconnectAttempts = 0;
    this.setStatus({ state: "disconnected" });
  }

  private cleanupConnection() {
    this.stopHeartbeat();
    this.cancelReconnect();

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
    if (this.lastAudioUrl) {
      URL.revokeObjectURL(this.lastAudioUrl);
      this.lastAudioUrl = null;
    }
    this.ws = null;
  }

  // ============================================================================
  // Heartbeat
  // ============================================================================

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastPongAt = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" } as any);

        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          const elapsed = Date.now() - this.lastPongAt;
          if (elapsed > HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS) {
            console.warn("[voice-gateway] Heartbeat timeout - connection stale, reconnecting");
            this.ws?.close();
          }
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private handlePong() {
    this.lastPongAt = Date.now();
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  // ============================================================================
  // Reconnection
  // ============================================================================

  private scheduleReconnect() {
    if (this.intentionalDisconnect) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn("[voice-gateway] Max reconnect attempts reached");
      this.setStatus({ state: "error", reason: "max_retries" });
      return;
    }

    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempts++;

    console.debug(`[voice-gateway] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.setStatus({ state: "disconnected", reason: "reconnecting" });

    this.reconnectTimeout = setTimeout(async () => {
      if (this.intentionalDisconnect) return;

      // Try to refresh token before reconnecting
      if (this.tokenRefresher) {
        try {
          const newToken = await this.tokenRefresher();
          if (newToken) {
            this.authToken = newToken;
            console.debug("[voice-gateway] Token refreshed before reconnect");
          }
        } catch (err) {
          console.warn("[voice-gateway] Token refresh failed, using existing token", err);
        }
      }

      this.createConnection();
    }, delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Handle unauthorized_token error from server.
   * Refresh token once and retry; if it fails again, set error/unauthorized and stop.
   */
  private async handleUnauthorizedToken() {
    // If we already tried refreshing and still got unauthorized, give up
    if (this.authRetryPending) {
      console.warn("[voice-gateway] Auth retry failed - unauthorized after token refresh");
      this.authRetryPending = false;
      this.intentionalDisconnect = true;
      this.cleanupConnection();
      this.setStatus({ state: "error", reason: "unauthorized" });
      return;
    }

    // Try to refresh token and reconnect once
    if (this.tokenRefresher) {
      console.debug("[voice-gateway] Unauthorized - refreshing token and retrying");
      this.authRetryPending = true;
      this.setStatus({ state: "connecting" });

      try {
        const newToken = await this.tokenRefresher();
        if (newToken) {
          this.authToken = newToken;
          console.debug("[voice-gateway] Token refreshed, reconnecting");
          this.cleanupConnection();
          this.createConnection();
          return;
        }
      } catch (err) {
        console.warn("[voice-gateway] Token refresh failed", err);
      }
    }

    // No token refresher or refresh failed - give up
    console.warn("[voice-gateway] Cannot refresh token - unauthorized");
    this.authRetryPending = false;
    this.intentionalDisconnect = true;
    this.cleanupConnection();
    this.setStatus({ state: "error", reason: "unauthorized" });
  }

  /**
   * Manually trigger a reconnect (e.g., after user action)
   */
  reconnect() {
    if (this.sessionId && this.userId && this.role) {
      this.intentionalDisconnect = false;
      this.reconnectAttempts = 0;
      this.cleanupConnection();
      this.scheduleReconnect();
    }
  }

  // ============================================================================
  // Messaging
  // ============================================================================

  private send(msg: ClientToServerMessage, force = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (!force) {
        console.debug("[voice-gateway] send skipped; socket not open", this.ws?.readyState);
      }
      return;
    }
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error("Failed to send WS message", err);
    }
  }

  startSpeaking(character?: CharacterId) {
    if (!this.sessionId || !this.userId) return;
    this.send({ type: "start_speaking", sessionId: this.sessionId, userId: this.userId, character });
  }

  stopSpeaking(character?: CharacterId) {
    if (!this.sessionId || !this.userId) return;
    this.send({ type: "stop_speaking", sessionId: this.sessionId, userId: this.userId, character });
  }

  sendVoiceCommand(
    commandType: VoiceCommandType,
    payload?: Record<string, unknown>,
    character?: CharacterId
  ) {
    if (!this.sessionId || !this.userId) return;
    this.send({
      type: "voice_command",
      sessionId: this.sessionId,
      userId: this.userId,
      character,
      commandType,
      payload,
    });
  }

  sendSetScenario(scenarioId: PatientScenarioId) {
    if (!this.sessionId || !this.userId) return;
    this.send({
      type: "set_scenario",
      sessionId: this.sessionId,
      userId: this.userId,
      scenarioId,
    });
  }

  async sendDoctorAudio(blob: Blob, opts?: { character?: CharacterId }) {
    if (!this.sessionId || !this.userId) return;
    const contentType = blob.type || "audio/webm";
    try {
      const base64 = await this.readBlobAsBase64(blob);
      this.send({
        type: "doctor_audio",
        sessionId: this.sessionId,
        userId: this.userId,
        character: opts?.character,
        audioBase64: base64,
        contentType,
      });
    } catch (err) {
      console.error("Failed to send doctor audio", err);
    }
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  onPatientState(cb: PatientStateListener) {
    this.patientListeners.add(cb);
    return () => this.patientListeners.delete(cb);
  }

  onPatientTranscriptDelta(cb: TranscriptListener) {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  onSimState(cb: SimStateListener) {
    this.simStateListeners.add(cb);
    return () => this.simStateListeners.delete(cb);
  }

  onParticipantState(cb: ParticipantStateListener) {
    this.participantListeners.add(cb);
    return () => this.participantListeners.delete(cb);
  }

  onStatus(cb: StatusListener) {
    this.statusListeners.add(cb);
    cb(this.connectionStatus);
    return () => this.statusListeners.delete(cb);
  }

  onPatientAudio(cb: AudioListener) {
    this.audioListeners.add(cb);
    return () => this.audioListeners.delete(cb);
  }

  onDoctorUtterance(cb: DoctorUtteranceListener) {
    this.doctorListeners.add(cb);
    return () => this.doctorListeners.delete(cb);
  }

  onScenarioChanged(cb: ScenarioListener) {
    this.scenarioListeners.add(cb);
    return () => this.scenarioListeners.delete(cb);
  }

  sendAnalyzeTranscript(turns: DebriefTurn[]) {
    if (!this.sessionId || !this.userId) return;
    this.send({
      type: "analyze_transcript",
      sessionId: this.sessionId,
      userId: this.userId,
      turns,
    });
  }

  onAnalysisResult(cb: AnalysisResultListener) {
    this.analysisListeners.add(cb);
    return () => this.analysisListeners.delete(cb);
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

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
        this.patientListeners.forEach((cb) => cb(msg.state, (msg as any).character, (msg as any).displayName));
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
      case "patient_audio": {
        const url = this.decodeAudio(msg.audioBase64);
        if (url) {
          this.audioListeners.forEach((cb) => cb(url));
        }
        break;
      }
      case "doctor_utterance": {
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            "[voice-gateway] doctor_utterance",
            msg.userId,
            msg.text?.slice?.(0, 120) ?? ""
          );
        }
        this.doctorListeners.forEach((cb) => cb(msg.text, msg.userId, (msg as any).character));
        break;
      }
      case "scenario_changed": {
        this.scenarioListeners.forEach((cb) => cb(msg.scenarioId));
        break;
      }
      case "analysis_result": {
        this.analysisListeners.forEach((cb) => cb(msg));
        break;
      }
      case "sim_state": {
        this.simStateListeners.forEach((cb) =>
          cb({
            stageId: msg.stageId,
            stageIds: msg.stageIds,
            scenarioId: msg.scenarioId,
            vitals: msg.vitals,
            exam: (msg as any).exam,
            examAudio: (msg as any).examAudio,
            interventions: (msg as any).interventions,
            telemetry: (msg as any).telemetry,
            rhythmSummary: (msg as any).rhythmSummary,
            telemetryWaveform: (msg as any).telemetryWaveform,
            findings: msg.findings,
            fallback: msg.fallback,
            budget: msg.budget,
            orders: (msg as any).orders,
            ekgHistory: (msg as any).ekgHistory,
            telemetryHistory: (msg as any).telemetryHistory,
          })
        );
        break;
      }
      case "error": {
        console.warn("Voice gateway error", msg.message);
        // Handle auth errors - refresh token once and retry
        if (msg.message === "unauthorized_token") {
          this.handleUnauthorizedToken();
        }
        break;
      }
      case "joined":
        // Successful join - connection fully established, reset auth retry state
        this.authRetryPending = false;
        this.insecureMode = (msg as any).insecureMode === true;
        break;
      case "pong":
        this.handlePong();
        break;
      default:
        break;
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private decodeAudio(audioBase64: string): string | null {
    try {
      let binaryString: string;
      if (typeof atob === "function") {
        binaryString = atob(audioBase64);
      } else if (typeof (globalThis as any).Buffer !== "undefined") {
        binaryString = (globalThis as any).Buffer.from(audioBase64, "base64").toString("binary");
      } else {
        console.warn("No base64 decoder available");
        return null;
      }
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      if (this.lastAudioUrl) {
        URL.revokeObjectURL(this.lastAudioUrl);
      }
      const url = URL.createObjectURL(blob);
      this.lastAudioUrl = url;
      return url;
    } catch (err) {
      console.error("Failed to decode patient audio", err);
      return null;
    }
  }

  private readBlobAsBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        try {
          const base64 = btoa(binary);
          resolve(base64);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Get current connection status
   */
  getStatus(): VoiceConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if currently connected and ready
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.connectionStatus.state === "ready";
  }

  /**
   * Check if connected in insecure mode (dev only, no auth required)
   */
  isInsecureMode(): boolean {
    return this.insecureMode;
  }
}

export const voiceGatewayClient = new VoiceGatewayClient();
