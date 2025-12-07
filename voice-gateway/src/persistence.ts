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
  {
    stageId?: string;
    fallback?: boolean;
    stageIdsKey?: string;
    budgetKey?: string;
    vitalsKey?: string;
    findingsKey?: string;
    ordersKey?: string;
    lastWrite?: number;
  }
> = new Map();

const makeKey = (obj: any): string => JSON.stringify(obj);

export async function persistSimState(simId: string, state: SimState & { budget?: BudgetState }) {
  const db = getFirestore();
  if (!db) return;
  const cache = stateCache.get(simId) ?? {};
  const vitalsKey = makeKey(state.vitals || {});
  const budgetKey = makeKey(state.budget || {});
  const findingsKey = makeKey(state.findings || []);
  const ordersKey = makeKey(state.orders || []);
  const stageIdsKey = makeKey(state.stageIds || []);
  const now = Date.now();
  const shouldSkip =
    cache.stageId === state.stageId &&
    cache.fallback === state.fallback &&
    cache.vitalsKey === vitalsKey &&
    cache.findingsKey === findingsKey &&
    cache.budgetKey === budgetKey &&
    cache.ordersKey === ordersKey &&
    cache.stageIdsKey === stageIdsKey &&
    cache.lastWrite &&
    now - cache.lastWrite < 500;
  if (shouldSkip) return;

  const docRef = db.collection("sessions").doc(simId);
  const payload: Record<string, unknown> = {
    stageId: state.stageId,
    scenarioId: state.scenarioId,
    vitals: state.vitals,
    findings: state.findings ?? [],
    fallback: state.fallback,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (state.stageIds) {
    payload.stageIds = state.stageIds;
  }
  if (state.budget) {
    payload.budget = state.budget;
  }
  if (state.orders) {
    payload.orders = state.orders;
  }
  await docRef.set(payload, { merge: true });
  stateCache.set(simId, {
    stageId: state.stageId,
    fallback: state.fallback,
    vitalsKey,
    findingsKey,
    budgetKey,
    ordersKey,
    stageIdsKey,
    lastWrite: now,
  });
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
