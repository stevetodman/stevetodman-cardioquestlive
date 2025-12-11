/**
 * Voice Event Logger resilience tests.
 * Verifies error/fallback logging, spike detection, and prod sink behavior.
 */

import { voiceEventLogger, VoiceEvent } from "../voiceEventLogger";

describe("VoiceEventLogger", () => {
  beforeEach(() => {
    voiceEventLogger.clear();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("basic logging", () => {
    it("logs voice_error with all context fields", () => {
      voiceEventLogger.logError("tts_failed", "corr-123", "TTS timeout", "session-abc", "presenter");

      const events = voiceEventLogger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "voice_error",
        error: "tts_failed",
        correlationId: "corr-123",
        detail: "TTS timeout",
        sessionId: "session-abc",
        userRole: "presenter",
      });
      expect(events[0].timestamp).toBeDefined();
    });

    it("logs voice_fallback with session context", () => {
      voiceEventLogger.logFallback("corr-456", "session-xyz", "participant");

      const events = voiceEventLogger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "voice_fallback",
        correlationId: "corr-456",
        sessionId: "session-xyz",
        userRole: "participant",
      });
    });

    it("logs voice_recovered after fallback", () => {
      voiceEventLogger.logFallback("corr-1");
      voiceEventLogger.logRecovered("corr-1", "session-1");

      const events = voiceEventLogger.getEvents();
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe("voice_recovered");
    });

    it("logs reconnect_attempt with attempt number", () => {
      voiceEventLogger.logReconnect(3, "session-123");

      const events = voiceEventLogger.getEvents();
      expect(events[0]).toMatchObject({
        type: "reconnect_attempt",
        sessionId: "session-123",
        detail: "Reconnect attempt 3",
      });
    });
  });

  describe("spike detection", () => {
    it("triggers alert when error threshold exceeded", () => {
      // Generate 6 errors in quick succession (threshold is 5)
      for (let i = 0; i < 6; i++) {
        voiceEventLogger.logError("openai_failed", `corr-${i}`);
      }

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[voice-alert] ERROR SPIKE DETECTED")
      );
    });

    it("counts both errors and fallbacks toward spike threshold", () => {
      // Need 6 events to exceed threshold of 5
      voiceEventLogger.logError("stt_failed", "corr-1");
      voiceEventLogger.logError("stt_failed", "corr-2");
      voiceEventLogger.logFallback("corr-3");
      voiceEventLogger.logFallback("corr-4");
      voiceEventLogger.logError("tts_failed", "corr-5");
      voiceEventLogger.logFallback("corr-6"); // 6th event triggers

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[voice-alert] ERROR SPIKE DETECTED")
      );
    });

    it("debounces alerts to once per minute", () => {
      // First spike - 6 errors triggers alert
      for (let i = 0; i < 6; i++) {
        voiceEventLogger.logError("openai_failed", `first-${i}`);
      }

      const callCountAfterFirst = (console.warn as jest.Mock).mock.calls.length;
      expect(callCountAfterFirst).toBe(1);

      // Immediate second spike should not trigger another alert (debounced)
      for (let i = 0; i < 6; i++) {
        voiceEventLogger.logError("tts_failed", `second-${i}`);
      }

      // Should still be only 1 call (debounced)
      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe("event retrieval", () => {
    it("returns recent events in order", () => {
      voiceEventLogger.logConnected("sess-1");
      voiceEventLogger.logError("stt_failed", "corr-1");
      voiceEventLogger.logFallback("corr-2");

      const recent = voiceEventLogger.getRecentEvents(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].type).toBe("voice_error");
      expect(recent[1].type).toBe("voice_fallback");
    });

    it("filters error events only", () => {
      voiceEventLogger.logConnected("sess-1");
      voiceEventLogger.logError("stt_failed", "corr-1");
      voiceEventLogger.logFallback("corr-2");
      voiceEventLogger.logError("tts_failed", "corr-3");

      const errors = voiceEventLogger.getErrorEvents();
      expect(errors).toHaveLength(2);
      expect(errors.every((e) => e.type === "voice_error")).toBe(true);
    });

    it("limits stored events to 50", () => {
      for (let i = 0; i < 60; i++) {
        voiceEventLogger.logConnected(`sess-${i}`);
      }

      expect(voiceEventLogger.getEvents()).toHaveLength(50);
    });
  });

  describe("subscription", () => {
    it("notifies subscribers on new events", () => {
      const listener = jest.fn();
      const unsub = voiceEventLogger.subscribe(listener);

      voiceEventLogger.logError("openai_failed", "corr-1");

      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ type: "voice_error" }),
      ]));

      unsub();
    });

    it("unsubscribe stops notifications", () => {
      const listener = jest.fn();
      const unsub = voiceEventLogger.subscribe(listener);
      unsub();

      voiceEventLogger.logError("openai_failed", "corr-1");

      // Should have been called once during subscribe, but not after unsub
      expect(listener).toHaveBeenCalledTimes(0);
    });
  });

  describe("clear", () => {
    it("removes all events", () => {
      voiceEventLogger.logError("stt_failed", "corr-1");
      voiceEventLogger.logFallback("corr-2");

      voiceEventLogger.clear();

      expect(voiceEventLogger.getEvents()).toHaveLength(0);
    });

    it("notifies subscribers on clear", () => {
      const listener = jest.fn();
      voiceEventLogger.subscribe(listener);
      listener.mockClear();

      voiceEventLogger.clear();

      expect(listener).toHaveBeenCalledWith([]);
    });
  });
});
