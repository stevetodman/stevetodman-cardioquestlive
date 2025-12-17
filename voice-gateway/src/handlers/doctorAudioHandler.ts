/**
 * Doctor Audio Handler
 * Extracted from index.ts to handle incoming doctor audio, transcription,
 * and auto-reply routing.
 */

import type { CharacterId } from "../messageTypes";
import type { SessionManager } from "../sessionManager";
import type { Runtime } from "../typesRuntime";
import type { OrderType } from "../orders";
import { transcribeDoctorAudio } from "../sttClient";
import { parseOrderRequest, chooseCharacter, isUnsafeUtterance } from "../speechHelpers";
import { shouldAutoReply } from "../autoReplyGuard";

const log = (...args: unknown[]) => console.log("[doctor-audio]", ...args);
const logError = (...args: unknown[]) => console.error("[doctor-audio]", ...args);

/**
 * Dependencies for the doctor audio handler
 */
export interface DoctorAudioHandlerDeps {
  sessionManager: SessionManager;
  ensureRuntime: (sessionId: string) => Runtime;
  handleOrder: (
    sessionId: string,
    orderType: OrderType,
    orderedBy?: { id: string; name: string; role: string },
    ivParams?: { location: string }
  ) => { success: boolean };
  handleExamRequest: (sessionId: string, examType?: string) => void;
  handleForceReply: (sessionId: string, userId: string, doctorUtterance?: string, character?: CharacterId) => void;
  withRetry: <T>(
    fn: () => Promise<T>,
    opts: { label: string; attempts: number; delayMs: number },
    sessionId: string
  ) => Promise<T>;
  timed: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  sendDegradedNotice: (sessionId: string, text: string) => void;
  commandCooldownMs: number;
  lastAutoReplyAt: Map<string, number>;
  lastAutoReplyByUser: Map<string, number>;
  lastDoctorUtterance: Map<string, { text: string; ts: number }>;
}

/**
 * Handlers returned by the factory function
 */
export interface DoctorAudioHandlers {
  handleDoctorAudio: (
    sessionId: string,
    userId: string,
    audioBase64: string,
    contentType: string,
    character?: CharacterId
  ) => Promise<void>;
}

/**
 * Factory function to create doctor audio handlers with injected dependencies
 */
export function createDoctorAudioHandler(deps: DoctorAudioHandlerDeps): DoctorAudioHandlers {
  const {
    sessionManager,
    ensureRuntime,
    handleOrder,
    handleExamRequest,
    handleForceReply,
    withRetry,
    timed,
    sendDegradedNotice,
    commandCooldownMs,
    lastAutoReplyAt,
    lastAutoReplyByUser,
    lastDoctorUtterance,
  } = deps;

  /**
   * Auto-reply logic after doctor utterance is transcribed.
   * Routes to appropriate handler based on content (order, exam, or AI response).
   */
  function maybeAutoForceReply(
    sessionId: string,
    text: string,
    explicitCharacter?: CharacterId,
    userId?: string
  ) {
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
      if (orderRequest.type === "cardiac_exam" || orderRequest.type === "lung_exam" || orderRequest.type === "general_exam") {
        const examType = orderRequest.type === "cardiac_exam" ? "cardiac"
          : orderRequest.type === "lung_exam" ? "lungs"
          : undefined;
        handleExamRequest(sessionId, examType);
      } else {
        // For voice-ordered requests, we only have userId (no displayName available)
        // Pass IV location if present
        const ivParams = orderRequest.type === "iv_access" && orderRequest.location
          ? { location: orderRequest.location }
          : undefined;
        handleOrder(sessionId, orderRequest.type, userId ? {
          id: userId,
          name: "Voice Order",
          role: "participant",
        } : undefined, ivParams);
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
      maps: { lastAutoReplyAt, lastAutoReplyByUser, lastDoctorUtterance },
    });
    if (!allow) return;
    const routed = explicitCharacter ?? chooseCharacter(trimmed);
    handleForceReply(sessionId, "auto", trimmed, routed);
  }

  /**
   * Broadcast doctor utterance to presenters and trigger auto-reply
   */
  function broadcastDoctorUtterance(
    sessionId: string,
    userId: string,
    text: string,
    character?: CharacterId
  ) {
    sessionManager.broadcastToPresenters(sessionId, {
      type: "doctor_utterance",
      sessionId,
      userId,
      text,
      character,
    });
    maybeAutoForceReply(sessionId, text, character, userId);
  }

  /**
   * Legacy audio handling (non-realtime path)
   */
  async function handleDoctorAudioLegacy(
    sessionId: string,
    userId: string,
    audioBuffer: Buffer,
    contentType: string,
    character?: CharacterId
  ) {
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

  /**
   * Main doctor audio handler - processes incoming audio from learner
   */
  async function handleDoctorAudio(
    sessionId: string,
    userId: string,
    audioBase64: string,
    contentType: string,
    character?: CharacterId
  ) {
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
                log("Canceling realtime patient response for non-patient utterance", sessionId, orderRequest?.type ?? routedCharacter);
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
  };
}
