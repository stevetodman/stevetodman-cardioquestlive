import { getOrderResultTemplate } from "./orderTemplates";
import { buildTelemetryWaveform } from "./telemetry";
import { logSimEvent } from "./persistence";
import { assetExists } from "./assetUtils";
import { PatientScenarioId } from "./patientCase";
import { SessionManager } from "./sessionManager";
import { Runtime } from "./typesRuntime";
import { OrderResult } from "./messageTypes";

// ============================================================================
// Types
// ============================================================================

export type OrderType = "vitals" | "ekg" | "labs" | "imaging" | "cardiac_exam" | "lung_exam" | "general_exam" | "iv_access";

export interface OrderedBy {
  id: string;
  name: string;
  role: "presenter" | "participant";
}

export interface Order {
  id: string;
  type: OrderType;
  status: "pending" | "complete";
  orderedAt: number;
  orderedBy: OrderedBy;
  expectedCompletionAt?: number; // For pending orders - when timer will fire
  completedAt?: number;
  result?: OrderResult;
  // IV-specific params
  ivParams?: {
    gauge: number;
    location: string;
  };
}

export type OrderDeps = {
  ensureRuntime: (sessionId: string) => Runtime;
  sessionManager: SessionManager;
  broadcastSimState: (sessionId: string, state: any) => void;
  schedule?: (fn: () => void, ms: number) => any;
};

// ============================================================================
// Timing Configuration
// ============================================================================

/** Get realistic delay for order type (in ms) */
function getOrderDelay(orderType: OrderType): number {
  switch (orderType) {
    case "vitals":
      return 1500; // Quick reassessment
    case "ekg":
      // 90-120 seconds (realistic time to get machine, place leads)
      return 90_000 + Math.floor(Math.random() * 30_000);
    case "imaging":
      // 180-240 seconds (3-4 minutes for portable CXR)
      return 180_000 + Math.floor(Math.random() * 60_000);
    case "labs":
      // 2-3 minutes for draw + send
      return 120_000 + Math.floor(Math.random() * 60_000);
    case "iv_access":
      // 45-75 seconds (find vein, prep site, place catheter)
      return 45_000 + Math.floor(Math.random() * 30_000);
    case "cardiac_exam":
    case "lung_exam":
    case "general_exam":
      return 500; // Near-instant (facilitator response)
    default:
      return 2200;
  }
}

/** Get nurse acknowledgment message with ETA */
function getNurseAcknowledgment(orderType: OrderType): string {
  switch (orderType) {
    case "ekg":
      return "Yes, Doctor. I'll get the EKG machine. Should have it for you in a couple minutes.";
    case "imaging":
      return "X-ray ordered. Tech says about 3-4 minutes for portable.";
    case "labs":
      return "Drawing labs now. Results in about 10-15 minutes.";
    case "vitals":
      return "Rechecking vitals now.";
    case "iv_access":
      return "Got it, starting an IV. Give me a minute to find a good vein.";
    case "cardiac_exam":
    case "lung_exam":
    case "general_exam":
      return ""; // No ack needed for exams
    default:
      return "Working on it.";
  }
}

/** Get "still working" message for duplicate orders */
function getStillWorkingMessage(orderType: OrderType): string {
  switch (orderType) {
    case "ekg":
      return "Still working on the current EKG. Should be ready soon.";
    case "imaging":
      return "X-ray tech is still setting up. Almost ready.";
    case "labs":
      return "Labs were just sent. Still waiting on results.";
    case "iv_access":
      return "Still working on the IV. Almost got it.";
    default:
      return "Still working on that order.";
  }
}

// ============================================================================
// Pending Order Tracking (per session)
// ============================================================================

const pendingOrders = new Map<string, Map<OrderType, { orderId: string; timerId: any }>>();

function getPendingOrder(sessionId: string, orderType: OrderType): { orderId: string; timerId: any } | undefined {
  return pendingOrders.get(sessionId)?.get(orderType);
}

function setPendingOrder(sessionId: string, orderType: OrderType, orderId: string, timerId: any): void {
  if (!pendingOrders.has(sessionId)) {
    pendingOrders.set(sessionId, new Map());
  }
  pendingOrders.get(sessionId)!.set(orderType, { orderId, timerId });
}

function clearPendingOrder(sessionId: string, orderType: OrderType): void {
  pendingOrders.get(sessionId)?.delete(orderType);
}

/** Clear all pending orders for a session (on disconnect) */
export function clearSessionPendingOrders(sessionId: string): void {
  const sessionPending = pendingOrders.get(sessionId);
  if (sessionPending) {
    for (const [, { timerId }] of sessionPending) {
      clearTimeout(timerId);
    }
    pendingOrders.delete(sessionId);
  }
}

/** Check if an order type is currently pending */
export function hasPendingOrder(sessionId: string, orderType: OrderType): boolean {
  return !!getPendingOrder(sessionId, orderType);
}

/** Clear all pending orders (for testing) */
export function clearPendingOrders(): void {
  pendingOrders.clear();
}

// ============================================================================
// Order Creation & Resolution
// ============================================================================

function makeOrder(
  type: OrderType,
  orderedBy: OrderedBy,
  delayMs: number,
  ivParams?: { gauge: number; location: string }
): Order {
  const now = Date.now();
  return {
    id: `order-${type}-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    status: "pending",
    orderedAt: now,
    orderedBy,
    expectedCompletionAt: now + delayMs,
    ivParams,
  };
}

function resolveOrder(
  order: Order,
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
      ? "Ordered to assess cardiopulmonary status."
      : order.type.includes("exam")
      ? "Ordered for clinical assessment."
      : "Ordered to reassess vitals.";
  return result;
}

// ============================================================================
// Order Handler Factory
// ============================================================================

export interface HandleOrderResult {
  success: boolean;
  message?: string; // Nurse ack or "still working" message
  order?: Order;
}

export interface IVOrderParams {
  gauge?: number;
  location?: string;
}

export function createOrderHandler(deps: OrderDeps) {
  const { ensureRuntime, sessionManager, broadcastSimState, schedule = setTimeout } = deps;

  return function handleOrder(
    sessionId: string,
    orderType: OrderType,
    orderedBy?: OrderedBy,
    ivParams?: IVOrderParams
  ): HandleOrderResult {
    const runtime = ensureRuntime(sessionId);

    // Check for duplicate pending order
    if (hasPendingOrder(sessionId, orderType)) {
      const stillWorkingMsg = getStillWorkingMessage(orderType);

      // Broadcast "still working" message from nurse
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: stillWorkingMsg,
        character: "nurse",
      });

      return { success: false, message: stillWorkingMsg };
    }

    // Calculate delay and create order
    const delayMs = getOrderDelay(orderType);
    const resolvedIvParams = orderType === "iv_access"
      ? { gauge: ivParams?.gauge ?? 22, location: ivParams?.location ?? "right_ac" }
      : undefined;
    const newOrder = makeOrder(
      orderType,
      orderedBy ?? { id: "system", name: "System", role: "presenter" },
      delayMs,
      resolvedIvParams
    );

    // Add to current orders and broadcast immediately
    // Note: existing orders may not have the new fields, so we cast and handle gracefully
    const currentOrders = (runtime.scenarioEngine.getState().orders ?? []) as Order[];
    const nextOrders = [...currentOrders, newOrder];

    broadcastSimState(sessionId, {
      ...runtime.scenarioEngine.getState(),
      stageIds: runtime.scenarioEngine.getStageIds(),
      orders: nextOrders,
    });

    // Broadcast nurse acknowledgment (if not an exam)
    const ackMessage = getNurseAcknowledgment(orderType);
    if (ackMessage) {
      // IV orders come from nurse, other orders from tech/imaging
      const character = orderType === "iv_access" ? "nurse" : orderType === "imaging" ? "imaging" : "tech";
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_state",
        sessionId,
        state: "speaking",
        character,
      });
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_transcript_delta",
        sessionId,
        text: ackMessage,
        character,
      });
      sessionManager.broadcastToSession(sessionId, {
        type: "patient_state",
        sessionId,
        state: "idle",
        character,
      });
    }

    // Log order placed event
    logSimEvent(sessionId, {
      type: `order.${orderType}.placed`,
      payload: {
        orderId: newOrder.id,
        orderedBy: newOrder.orderedBy,
        expectedCompletionAt: newOrder.expectedCompletionAt,
      },
    }).catch(() => {});

    // Schedule completion - pass nextOrders via closure so we have the order list
    const timerId = schedule(() => {
      completeOrder(sessionId, newOrder, nextOrders, runtime, sessionManager, broadcastSimState);
    }, delayMs);

    // Track pending order
    setPendingOrder(sessionId, orderType, newOrder.id, timerId);

    return { success: true, message: ackMessage, order: newOrder };
  };
}

// ============================================================================
// Order Completion
// ============================================================================

function completeOrder(
  sessionId: string,
  order: Order,
  ordersSnapshot: Order[], // Pass orders via closure since they aren't persisted in scenarioEngine
  runtime: Runtime,
  sessionManager: SessionManager,
  broadcastSimState: (sessionId: string, state: any) => void
): void {
  // Clear pending tracking
  clearPendingOrder(sessionId, order.type);

  const state = runtime.scenarioEngine.getState();
  const result = resolveOrder(order, state.scenarioId as PatientScenarioId, state.stageId);

  // Update order in the snapshot we received
  const updatedOrders = ordersSnapshot.map((o) =>
    o.id === order.id
      ? { ...o, status: "complete" as const, result, completedAt: Date.now() }
      : o
  );

  // Handle EKG-specific updates
  const stateRef: any = state;
  let ekgHistory = state.ekgHistory;
  if (order.type === "ekg") {
    const ekgSummary = result.summary ?? "EKG complete.";
    stateRef.telemetry = true;
    stateRef.rhythmSummary = ekgSummary;
    const entry = { ts: Date.now(), summary: ekgSummary, imageUrl: (result as any).imageUrl };
    ekgHistory = [...(state.ekgHistory ?? []), entry].slice(-3);
    runtime.scenarioEngine.setEkgHistory(ekgHistory);
  }

  // Build telemetry waveform if needed
  const telemetryWaveform =
    order.type === "ekg"
      ? buildTelemetryWaveform(state.vitals.hr ?? 90)
      : state.telemetry
      ? buildTelemetryWaveform(state.vitals.hr ?? 90)
      : undefined;

  // Broadcast updated state
  broadcastSimState(sessionId, {
    ...state,
    stageIds: runtime.scenarioEngine.getStageIds(),
    telemetry: order.type === "ekg" ? true : state.telemetry,
    rhythmSummary: order.type === "ekg" ? result.summary : state.rhythmSummary,
    telemetryWaveform,
    ekgHistory,
    orders: updatedOrders,
  });

  // Announce completion
  if (order.type === "ekg") {
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
  } else if (order.type === "imaging") {
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
  } else if (order.type === "labs") {
    const announcement =
      result?.summary && typeof result.summary === "string"
        ? `Lab results: ${result.summary}`
        : "Lab results are back.";
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: announcement,
      character: "nurse",
    });
  } else if (order.type === "iv_access" && order.ivParams) {
    // Update the interventions with IV placed
    const gauge = order.ivParams.gauge;
    const location = order.ivParams.location;
    const locationDisplay = location.replace(/_/g, " ");

    runtime.scenarioEngine.updateIntervention("iv", {
      location: location as any,
      gauge,
      fluidsRunning: false,
    });

    // Update SVT extended state if applicable (scenario has ivAccess field)
    const ivState = runtime.scenarioEngine.getState();
    if (ivState.extended && "ivAccess" in ivState.extended) {
      const ext = ivState.extended as any;
      runtime.scenarioEngine.updateExtended({
        ...ext,
        ivAccess: true,
        ivAccessTs: Date.now(),
        timelineEvents: [
          ...(ext.timelineEvents ?? []),
          { ts: Date.now(), type: "intervention", description: `IV access established (${gauge}g ${locationDisplay})` },
        ],
      });
    }

    // Announce IV completion
    const announcement = `IV is in — ${gauge} gauge in the ${locationDisplay}. Good blood return, flushing well.`;
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "speaking",
      character: "nurse",
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_transcript_delta",
      sessionId,
      text: announcement,
      character: "nurse",
    });
    sessionManager.broadcastToSession(sessionId, {
      type: "patient_state",
      sessionId,
      state: "idle",
      character: "nurse",
    });

    // Re-broadcast state with updated interventions
    const updatedState = runtime.scenarioEngine.getState();
    broadcastSimState(sessionId, {
      ...updatedState,
      stageIds: runtime.scenarioEngine.getStageIds(),
      orders: updatedOrders,
    });
  }

  // Log completion event
  logSimEvent(sessionId, {
    type: `order.${order.type}.complete`,
    payload: {
      orderId: order.id,
      result,
      completedAt: Date.now(),
      orderedBy: order.orderedBy,
    },
  }).catch(() => {});
}

// ============================================================================
// Order Resume (for reconnect/restart)
// ============================================================================

/**
 * Resume pending orders after gateway restart or client reconnect.
 * - Orders with expectedCompletionAt in the past: complete immediately
 * - Orders with expectedCompletionAt in the future: schedule remaining delay
 */
export function resumePendingOrders(
  sessionId: string,
  orders: Order[],
  deps: OrderDeps
): void {
  const { ensureRuntime, sessionManager, broadcastSimState, schedule = setTimeout } = deps;
  const runtime = ensureRuntime(sessionId);
  const now = Date.now();

  // Keep a mutable copy of orders that we update as we process
  let currentOrders = [...orders];

  for (const order of orders) {
    if (order.status !== "pending" || !order.expectedCompletionAt) continue;

    const remaining = order.expectedCompletionAt - now;

    if (remaining <= 0) {
      // Order should have completed while offline - complete immediately
      completeOrder(sessionId, order, currentOrders, runtime, sessionManager, broadcastSimState);
      // Update our local copy
      currentOrders = currentOrders.map(o =>
        o.id === order.id ? { ...o, status: "complete" as const } : o
      );
    } else {
      // Schedule remaining time - capture currentOrders at schedule time
      const ordersAtScheduleTime = [...currentOrders];
      const timerId = schedule(() => {
        completeOrder(sessionId, order, ordersAtScheduleTime, runtime, sessionManager, broadcastSimState);
      }, remaining);
      setPendingOrder(sessionId, order.type, order.id, timerId);
    }
  }
}
