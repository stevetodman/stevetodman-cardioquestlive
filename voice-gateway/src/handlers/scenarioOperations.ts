/**
 * Scenario Operations Handler
 * Extracted from index.ts to handle scenario changes and SVT phase transitions.
 */

import type { PatientScenarioId } from "../messageTypes";
import type { SVTExtendedState } from "../sim/types";
import { hasSVTExtended } from "../sim/types";
import { SVT_PHASES } from "../sim/scenarios/teen_svt_complex";
import { setScenarioForSession } from "../patientEngine";
import { tryWithStateLock } from "../stateLock";
import { buildTelemetryWaveform, checkAlarms } from "../telemetry";
import type { SessionManager } from "../sessionManager";
import type { Runtime } from "../typesRuntime";
import type { EventLogEntry, EventType } from "../sim/types";
import type { SimStatePayload } from "../state/broadcastUtils";

const log = (...args: unknown[]) => console.log("[scenario-ops]", ...args);
const logError = (...args: unknown[]) => console.error("[scenario-ops]", ...args);

/** Heartbeat interval in ms - should match index.ts */
const scenarioHeartbeatMs = 5000;

/**
 * Dependencies for the scenario operations handler
 */
export interface ScenarioOperationsDeps {
  ensureRuntime: (sessionId: string) => Runtime;
  sessionManager: SessionManager;
  runtimes: Map<string, Runtime>;
  scenarioTimers: Map<string, ReturnType<typeof setInterval>>;
  alarmSeenAt: Map<string, { spo2Low?: number; hrHigh?: number; hrLow?: number }>;
  eventLog: {
    append: (entry: EventLogEntry) => void;
  };
  broadcastSimState: (sessionId: string, state: SimStatePayload) => void;
  fireAndForget: (promise: Promise<unknown>, context: string, sessionId?: string) => void;
  logSimEvent: (sessionId: string, event: { type: string; payload?: Record<string, unknown> }) => Promise<void>;
  synthesizePatientAudio: (text: string, voice: string) => Promise<Buffer | null>;
}

/**
 * Handlers returned by the factory function
 */
export interface ScenarioOperationsHandlers {
  handleScenarioChange: (sessionId: string, scenarioId: PatientScenarioId) => void;
  startScenarioHeartbeat: (sessionId: string) => void;
}

/**
 * Factory function to create scenario operations handlers with injected dependencies
 */
export function createScenarioOperationsHandler(deps: ScenarioOperationsDeps): ScenarioOperationsHandlers {
  const {
    ensureRuntime,
    sessionManager,
    runtimes,
    scenarioTimers,
    alarmSeenAt,
    eventLog,
    broadcastSimState,
    fireAndForget,
    logSimEvent,
    synthesizePatientAudio,
  } = deps;

  /**
   * Handle scenario change requests - validates and updates the scenario
   */
  function handleScenarioChange(sessionId: string, scenarioId: PatientScenarioId) {
    const allowed: PatientScenarioId[] = [
      "exertional_chest_pain",
      "syncope",
      "palpitations_svt",
      "myocarditis",
      "exertional_syncope_hcm",
      "ductal_shock",
      "cyanotic_spell",
      "kawasaki",
      "coarctation_shock",
      "arrhythmogenic_syncope",
      "teen_svt_complex_v1",
      "peds_myocarditis_silent_crash_v1",
    ];
    if (!allowed.includes(scenarioId)) {
      log("Ignoring invalid scenarioId", scenarioId);
      return;
    }
    setScenarioForSession(sessionId, scenarioId);
    ensureRuntime(sessionId);
    log("Scenario changed", sessionId, scenarioId);
    sessionManager.broadcastToPresenters(sessionId, {
      type: "scenario_changed",
      sessionId,
      scenarioId,
    });
  }

  /**
   * Handle SVT phase transitions based on time and state.
   * Auto-advances from presentation → svt_onset after 2 minutes,
   * and handles deterioration if untreated.
   */
  function tickSVTPhase(sessionId: string, runtime: Runtime, ext: SVTExtendedState) {
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

  /**
   * Start the scenario heartbeat timer for a session
   */
  function startScenarioHeartbeat(sessionId: string) {
    if (scenarioTimers.has(sessionId)) return;
    const tick = () => {
      const runtime = runtimes.get(sessionId);
      if (!runtime) return;

      // Handle SVT phase transitions with state lock to prevent race conditions
      // Uses tryWithStateLock to skip if treatment is in progress (will tick next heartbeat)
      const state = runtime.scenarioEngine.getState();
      if (hasSVTExtended(state)) {
        tryWithStateLock(sessionId, "svtPhaseTick", async () => {
          // Re-fetch state inside lock to ensure we have latest
          const freshState = runtime.scenarioEngine.getState();
          if (hasSVTExtended(freshState)) {
            tickSVTPhase(sessionId, runtime, freshState.extended);
          }
        }).catch((err) => logError("[tick] SVT phase tick failed:", err));
      }

      const result = runtime.scenarioEngine.tick(Date.now());
      const telemetryWaveform = runtime.scenarioEngine.getState().telemetry
        ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
        : undefined;
      checkAlarms(sessionId, runtime, alarmSeenAt, sessionManager);
      if (result) {
        if (runtime.scenarioEngine.getState().telemetry) {
          const rhythm = runtime.scenarioEngine.getState().rhythmSummary;
          const history = runtime.scenarioEngine.getState().telemetryHistory ?? [];
          if (rhythm && (history.length === 0 || history[history.length - 1]?.rhythm !== rhythm)) {
            runtime.scenarioEngine.setTelemetryHistory([...history, { ts: Date.now(), rhythm }]);
          }
        }
        result.events?.forEach((evt: { type: string; payload?: Record<string, unknown> }) =>
          eventLog.append({
            id: `${Date.now()}-${Math.random()}`,
            ts: Date.now(),
            simId: sessionId,
            type: evt.type as EventType,
            payload: evt.payload,
          })
        );
        result.events?.forEach((evt: { type: string; payload?: Record<string, unknown> }) =>
          fireAndForget(logSimEvent(sessionId, { type: evt.type, payload: evt.payload }), `logSimEvent:${evt.type}`)
        );
        broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
          telemetryWaveform,
          elapsedSeconds: runtime.scenarioEngine.getElapsedSeconds(),
          budget: runtime.cost.getState?.(),
        });
      } else {
        // Always broadcast to keep elapsed time updated
        broadcastSimState(sessionId, {
          ...runtime.scenarioEngine.getState(),
          stageIds: runtime.scenarioEngine.getStageIds(),
          telemetryWaveform,
          elapsedSeconds: runtime.scenarioEngine.getElapsedSeconds(),
          budget: runtime.cost.getState?.(),
        });
      }
    };
    const handle = setInterval(tick, scenarioHeartbeatMs);
    scenarioTimers.set(sessionId, handle);
  }

  return {
    handleScenarioChange,
    startScenarioHeartbeat,
  };
}
