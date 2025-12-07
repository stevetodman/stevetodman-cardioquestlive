import { getFirestore } from "./firebaseAdmin";
import admin from "firebase-admin";
import { SimState } from "./sim/types";

type BudgetState = {
  usdEstimate?: number;
  voiceSeconds?: number;
  throttled?: boolean;
};

const stateCache: Map<
  string,
  { stageId?: string; fallback?: boolean; budgetKey?: string; vitalsKey?: string; lastWrite?: number }
> = new Map();

function makeKey(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

export async function persistSimState(simId: string, state: SimState & { budget?: BudgetState }) {
  const db = getFirestore();
  if (!db) return;
  const cache = stateCache.get(simId) ?? {};
  const vitalsKey = makeKey(state.vitals || {});
  const budgetKey = makeKey(state.budget || {});
  const now = Date.now();
  const shouldSkip =
    cache.stageId === state.stageId &&
    cache.fallback === state.fallback &&
    cache.vitalsKey === vitalsKey &&
    cache.budgetKey === budgetKey &&
    cache.lastWrite &&
    now - cache.lastWrite < 500;
  if (shouldSkip) return;

  const docRef = db.collection("sessions").doc(simId);
  const payload: Record<string, unknown> = {
    stageId: state.stageId,
    scenarioId: state.scenarioId,
    vitals: state.vitals,
    fallback: state.fallback,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (state.budget) {
    payload.budget = state.budget;
  }
  await docRef.set(payload, { merge: true });
  stateCache.set(simId, { stageId: state.stageId, fallback: state.fallback, vitalsKey, budgetKey, lastWrite: now });
}

export type SimEvent = {
  type: string;
  payload?: Record<string, any>;
  correlationId?: string;
};

export async function logSimEvent(simId: string, event: SimEvent) {
  const db = getFirestore();
  if (!db) return;
  const colRef = db.collection("sessions").doc(simId).collection("events");
  await colRef.add({
    ts: admin.firestore.FieldValue.serverTimestamp(),
    type: event.type,
    payload: event.payload ?? {},
    ...(event.correlationId ? { correlationId: event.correlationId } : {}),
  });
}
