/**
 * In-memory event logger for voice system observability.
 * Stores up to 50 events per session for debugging and monitoring.
 *
 * In production, optionally sinks redacted events to a log endpoint.
 * Alert hook stubs warn on error/fallback rate spikes.
 */

export type VoiceEventType =
  | "voice_error"
  | "voice_connected"
  | "voice_disconnected"
  | "voice_fallback"
  | "voice_recovered"
  | "reconnect_attempt"
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
  userRole?: "presenter" | "participant";
};

// Redacted event for prod sink (no free text/transcripts)
type RedactedEvent = {
  ts: number;
  event: VoiceEventType;
  sessionId?: string;
  correlationId?: string;
  userRole?: string;
  errorCode?: string;
};

const MAX_EVENTS = 50;
const SPIKE_WINDOW_MS = 60_000; // 1 minute window for rate detection
const SPIKE_THRESHOLD = 5; // Alert if >5 errors in window

// Environment detection (works in Vite)
const IS_PROD = typeof import.meta !== "undefined" && (import.meta as any).env?.PROD === true;
const LOG_SINK_URL = typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_VOICE_LOG_SINK_URL : undefined;

/**
 * Redact event for production logging - strips free text, keeps structured fields only.
 */
function redactEvent(event: VoiceEvent): RedactedEvent {
  return {
    ts: event.timestamp,
    event: event.type,
    sessionId: event.sessionId,
    correlationId: event.correlationId,
    userRole: event.userRole,
    errorCode: event.error,
  };
}

/**
 * Production log sink - POSTs redacted events if VITE_VOICE_LOG_SINK_URL is set,
 * otherwise logs to console.warn for server-side log aggregation.
 */
async function sinkToProd(event: VoiceEvent): Promise<void> {
  if (!IS_PROD) return; // No-op in dev

  const redacted = redactEvent(event);

  if (LOG_SINK_URL) {
    // POST to configured endpoint
    try {
      await fetch(LOG_SINK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(redacted),
      });
    } catch {
      // Silently fail - don't let logging break the app
    }
  } else {
    // Fallback: console.warn for server log aggregation
    console.warn("[voice-sink]", JSON.stringify(redacted));
  }
}

class VoiceEventLogger {
  private events: VoiceEvent[] = [];
  private listeners: Set<(events: VoiceEvent[]) => void> = new Set();
  private lastAlertAt: number = 0;

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

    // Sink to prod (no-op in dev)
    sinkToProd(fullEvent);

    // Check for spike and trigger alert hook
    if (event.type === "voice_error" || event.type === "voice_fallback") {
      this.checkErrorSpike();
    }
  }

  /**
   * Alert hook stub - triggers when error/fallback rate exceeds threshold.
   * TODO: Replace with real alerting (PagerDuty, Slack webhook, etc.)
   */
  private checkErrorSpike() {
    const now = Date.now();
    const windowStart = now - SPIKE_WINDOW_MS;

    // Count errors/fallbacks in the last minute
    const recentErrors = this.events.filter(
      (e) =>
        e.timestamp >= windowStart &&
        (e.type === "voice_error" || e.type === "voice_fallback")
    ).length;

    // Debounce alerts to once per minute
    if (recentErrors >= SPIKE_THRESHOLD && now - this.lastAlertAt > SPIKE_WINDOW_MS) {
      this.lastAlertAt = now;
      // Stub alert - in prod this could POST to Slack/PagerDuty
      console.warn(
        `[voice-alert] ERROR SPIKE DETECTED: ${recentErrors} errors/fallbacks in last minute`
      );
      // TODO: Implement real alert delivery here
    }
  }

  logError(
    error: "tts_failed" | "stt_failed" | "openai_failed",
    correlationId?: string,
    detail?: string,
    sessionId?: string,
    userRole?: "presenter" | "participant"
  ) {
    this.log({
      type: "voice_error",
      error,
      correlationId,
      detail,
      sessionId,
      userRole,
    });
  }

  logFallback(correlationId?: string, sessionId?: string, userRole?: "presenter" | "participant") {
    this.log({
      type: "voice_fallback",
      correlationId,
      sessionId,
      userRole,
      detail: "Voice service degraded, using text fallback",
    });
  }

  logRecovered(correlationId?: string, sessionId?: string) {
    this.log({
      type: "voice_recovered",
      correlationId,
      sessionId,
      detail: "Voice service recovered",
    });
  }

  logConnected(sessionId?: string, correlationId?: string, userRole?: "presenter" | "participant") {
    this.log({
      type: "voice_connected",
      sessionId,
      correlationId,
      userRole,
    });
  }

  logDisconnected(detail?: string, sessionId?: string) {
    this.log({
      type: "voice_disconnected",
      detail,
      sessionId,
    });
  }

  logReconnect(attempt: number, sessionId?: string) {
    this.log({
      type: "reconnect_attempt",
      sessionId,
      detail: `Reconnect attempt ${attempt}`,
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
