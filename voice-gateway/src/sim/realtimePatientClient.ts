import WebSocket from "ws";
import { log, logError } from "../logger";
import { ToolIntent } from "./types";

type RealtimePatientClientOptions = {
  simId: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  voice?: string; // OpenAI voice: alloy, ash, ballad, coral, echo, sage, shimmer, verse
  onAudioOut: (buf: Buffer) => void;
  onTranscriptDelta: (text: string, isFinal: boolean) => void;
  onToolIntent: (intent: ToolIntent) => void;
  onDisconnect?: () => void;
  onUsage?: (usage: { inputTokens?: number; outputTokens?: number }) => void;
};

/**
 * Minimal wrapper for OpenAI Realtime. This is intentionally slim so we can
 * evolve behavior without tangling WebSocket handling with session logic.
 * For now this is a scaffold; if Realtime is unavailable we simply no-op.
 */
export class RealtimePatientClient {
  private ws: WebSocket | null = null;
  private readonly opts: RealtimePatientClientOptions;
  private connected = false;

  constructor(opts: RealtimePatientClientOptions) {
    this.opts = opts;
  }

  connect() {
    if (this.connected) return;
    if (!this.opts.apiKey) {
      log("[realtime] apiKey missing; Realtime client disabled for", this.opts.simId);
      return;
    }

    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.opts.model)}`;
    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    this.ws.on("open", () => {
      this.connected = true;
      log("[realtime] connected", this.opts.simId);
      // Configure session with voice and modalities
      this.send({
        type: "session.update",
        session: {
          voice: this.opts.voice || "coral", // coral is more natural-sounding
          modalities: ["text", "audio"],
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          turn_detection: null, // We handle turn detection manually
        },
      });
      this.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [{ type: "input_text", text: this.opts.systemPrompt }],
        },
      });
      this.send({ type: "response.create" });
    });

    this.ws.on("message", (raw) => this.handleMessage(raw));
    this.ws.on("close", () => {
      this.connected = false;
      this.ws = null;
      this.opts.onDisconnect?.();
    });
    this.ws.on("error", (err) => {
      logError("[realtime] error", err);
    });
  }

  sendAudioChunk(buf: Buffer) {
    if (!this.ws || !this.connected) return;
    this.send({
      type: "input_audio_buffer.append",
      audio: buf.toString("base64"),
    });
  }

  commitAudio() {
    if (!this.ws || !this.connected) return;
    this.send({ type: "input_audio_buffer.commit" });
    this.send({ type: "response.create" });
  }

  /**
   * Cancel the current response. Useful when we detect the utterance
   * is directed at a non-patient character (nurse, tech, etc.).
   */
  cancelResponse() {
    if (!this.ws || !this.connected) return;
    log("[realtime] canceling response", this.opts.simId);
    this.send({ type: "response.cancel" });
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.connected = false;
    this.ws = null;
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      logError("[realtime] failed to send", err);
    }
  }

  private handleMessage(raw: WebSocket.RawData) {
    let evt: any;
    try {
      evt = JSON.parse(raw.toString());
    } catch {
      return;
    }

    try {
      switch (evt.type) {
        case "response.audio.delta": {
          if (typeof evt.audio !== "string" || evt.audio.length === 0) return;
          const buf = Buffer.from(evt.audio, "base64");
          this.opts.onAudioOut(buf);
          break;
        }
        case "response.output_text.delta": {
          if (evt.delta) this.opts.onTranscriptDelta(evt.delta, false);
          break;
        }
        case "response.output_text.done": {
          if (evt.text) this.opts.onTranscriptDelta(evt.text, true);
          break;
        }
        case "response.usage": {
          const usage = {
            inputTokens: evt.input_tokens ?? evt.inputTokens,
            outputTokens: evt.output_tokens ?? evt.outputTokens,
          };
          this.opts.onUsage?.(usage);
          break;
        }
        case "response.output_tool_call.done": {
          const intent = this.parseToolIntent(evt);
          if (intent) this.opts.onToolIntent(intent);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      logError("[realtime] failed to handle message", err);
    }
  }

  private parseToolIntent(evt: any): ToolIntent | null {
    if (!evt?.name) return null;
    try {
      const args = evt.arguments ? JSON.parse(evt.arguments) : {};
      switch (evt.name) {
        case "intent_updateVitals":
          return { type: "intent_updateVitals", delta: args.delta ?? {}, reason: args.reason };
        case "intent_advanceStage":
          return { type: "intent_advanceStage", stageId: args.stageId, reason: args.reason };
        case "intent_revealFinding":
          return { type: "intent_revealFinding", findingId: args.findingId, reason: args.reason };
        case "intent_setEmotion":
          return {
            type: "intent_setEmotion",
            emotion: args.emotion,
            intensity: args.intensity,
            reason: args.reason,
          };
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
