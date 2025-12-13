/**
 * SVT Phase Handler - Manages phase transitions for SVT complex scenario.
 * Extracted from index.ts for better maintainability.
 *
 * Handles:
 * - Auto-advance from presentation → svt_onset after 2 minutes
 * - Deterioration if untreated (svt_onset → decompensating after 4 min)
 * - Vitals drift during each phase
 * - TTS announcements for phase transitions
 */

import { SessionManager } from "./sessionManager";
import { ScenarioEngine } from "./sim/scenarioEngine";
import { hasSVTExtended, SVTExtendedState } from "./sim/types";
import { SVT_PHASES } from "./sim/scenarios/teen_svt_complex";
import { synthesizePatientAudio } from "./ttsClient";
import { log, logError } from "./logger";

export type SVTPhaseHandlerDeps = {
  sessionManager: SessionManager;
  scenarioHeartbeatMs: number;
};

/**
 * Handle SVT phase transitions based on time and state.
 * Auto-advances from presentation → svt_onset after 2 minutes,
 * and handles deterioration if untreated.
 */
export function tickSVTPhase(
  sessionId: string,
  runtime: {
    scenarioEngine: ScenarioEngine;
    fallback: boolean;
    cost: { getState?: () => any };
  },
  ext: SVTExtendedState,
  deps: SVTPhaseHandlerDeps
) {
  const { sessionManager, scenarioHeartbeatMs } = deps;
  const now = Date.now();
  const phaseElapsedMs = now - ext.phaseEnteredAt;
  const phaseElapsedMin = phaseElapsedMs / 60000;
  const phaseDef = SVT_PHASES.find((p) => p.id === ext.phase);

  // Don't transition if already converted
  if (ext.converted || ext.phase === "converted") return;

  // Phase: presentation → svt_onset (after 2 min)
  if (ext.phase === "presentation" && phaseElapsedMin >= 2) {
    const svtOnsetPhase = SVT_PHASES.find((p) => p.id === "svt_onset");
    if (svtOnsetPhase) {
      runtime.scenarioEngine.updateExtended({
        ...ext,
        phase: "svt_onset",
        phaseEnteredAt: now,
        currentRhythm: "svt",
        timelineEvents: [
          ...ext.timelineEvents,
          { ts: now, type: "phase_change", description: "SVT episode started - HR 220" },
        ],
      });
      runtime.scenarioEngine.hydrate({
        vitals: svtOnsetPhase.vitalsTarget,
        exam: svtOnsetPhase.examFindings,
        rhythmSummary: svtOnsetPhase.rhythmSummary,
      });

      // Announce SVT onset to all participants with TTS
      const svtOnsetText = "It's happening again! My heart is going so fast... I can feel it in my throat!";
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_state",
        sessionId,
        state: "speaking",
        character: "patient",
      });
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: svtOnsetText,
        character: "patient",
      });

      // Generate TTS audio for patient
      synthesizePatientAudio(svtOnsetText, "alloy")
        .then((audioBuffer) => {
          if (audioBuffer) {
            sessionManager.broadcastToSession(sessionId, {
              type: "patient_audio",
              sessionId,
              audioBase64: audioBuffer.toString("base64"),
              character: "patient",
            });
          }
        })
        .catch((err) => logError("TTS failed for SVT onset", err));

      sessionManager.broadcastToSession(sessionId, {
        type: "patient_state",
        sessionId,
        state: "idle",
        character: "patient",
      });

      log("[svt] Phase transition: presentation → svt_onset", sessionId);
    }
  }

  // Phase: svt_onset → treatment_window (when any treatment attempted)
  // This is handled in the treatment handlers

  // Phase: svt_onset → decompensating (after 4 min without treatment)
  if (ext.phase === "svt_onset" && phaseElapsedMin >= 4 && ext.vagalAttempts === 0 && ext.adenosineDoses.length === 0) {
    const decompPhase = SVT_PHASES.find((p) => p.id === "decompensating");
    if (decompPhase) {
      runtime.scenarioEngine.updateExtended({
        ...ext,
        phase: "decompensating",
        phaseEnteredAt: now,
        stabilityLevel: 3,
        penaltiesIncurred: ext.penaltiesIncurred.includes("treatment_delayed")
          ? ext.penaltiesIncurred
          : [...ext.penaltiesIncurred, "treatment_delayed", "patient_decompensated"],
        timelineEvents: [
          ...ext.timelineEvents,
          { ts: now, type: "phase_change", description: "Patient decompensating - no treatment given" },
        ],
      });
      runtime.scenarioEngine.hydrate({
        vitals: decompPhase.vitalsTarget,
        exam: decompPhase.examFindings,
        rhythmSummary: decompPhase.rhythmSummary,
      });

      sessionManager.broadcastToPresenters(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: "Nurse Martinez: 'She's getting worse! BP dropping, she's looking pale. We need to do something NOW!'",
        character: "nurse",
      });

      log("[svt] Phase transition: svt_onset → decompensating (untreated)", sessionId);
    }
  }

  // Phase: treatment_window → cardioversion_decision (after adenosine failed twice)
  // This is handled in the adenosine treatment handler

  // Apply drift for current phase if defined
  if (phaseDef?.drift && !ext.converted) {
    const driftPerTick = scenarioHeartbeatMs / 60000; // Convert to per-minute
    const currentVitals = runtime.scenarioEngine.getState().vitals;
    const newVitals = { ...currentVitals };

    if (phaseDef.drift.hrPerMin) {
      newVitals.hr = Math.round((currentVitals.hr ?? 90) + phaseDef.drift.hrPerMin * driftPerTick);
    }
    if (phaseDef.drift.spo2PerMin) {
      newVitals.spo2 = Math.max(80, Math.min(100, Math.round((currentVitals.spo2 ?? 99) + phaseDef.drift.spo2PerMin * driftPerTick)));
    }
    if (phaseDef.drift.sbpPerMin) {
      const [sbp, dbp] = (currentVitals.bp ?? "100/60").split("/").map(Number);
      const newSbp = Math.max(60, Math.round(sbp + phaseDef.drift.sbpPerMin * driftPerTick));
      const newDbp = Math.max(40, Math.round(dbp + (phaseDef.drift.dbpPerMin ?? 0) * driftPerTick));
      newVitals.bp = `${newSbp}/${newDbp}`;
    }

    runtime.scenarioEngine.applyVitalsAdjustment({
      hr: (newVitals.hr ?? 0) - (currentVitals.hr ?? 0),
      spo2: (newVitals.spo2 ?? 0) - (currentVitals.spo2 ?? 0),
    });
  }
}
