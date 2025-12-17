/**
 * Doctor Audio Handler
 * Handles audio input from doctors/participants, transcription, and auto-reply routing.
 */

import { Buffer } from "buffer";
import { CharacterId } from "../messageTypes";
import { SessionManager } from "../sessionManager";
import { Runtime } from "../typesRuntime";
import { log, logError } from "../logger";
import { transcribeDoctorAudio } from "../sttClient";
import { parseOrderRequest, chooseCharacter, isUnsafeUtterance } from "../speechHelpers";
import { shouldAutoReply } from "../autoReplyGuard";
import { OrderType } from "../orders";

// ============================================================================
// Types
// ============================================================================

export interface DoctorAudioDeps {
  ensureRuntime: (sessionId: string) => Runtime;
  sessionManager: SessionManager;
  handleOrder: (
    sessionId: string,
    orderType: OrderType,
    orderedBy?: { id: string; name: string; role: "presenter" | "participant" },
    ivParams?: { location: string }
  ) => void;
  handleExamRequest: (sessionId: string, examType?: string) => void;
  handleForceReply: (sessionId: string, userId: string, doctorUtterance?: string, character?: CharacterId) => void;
  sendDegradedNotice: (sessionId: string, text: string) => void;
  withRetry: <T>(
    fn: () => Promise<T>,
    opts: { label: string; attempts: number; delayMs: number },
    sessionId: string
  ) => Promise<T | null>;
  timed: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  commandCooldownMs: number;
  // Session-scoped maps for rate limiting
  maps: {
    lastAutoReplyAt: Map<string, number>;
    lastAutoReplyByUser: Map<string, number>;
    lastDoctorUtterance: Map<string, { text: string; ts: number }>;
  };
}

export interface DoctorAudioHandlers {
  handleDoctorAudio: (
    sessionId: string,
    userId: string,
    audioBase64: string,
    contentType: string,
    character?: CharacterId
  ) => Promise<void>;
  handleDoctorAudioLegacy: (
    sessionId: string,
    userId: string,
    audioBuffer: Buffer,
    contentType: string,
    character?: CharacterId
  ) => Promise<void>;
  maybeAutoForceReply: (
    sessionId: string,
    text: string,
    explicitCharacter?: CharacterId,
    userId?: string
  ) => void;
  broadcastDoctorUtterance: (
    sessionId: string,
    userId: string,
    text: string,
    character?: CharacterId
  ) => void;
}

// ============================================================================
// Factory
// ============================================================================

export function createDoctorAudioHandler(deps: DoctorAudioDeps): DoctorAudioHandlers {
  const {
    ensureRuntime,
    sessionManager,
    handleOrder,
    handleExamRequest,
    handleForceReply,
    sendDegradedNotice,
    withRetry,
    timed,
    commandCooldownMs,
    maps,
  } = deps;

  function maybeAutoForceReply(
    sessionId: string,
    text: string,
    explicitCharacter?: CharacterId,
    userId?: string
  ): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isUnsafeUtterance(trimmed)) {
      log("auto-reply blocked for safety", sessionId);
      sessionManager.broadcastToPresenters(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: "NPC reply held for review (content flagged). Use manual reply if appropriate.",
        character: "nurse",
      });
      return;
    }

    // Check if this is an order request (vitals, exam, EKG, labs, imaging)
    const orderRequest = parseOrderRequest(trimmed);
    if (orderRequest) {
      log("Order request detected from speech", sessionId, orderRequest.type);
      // Handle exam orders via handleExamRequest, other orders via handleOrder
      if (
        orderRequest.type === "cardiac_exam" ||
        orderRequest.type === "lung_exam" ||
        orderRequest.type === "general_exam"
      ) {
        const examType =
          orderRequest.type === "cardiac_exam"
            ? "cardiac"
            : orderRequest.type === "lung_exam"
              ? "lungs"
              : undefined;
        handleExamRequest(sessionId, examType);
      } else {
        // For voice-ordered requests, we only have userId (no displayName available)
        // Pass IV location if present
        const ivParams =
          orderRequest.type === "iv_access" && orderRequest.location
            ? { location: orderRequest.location }
            : undefined;
        handleOrder(
          sessionId,
          orderRequest.type,
          userId
            ? {
                id: userId,
                name: "Voice Order",
                role: "participant",
              }
            : undefined,
          ivParams
        );
      }
      return;
    }

    const allow = shouldAutoReply({
      sessionId,
      userId,
      text: trimmed,
      explicitCharacter,
      floorHolder: sessionManager.getFloorHolder(sessionId),
      commandCooldownMs,
      maps: {
        lastAutoReplyAt: maps.lastAutoReplyAt,
        lastAutoReplyByUser: maps.lastAutoReplyByUser,
        lastDoctorUtterance: maps.lastDoctorUtterance,
      },
    });
    if (!allow) return;

    const routed = explicitCharacter ?? chooseCharacter(trimmed);
    handleForceReply(sessionId, "auto", trimmed, routed);
  }

  function broadcastDoctorUtterance(
    sessionId: string,
    userId: string,
    text: string,
    character?: CharacterId
  ): void {
    sessionManager.broadcastToPresenters(sessionId, {
      type: "doctor_utterance",
      sessionId,
      userId,
      text,
      character,
    });
    maybeAutoForceReply(sessionId, text, character, userId);
  }

  async function handleDoctorAudioLegacy(
    sessionId: string,
    userId: string,
    audioBuffer: Buffer,
    contentType: string,
    character?: CharacterId
  ): Promise<void> {
    const text = await withRetry(
      () => timed("stt.transcribe", () => transcribeDoctorAudio(audioBuffer, contentType)),
      { label: "stt", attempts: 2, delayMs: 150 },
      sessionId
    );
    if (text && text.trim().length > 0) {
      log("STT transcript", sessionId, text.slice(0, 120));
      broadcastDoctorUtterance(sessionId, userId, text, character);
    } else {
      sendDegradedNotice(sessionId, "Transcription unavailable; please repeat or use manual reply.");
    }
  }

  async function handleDoctorAudio(
    sessionId: string,
    userId: string,
    audioBase64: string,
    contentType: string,
    character?: CharacterId
  ): Promise<void> {
    try {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      log("Doctor audio received", sessionId, "bytes:", audioBuffer.length, "character:", character ?? "patient");

      if (sessionManager.isFallback(sessionId)) {
        log("Session in fallback; routing legacy STT only", sessionId);
        await handleDoctorAudioLegacy(sessionId, userId, audioBuffer, contentType, character);
        return;
      }

      const runtime = ensureRuntime(sessionId);
      const floorHolder = sessionManager.getFloorHolder(sessionId);
      if (floorHolder && floorHolder !== userId) {
        log("Ignoring doctor_audio; user does not hold floor", sessionId, userId);
        return;
      }

      if (runtime.realtime) {
        runtime.realtime.sendAudioChunk(audioBuffer);
        runtime.realtime.commitAudio();

        void transcribeDoctorAudio(audioBuffer, contentType)
          .then((text) => {
            if (text && text.trim().length > 0) {
              // Check if utterance is for non-patient (order or explicit character routing)
              // If so, cancel the realtime patient response to avoid "echo" effect
              const orderRequest = parseOrderRequest(text);
              const routedCharacter = character ?? chooseCharacter(text);
              if (orderRequest || routedCharacter !== "patient") {
                log(
                  "Canceling realtime patient response for non-patient utterance",
                  sessionId,
                  orderRequest?.type ?? routedCharacter
                );
                runtime.realtime?.cancelResponse();
              }
              broadcastDoctorUtterance(sessionId, userId, text, character);
            }
          })
          .catch((err) => logError("Realtime doctor STT failed", err));
        return;
      }

      await handleDoctorAudioLegacy(sessionId, userId, audioBuffer, contentType, character);
    } catch (err) {
      logError("doctor_audio handling failed", err);
    }
  }

  return {
    handleDoctorAudio,
    handleDoctorAudioLegacy,
    maybeAutoForceReply,
    broadcastDoctorUtterance,
  };
}
