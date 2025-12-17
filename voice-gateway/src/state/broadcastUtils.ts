/**
 * Broadcast Utilities
 * Handles broadcasting simulation state to presenters and participants with proper gating.
 */

import { PatientScenarioId } from "../patientCase";
import { SessionManager } from "../sessionManager";
import { Interventions } from "../sim/types";
import { OrderResult } from "../messageTypes";
import { logError } from "../logger";
import { validateSimStateMessage } from "../validators";
import { getScenarioForSession } from "../patientEngine";
import { getAuscultationClips } from "../data/auscultation";
import { persistSimState } from "../persistence";

// ============================================================================
// Types
// ============================================================================

export interface SimStatePayload {
  stageId: string;
  vitals: any;
  exam?: Record<string, string>;
  interventions?: Interventions;
  telemetry?: boolean;
  rhythmSummary?: string;
  telemetryWaveform?: number[];
  fallback: boolean;
  budget?: any;
  stageIds?: string[];
  scenarioId?: string;
  findings?: string[];
  orders?: {
    id: string;
    type: "vitals" | "ekg" | "labs" | "imaging" | "cardiac_exam" | "lung_exam" | "general_exam" | "iv_access";
    status: "pending" | "complete";
    result?: OrderResult;
    completedAt?: number;
  }[];
  ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
  telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
  treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
  scenarioStartedAt?: number;
  stageEnteredAt?: number;
  elapsedSeconds?: number;
  extended?: any;
}

export interface BroadcastDeps {
  sessionManager: SessionManager;
  getOrCreateCorrelationId: (sessionId: string) => string;
  voiceFallbackSessions: Set<string>;
  fireAndForget: (promise: Promise<unknown>, context: string, sessionId?: string) => void;
}

export interface BroadcastUtils {
  broadcastSimState: (sessionId: string, state: SimStatePayload) => void;
}

// ============================================================================
// Factory
// ============================================================================

export function createBroadcastUtils(deps: BroadcastDeps): BroadcastUtils {
  const { sessionManager, getOrCreateCorrelationId, voiceFallbackSessions, fireAndForget } = deps;

  function broadcastSimState(sessionId: string, state: SimStatePayload): void {
    const validated = validateSimStateMessage(state);
    if (!validated) {
      logError("sim_state validation failed; skipping broadcast", state);
      return;
    }

    const scenarioId = (validated.scenarioId ?? getScenarioForSession(sessionId)) as PatientScenarioId;
    const examAudio = getAuscultationClips(scenarioId, validated.stageId);

    // Check completed orders to determine what everyone can see
    // Exam data is gated for BOTH presenters and participants until ordered
    const completedOrders = (validated.orders ?? []).filter((o) => o.status === "complete");
    const hasCardiacExam = completedOrders.some((o) => o.type === "cardiac_exam");
    const hasLungExam = completedOrders.some((o) => o.type === "lung_exam");
    const hasGeneralExam = completedOrders.some((o) => o.type === "general_exam");
    const hasAnyExam = hasCardiacExam || hasLungExam || hasGeneralExam;

    // Build partial exam based on what was ordered (for all users)
    const gatedExam: typeof validated.exam = {};
    if (hasGeneralExam && validated.exam?.general) gatedExam.general = validated.exam.general;
    if ((hasCardiacExam || hasGeneralExam) && validated.exam?.cardio) gatedExam.cardio = validated.exam.cardio;
    if ((hasLungExam || hasGeneralExam) && validated.exam?.lungs) gatedExam.lungs = validated.exam.lungs;
    if (hasGeneralExam && validated.exam?.perfusion) gatedExam.perfusion = validated.exam.perfusion;
    if (hasGeneralExam && validated.exam?.neuro) gatedExam.neuro = validated.exam.neuro;
    if (hasCardiacExam && validated.exam?.heartAudioUrl) gatedExam.heartAudioUrl = validated.exam.heartAudioUrl;
    if (hasLungExam && validated.exam?.lungAudioUrl) gatedExam.lungAudioUrl = validated.exam.lungAudioUrl;

    // Gated exam audio based on ordered exams
    const gatedExamAudio = hasAnyExam
      ? examAudio.filter(
          (a) => (hasCardiacExam && a.type === "heart") || (hasLungExam && a.type === "lung")
        )
      : [];

    // Get correlationId and voiceFallback status for this session
    const correlationId = getOrCreateCorrelationId(sessionId);
    const voiceFallback = voiceFallbackSessions.has(sessionId);

    // Build interventions object, merging ETT from extended state if patient is intubated
    const extended = (state as any).extended;
    const baseInterventions = (validated as any).interventions || {};
    const interventions = {
      ...baseInterventions,
      // Add ETT if patient is intubated (from extended airway state)
      ...(extended?.airway?.type === "intubation" && {
        ett: { placed: true, size: extended.airway.ettSize, depth: extended.airway.ettDepth },
      }),
    };

    // Full state for presenters - they see everything EXCEPT exam is gated until ordered
    const fullState = {
      type: "sim_state" as const,
      sessionId,
      stageId: validated.stageId,
      stageIds: validated.stageIds,
      scenarioId,
      vitals: validated.vitals ?? {},
      exam: hasAnyExam ? gatedExam : {},
      examAudio: gatedExamAudio,
      interventions,
      telemetry: validated.telemetry,
      rhythmSummary: validated.rhythmSummary,
      telemetryWaveform: validated.telemetryWaveform,
      findings: validated.findings ?? [],
      fallback: validated.fallback,
      voiceFallback,
      correlationId,
      budget: validated.budget,
      orders: validated.orders,
      ekgHistory: (state as any).ekgHistory,
      telemetryHistory: (state as any).telemetryHistory,
      treatmentHistory: (state as any).treatmentHistory,
      scenarioStartedAt: (state as any).scenarioStartedAt,
      stageEnteredAt: (state as any).stageEnteredAt,
      elapsedSeconds: (state as any).elapsedSeconds,
      extended: (state as any).extended, // SVT/Myocarditis extended state for presenters
    };

    // Send full state to presenters
    sessionManager.broadcastToPresenters(sessionId, fullState);

    // For participants: additional gating for vitals/telemetry
    const hasVitalsOrder = completedOrders.some((o) => o.type === "vitals");
    const hasEkgOrder = completedOrders.some((o) => o.type === "ekg");
    const hasTelemetryEnabled = validated.telemetry === true;

    // Participants only see:
    // - Vitals if they ordered vitals OR telemetry is on (continuous monitoring)
    // - Telemetry/rhythm if they ordered EKG or turned on telemetry
    // - Exam findings only if they ordered specific exam types (same as presenter)
    // - Interventions (IV, oxygen, etc.) always visible once placed
    const participantState = {
      type: "sim_state" as const,
      sessionId,
      stageId: validated.stageId,
      scenarioId,
      // Vitals revealed when ordered or telemetry on
      vitals: hasVitalsOrder || hasTelemetryEnabled ? (validated.vitals ?? {}) : {},
      // Exam available based on specific exam orders (reuse gated exam from above)
      exam: hasAnyExam ? gatedExam : {},
      examAudio: gatedExamAudio,
      // Interventions always visible (they can see the IV, oxygen, etc. on the patient)
      interventions,
      // Telemetry/rhythm only if EKG ordered or telemetry enabled
      telemetry: hasTelemetryEnabled,
      rhythmSummary: hasEkgOrder || hasTelemetryEnabled ? validated.rhythmSummary : undefined,
      telemetryWaveform: hasEkgOrder || hasTelemetryEnabled ? validated.telemetryWaveform : undefined,
      findings: validated.findings ?? [],
      fallback: validated.fallback,
      voiceFallback,
      correlationId,
      // Orders always visible (so they know status)
      orders: validated.orders,
      ekgHistory: hasEkgOrder || hasTelemetryEnabled ? (state as any).ekgHistory : undefined,
      // Treatment history for timeline (always visible so participants can see what's been done)
      treatmentHistory: (state as any).treatmentHistory,
      scenarioStartedAt: (state as any).scenarioStartedAt,
    };

    sessionManager.broadcastToParticipants(sessionId, participantState);
    fireAndForget(persistSimState(sessionId, state as any), "persistSimState", sessionId);
  }

  return {
    broadcastSimState,
  };
}
