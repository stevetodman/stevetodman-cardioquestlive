/**
 * Analysis Requests Handler
 * Handles debrief and transcript analysis for simple and complex scenarios.
 */

import { DebriefTurn, CharacterId } from "../messageTypes";
import { SessionManager } from "../sessionManager";
import { Runtime } from "../typesRuntime";
import { log, logError } from "../logger";
import { analyzeTranscript, analyzeComplexScenario, type ComplexScenarioId } from "../debriefAnalyzer";
import { getScenarioForSession } from "../patientEngine";
import { hasSVTExtended, hasMyocarditisExtended } from "../sim/types";

// ============================================================================
// Types
// ============================================================================

export interface AnalysisDeps {
  sessionManager: SessionManager;
  runtimes: Map<string, Runtime>;
}

export interface AnalysisHandlers {
  handleAnalyzeTranscript: (sessionId: string, turns: DebriefTurn[]) => Promise<void>;
}

// ============================================================================
// Factory
// ============================================================================

export function createAnalysisHandler(deps: AnalysisDeps): AnalysisHandlers {
  const { sessionManager, runtimes } = deps;

  async function handleAnalyzeTranscript(sessionId: string, turns: DebriefTurn[]): Promise<void> {
    if (!Array.isArray(turns) || turns.length === 0) return;

    try {
      const runtime = runtimes.get(sessionId);
      const scenarioId = getScenarioForSession(sessionId);

      // Check if this is a complex scenario with extended state
      if (runtime?.scenarioEngine) {
        const simState = runtime.scenarioEngine.getState();

        // Early debrief guard: ensure minimum meaningful interaction for complex scenarios
        const isComplexScenario =
          scenarioId === "teen_svt_complex_v1" || scenarioId === "peds_myocarditis_silent_crash_v1";
        if (isComplexScenario) {
          const timelineEvents = (simState.extended as any)?.timelineEvents ?? [];
          const hasMinimumActions = turns.length >= 3 || timelineEvents.length >= 3;

          if (!hasMinimumActions) {
            log("Debrief skipped: insufficient actions", {
              sessionId,
              turns: turns.length,
              events: timelineEvents.length,
            });
            sessionManager.broadcastToPresenters(sessionId, {
              type: "analysis_result",
              sessionId,
              summary: "Not enough interaction to generate a meaningful debrief. Continue the scenario and try again.",
              strengths: [],
              opportunities: ["Try ordering diagnostics, performing exams, or talking to the patient/family."],
              teachingPoints: [],
            });
            return;
          }
        }

        // SVT complex scenario
        if (scenarioId === "teen_svt_complex_v1" && hasSVTExtended(simState)) {
          const scenarioStartTime = simState.extended.scenarioStartedAt;
          const complexResult = await analyzeComplexScenario(
            turns,
            simState.extended,
            scenarioStartTime,
            "teen_svt_complex_v1" as ComplexScenarioId
          );
          sessionManager.broadcastToPresenters(sessionId, {
            type: "complex_debrief_result",
            sessionId,
            scenarioId: "teen_svt_complex_v1",
            ...complexResult,
          });
          return;
        }

        // Myocarditis complex scenario
        if (scenarioId === "peds_myocarditis_silent_crash_v1" && hasMyocarditisExtended(simState)) {
          const scenarioStartTime = simState.extended.scenarioStartedAt;
          const complexResult = await analyzeComplexScenario(
            turns,
            simState.extended,
            scenarioStartTime,
            "peds_myocarditis_silent_crash_v1" as ComplexScenarioId
          );
          sessionManager.broadcastToPresenters(sessionId, {
            type: "complex_debrief_result",
            sessionId,
            scenarioId: "peds_myocarditis_silent_crash_v1",
            ...complexResult,
          });
          return;
        }
      }

      // Fallback to simple transcript analysis for non-complex scenarios
      const result = await analyzeTranscript(turns);
      sessionManager.broadcastToPresenters(sessionId, {
        type: "analysis_result",
        sessionId,
        summary: result.summary,
        strengths: result.strengths,
        opportunities: result.opportunities,
        teachingPoints: result.teachingPoints,
      });
    } catch (err) {
      logError("Debrief analysis error", err);
      // Send fallback error response so presenter doesn't wait forever
      sessionManager.broadcastToPresenters(sessionId, {
        type: "analysis_result",
        sessionId,
        summary: "Debrief analysis failed. Please try again.",
        strengths: [],
        opportunities: [],
        teachingPoints: [],
      });
    }
  }

  return {
    handleAnalyzeTranscript,
  };
}
