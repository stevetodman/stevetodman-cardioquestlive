import {
  ClientRole,
  ClientToServerMessage,
  ServerToClientMessage,
  PatientState,
  GatewayStatus,
  PatientScenarioId,
  DebriefTurn,
  AnalysisResult,
} from "../types/voiceGateway";

type PatientStateListener = (state: PatientState) => void;
type TranscriptListener = (text: string) => void;
type ParticipantStateListener = (info: { userId: string; speaking: boolean }) => void;
type StatusListener = (status: GatewayStatus) => void;
type AudioListener = (audioUrl: string) => void;
type DoctorUtteranceListener = (text: string, userId: string) => void;
type ScenarioListener = (scenarioId: PatientScenarioId) => void;
type AnalysisResultListener = (result: AnalysisResult) => void;

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
  private audioListeners = new Set<AudioListener>();
  private doctorListeners = new Set<DoctorUtteranceListener>();
  private scenarioListeners = new Set<ScenarioListener>();
  private analysisListeners = new Set<AnalysisResultListener>();
  private lastAudioUrl: string | null = null;

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
    if (this.lastAudioUrl) {
      URL.revokeObjectURL(this.lastAudioUrl);
      this.lastAudioUrl = null;
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

  sendSetScenario(scenarioId: PatientScenarioId) {
    if (!this.sessionId || !this.userId) return;
    this.send({
      type: "set_scenario",
      sessionId: this.sessionId,
      userId: this.userId,
      scenarioId,
    });
  }

  async sendDoctorAudio(blob: Blob) {
    if (!this.sessionId || !this.userId) return;
    const contentType = blob.type || "audio/webm";
    try {
      const base64 = await this.readBlobAsBase64(blob);
      this.send({
        type: "doctor_audio",
        sessionId: this.sessionId,
        userId: this.userId,
        audioBase64: base64,
        contentType,
      });
    } catch (err) {
      console.error("Failed to send doctor audio", err);
    }
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
      case "patient_audio": {
        const url = this.decodeAudio(msg.audioBase64);
        if (url) {
          this.audioListeners.forEach((cb) => cb(url));
        }
        break;
      }
      case "doctor_utterance": {
        this.doctorListeners.forEach((cb) => cb(msg.text, msg.userId));
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
}

export const voiceGatewayClient = new VoiceGatewayClient();
