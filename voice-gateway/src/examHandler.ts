/**
 * Exam and Telemetry Handler - Manages physical exam and monitoring requests.
 * Extracted from index.ts for better maintainability.
 *
 * Handles:
 * - Physical exam requests (cardiac, lung, general)
 * - Telemetry toggle (on/off)
 * - EKG display requests
 */

import { SessionManager } from "./sessionManager";
import { ScenarioEngine } from "./sim/scenarioEngine";
import { buildTelemetryWaveform } from "./telemetry";
import { logSimEvent } from "./persistence";

type ExamOrderType = "cardiac_exam" | "lung_exam" | "general_exam";

export type ExamHandlerDeps = {
  sessionManager: SessionManager;
  ensureRuntime: (sessionId: string) => {
    scenarioEngine: ScenarioEngine;
    cost: { getState?: () => any };
    fallback: boolean;
  };
  broadcastSimState: (sessionId: string, state: any) => void;
};

export function createExamHandler(deps: ExamHandlerDeps) {
  const { sessionManager, ensureRuntime, broadcastSimState } = deps;

  function handleExamRequest(sessionId: string, examType?: string) {
    const runtime = ensureRuntime(sessionId);
    const state = runtime.scenarioEngine.getState();
    const exam = state.exam ?? {};
    const maneuver = examType ?? (runtime as any).lastManeuver as string | undefined;

    // Determine which exam order type to create based on the maneuver/request
    let orderType: ExamOrderType = "general_exam";
    if (maneuver === "cardiac" || maneuver === "auscultation" || maneuver === "heart" || maneuver === "cardiovascular") {
      orderType = "cardiac_exam";
    } else if (maneuver === "pulmonary" || maneuver === "lungs" || maneuver === "respiratory" || maneuver === "breath") {
      orderType = "lung_exam";
    }

    // Create exam order
    const currentOrders = state.orders ?? [];
    const newOrder = {
      id: `order-${orderType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: orderType,
      status: "pending" as const,
    };
    const nextOrders = [...currentOrders, newOrder];

    // Persist orders to scenarioEngine so subsequent broadcasts include them
    runtime.scenarioEngine.hydrate({ orders: nextOrders });

    // Broadcast pending state
    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      orders: nextOrders,
    });

    // After brief delay, complete the exam order and announce results
    setTimeout(() => {
      // Get current orders from scenarioEngine (may have been updated since)
      const currentState = runtime.scenarioEngine.getState();
      const currentOrders = currentState.orders ?? nextOrders;
      const completedOrders = currentOrders.map((o: any) =>
        o.id === newOrder.id ? { ...o, status: "complete" as const, completedAt: Date.now() } : o
      );

      // Persist completed orders to scenarioEngine
      runtime.scenarioEngine.hydrate({ orders: completedOrders });

      // Build exam summary based on exam type
      let summary: string;
      if (orderType === "cardiac_exam") {
        summary = exam.cardio ? `CV exam: ${exam.cardio}` : "Cardiac exam: Normal heart sounds, regular rate and rhythm.";
      } else if (orderType === "lung_exam") {
        summary = exam.lungs ? `Lung exam: ${exam.lungs}` : "Lung exam: Clear to auscultation bilaterally.";
      } else {
        // general exam - show all
        summary = [
          exam.general && `General: ${exam.general}`,
          exam.cardio && `CV: ${exam.cardio}`,
          exam.lungs && `Lungs: ${exam.lungs}`,
          exam.perfusion && `Perfusion: ${exam.perfusion}`,
          exam.neuro && `Neuro: ${exam.neuro}`,
        ]
          .filter(Boolean)
          .join(" | ") || "Exam: Appears well, no acute distress.";
      }

      // Nurse reports exam findings
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_state",
        sessionId,
        state: "speaking",
        character: "nurse",
      });
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: summary,
        character: "nurse",
      });

      // If cardiac exam, prompt about heart sounds
      if (orderType === "cardiac_exam" && exam.heartAudioUrl) {
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_transcript_delta",
          sessionId,
          text: "Heart sounds available - use your headphones to listen.",
          character: "nurse",
        });
      }
      // If lung exam, prompt about breath sounds
      if (orderType === "lung_exam" && exam.lungAudioUrl) {
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_transcript_delta",
          sessionId,
          text: "Breath sounds available - use your headphones to listen.",
          character: "nurse",
        });
      }

      sessionManager.broadcastToSession(sessionId, {
        type: "patient_state",
        sessionId,
        state: "idle",
        character: "nurse",
      });

      // Broadcast updated state with completed order
      broadcastSimState(sessionId, {
        ...runtime.scenarioEngine.getState(),
        stageIds: runtime.scenarioEngine.getStageIds(),
        orders: completedOrders,
      });

      logSimEvent(sessionId, { type: `exam.${orderType}.complete`, payload: { summary } }).catch(() => {});
    }, 1500);

    logSimEvent(sessionId, { type: "exam.requested", payload: { maneuver: maneuver ?? "standard", orderType } }).catch(() => {});
  }

  function handleTelemetryToggle(sessionId: string, enabled: boolean) {
    const runtime = ensureRuntime(sessionId);
    runtime.scenarioEngine.setTelemetry(enabled, runtime.scenarioEngine.getState().rhythmSummary);
    const telemetryWaveform = enabled ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90) : [];
    const telemetryHistory = runtime.scenarioEngine.getState().telemetryHistory ?? [];

    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      telemetry: enabled,
      telemetryWaveform,
      telemetryHistory,
    });

    if (enabled) {
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: "Telemetry leads on. Live rhythm streaming.",
        character: "tech",
      });
    }

    logSimEvent(sessionId, { type: "telemetry.toggle", payload: { enabled } }).catch(() => {});
  }

  function handleShowEkg(sessionId: string) {
    const runtime = ensureRuntime(sessionId);
    const ekgs = (runtime.scenarioEngine.getState().orders ?? []).filter((o) => o.type === "ekg" && o.status === "complete");
    const latest = ekgs.length ? ekgs[ekgs.length - 1] : null;
    const summary = latest?.result?.summary ?? runtime.scenarioEngine.getState().rhythmSummary ?? "Latest EKG ready to view.";
    const imageUrl = (latest?.result as any)?.imageUrl;
    const telemetryWaveform = runtime.scenarioEngine.getState().telemetry
      ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
      : undefined;

    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: `EKG: ${summary}`,
      character: "tech",
    });

    if (imageUrl) {
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: `EKG image: ${imageUrl}`,
        character: "tech",
      });
    }

    // Keep a rolling archive of last 3 ekg ids/urls on runtime
    const entry = { ts: Date.now(), summary, imageUrl };
    const updatedArchive = [...(runtime.scenarioEngine.getState().ekgHistory ?? []), entry].slice(-3);
    runtime.scenarioEngine.setEkgHistory(updatedArchive);

    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      telemetryWaveform,
    });

    logSimEvent(sessionId, { type: "ekg.viewed", payload: { summary, imageUrl } }).catch(() => {});
  }

  return {
    handleExamRequest,
    handleTelemetryToggle,
    handleShowEkg,
  };
}
