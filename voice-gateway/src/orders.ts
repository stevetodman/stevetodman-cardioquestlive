import { getOrderResultTemplate } from "./orderTemplates";
import { buildTelemetryWaveform } from "./telemetry";
import { logSimEvent } from "./persistence";
import { assetExists } from "./assetUtils";
import { PatientScenarioId } from "./patientCase";
import { SessionManager } from "./sessionManager";
import { Runtime } from "./typesRuntime";
import { OrderResult } from "./messageTypes";

type OrderType = "vitals" | "ekg" | "labs" | "imaging";

export type OrderDeps = {
  ensureRuntime: (sessionId: string) => Runtime;
  sessionManager: SessionManager;
  broadcastSimState: (sessionId: string, state: any) => void;
  schedule?: (fn: () => void, ms: number) => any;
};

function makeOrder(type: OrderType): { id: string; type: OrderType; status: "pending"; createdAt: number } {
  return {
    id: `order-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    status: "pending",
    createdAt: Date.now(),
  };
}

function resolveOrder(
  order: { id: string; type: OrderType; status: "pending" | "complete"; result?: OrderResult },
  scenario: PatientScenarioId,
  stageId?: string
): OrderResult {
  const result = getOrderResultTemplate(order.type, scenario, stageId);
  if ((order.type === "ekg" || order.type === "imaging") && (result as any).imageUrl) {
    const exists = assetExists((result as any).imageUrl as string);
    if (!exists) {
      (result as any).imageUrl = undefined;
      (result as any).summary = `${(result as any).summary ?? "Result ready"} (image unavailable)`;
    }
  }
  (result as any).rationale =
    order.type === "ekg"
      ? "Ordered for rhythm/ischemia evaluation."
      : order.type === "labs"
      ? "Ordered to assess perfusion, inflammation, and metabolic status."
      : order.type === "imaging"
      ? "Ordered to assess structure and perfusion."
      : "Ordered to reassess vitals.";
  return result;
}

export function createOrderHandler(deps: OrderDeps) {
  const { ensureRuntime, sessionManager, broadcastSimState, schedule = setTimeout } = deps;
  return function handleOrder(sessionId: string, orderType: OrderType) {
    const runtime = ensureRuntime(sessionId);
    const currentOrders = runtime.scenarioEngine.getState().orders ?? [];
    const newOrder = makeOrder(orderType);
    const nextOrders = [...currentOrders, newOrder];
    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      orders: nextOrders,
    });
    const delay = orderType === "vitals" ? 1500 : orderType === "ekg" ? 2500 : 2200;
    schedule(() => {
      const state = runtime.scenarioEngine.getState();
      const result = resolveOrder(newOrder, state.scenarioId as PatientScenarioId, state.stageId);
      const updatedOrders = nextOrders.map((o) =>
        o.id === newOrder.id ? { ...o, status: "complete", result, completedAt: Date.now() } : o
      );
      const stateRef: any = runtime.scenarioEngine.getState();
      if (orderType === "ekg") {
        const ekgSummary = result.summary ?? "EKG complete.";
        stateRef.telemetry = true;
        stateRef.rhythmSummary = ekgSummary;
        const entry = { ts: Date.now(), summary: ekgSummary, imageUrl: (result as any).imageUrl };
        const updatedHistory = [...(runtime.scenarioEngine.getState().ekgHistory ?? []), entry].slice(-3);
        runtime.scenarioEngine.setEkgHistory(updatedHistory);
      }
      const telemetryWaveform =
        orderType === "ekg"
          ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
          : runtime.scenarioEngine.getState().telemetry
          ? buildTelemetryWaveform(runtime.scenarioEngine.getState().vitals.hr ?? 90)
          : undefined;
      broadcastSimState(sessionId, {
        ...runtime.scenarioEngine.getState(),
        stageIds: runtime.scenarioEngine.getStageIds(),
        telemetry: orderType === "ekg" ? true : runtime.scenarioEngine.getState().telemetry,
        rhythmSummary: orderType === "ekg" ? result.summary : runtime.scenarioEngine.getState().rhythmSummary,
        telemetryWaveform,
        ekgHistory: runtime.scenarioEngine.getState().ekgHistory,
        orders: updatedOrders,
      });
      if (orderType === "ekg") {
        const announcement =
          result?.summary && typeof result.summary === "string"
            ? `EKG complete: ${result.summary}`
            : "EKG complete. Displaying the strip now.";
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_state",
          sessionId,
          state: "speaking",
          character: "tech",
        });
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_transcript_delta",
          sessionId,
          text: announcement,
          character: "tech",
        });
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_state",
          sessionId,
          state: "idle",
          character: "tech",
        });
      } else if (orderType === "imaging") {
        const announcement =
          result?.summary && typeof result.summary === "string"
            ? `Chest X-ray complete: ${result.summary}`
            : "Chest X-ray complete. Showing the image now.";
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_state",
          sessionId,
          state: "speaking",
          character: "imaging",
        });
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_transcript_delta",
          sessionId,
          text: announcement,
          character: "imaging",
        });
        sessionManager.broadcastToSession(sessionId, {
          type: "patient_state",
          sessionId,
          state: "idle",
          character: "imaging",
        });
        if ((result as any).imageUrl === undefined) {
          sessionManager.broadcastToPresenters(sessionId, {
            type: "patient_transcript_delta",
            sessionId,
            text: "Imaging: image asset not available; showing summary only.",
            character: "imaging",
          });
        }
      }
      logSimEvent(sessionId, {
        type: `order.${orderType}.complete`,
        payload: { result, completedAt: Date.now() },
      }).catch(() => {});
    }, delay);
  };
}
