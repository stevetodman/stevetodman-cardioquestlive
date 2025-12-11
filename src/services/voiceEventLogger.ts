/**
 * In-memory event logger for voice system observability.
 * Stores up to 50 events per session for debugging and monitoring.
 */

export type VoiceEventType =
  | "voice_error"
  | "voice_connected"
  | "voice_disconnected"
  | "voice_fallback"
  | "voice_recovered"
  | "stt_started"
  | "stt_completed"
  | "tts_started"
  | "tts_completed";

export type VoiceEvent = {
  type: VoiceEventType;
  timestamp: number;
  correlationId?: string;
  error?: "tts_failed" | "stt_failed" | "openai_failed";
  detail?: string;
  sessionId?: string;
};

const MAX_EVENTS = 50;

class VoiceEventLogger {
  private events: VoiceEvent[] = [];
  private listeners: Set<(events: VoiceEvent[]) => void> = new Set();

  log(event: Omit<VoiceEvent, "timestamp">) {
    const fullEvent: VoiceEvent = {
      ...event,
      timestamp: Date.now(),
    };
    this.events.push(fullEvent);
    // Keep only the last MAX_EVENTS
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
    this.notifyListeners();
  }

  logError(
    error: "tts_failed" | "stt_failed" | "openai_failed",
    correlationId?: string,
    detail?: string
  ) {
    this.log({
      type: "voice_error",
      error,
      correlationId,
      detail,
    });
  }

  logFallback(correlationId?: string) {
    this.log({
      type: "voice_fallback",
      correlationId,
      detail: "Voice service degraded, using text fallback",
    });
  }

  logRecovered(correlationId?: string) {
    this.log({
      type: "voice_recovered",
      correlationId,
      detail: "Voice service recovered",
    });
  }

  logConnected(sessionId?: string, correlationId?: string) {
    this.log({
      type: "voice_connected",
      sessionId,
      correlationId,
    });
  }

  logDisconnected(detail?: string) {
    this.log({
      type: "voice_disconnected",
      detail,
    });
  }

  getEvents(): VoiceEvent[] {
    return [...this.events];
  }

  getRecentEvents(count: number = 10): VoiceEvent[] {
    return this.events.slice(-count);
  }

  getErrorEvents(): VoiceEvent[] {
    return this.events.filter((e) => e.type === "voice_error");
  }

  clear() {
    this.events = [];
    this.notifyListeners();
  }

  subscribe(listener: (events: VoiceEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const events = this.getEvents();
    this.listeners.forEach((listener) => listener(events));
  }
}

// Singleton instance
export const voiceEventLogger = new VoiceEventLogger();
