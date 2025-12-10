import { getFirestore } from "./firebaseAdmin";
import admin from "firebase-admin";
import { SimState } from "./sim/types";
import { z } from "zod";

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
    telemetryKey?: string;
    ekgKey?: string;
    treatmentKey?: string;
    extendedKey?: string;
    stageEnteredAt?: number;
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
  const telemetryKey = makeKey(state.telemetryHistory || []);
  const ekgKey = makeKey(state.ekgHistory || []);
  const treatmentKey = makeKey(state.treatmentHistory || []);
  const extendedKey = makeKey(state.extended || {});
  const stageEnteredAt = state.stageEnteredAt;
  const now = Date.now();
  const shouldSkip =
    cache.stageId === state.stageId &&
    cache.fallback === state.fallback &&
    cache.vitalsKey === vitalsKey &&
    cache.findingsKey === findingsKey &&
    cache.budgetKey === budgetKey &&
    cache.ordersKey === ordersKey &&
    cache.stageIdsKey === stageIdsKey &&
    cache.telemetryKey === telemetryKey &&
    cache.ekgKey === ekgKey &&
    cache.treatmentKey === treatmentKey &&
    cache.extendedKey === extendedKey &&
    cache.stageEnteredAt === stageEnteredAt &&
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
    stageEnteredAt,
    telemetry: state.telemetry,
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
  if (state.telemetryHistory) {
    payload.telemetryHistory = state.telemetryHistory;
  }
  if (state.ekgHistory) {
    payload.ekgHistory = state.ekgHistory;
  }
  if (state.telemetryWaveform) {
    payload.telemetryWaveform = state.telemetryWaveform;
  }
  if (state.treatmentHistory) {
    payload.treatmentHistory = state.treatmentHistory;
  }
  if (state.extended) {
    payload.extended = state.extended;
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
    telemetryKey,
    ekgKey,
    treatmentKey,
    extendedKey,
    stageEnteredAt,
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

export async function loadSimState(simId: string): Promise<Partial<SimState> | null> {
  const db = getFirestore();
  if (!db) return null;
  const docRef = db.collection("sessions").doc(simId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const updatedAtMs = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now();
  return sanitizePersistedState(data, updatedAtMs);
}

const persistedStateSchema = z
  .object({
    stageId: z.string().optional(),
    scenarioId: z.string().optional(),
    vitals: z
      .object({
        hr: z.number().optional(),
        bp: z.string().optional(),
        rr: z.number().optional(),
        spo2: z.number().optional(),
        temp: z.number().optional(),
      })
      .optional(),
    findings: z.array(z.string()).optional(),
    fallback: z.boolean().optional(),
    stageIds: z.array(z.string()).optional(),
    examAudio: z
      .array(
        z.object({
          type: z.enum(["heart", "lung"]),
          label: z.string(),
          url: z.string(),
          stageId: z.string().optional(),
        })
      )
      .optional(),
    orders: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(["vitals", "ekg", "labs", "imaging"]),
          status: z.enum(["pending", "complete"]),
          result: z.record(z.any()).optional(),
          completedAt: z.number().optional(),
        })
      )
      .optional(),
    budget: z
      .object({
        usdEstimate: z.number().optional(),
        voiceSeconds: z.number().optional(),
        throttled: z.boolean().optional(),
        fallback: z.boolean().optional(),
      })
      .optional(),
    telemetryHistory: z.array(z.record(z.any())).optional(),
    ekgHistory: z.array(z.record(z.any())).optional(),
    telemetryWaveform: z.array(z.number()).optional(),
    treatmentHistory: z.array(z.record(z.any())).optional(),
    stageEnteredAt: z.number().optional(),
    telemetry: z.boolean().optional(),
    // Extended state for complex scenarios (SVT, myocarditis, etc.)
    // Uses passthrough to allow scenario-specific fields
    extended: z.record(z.any()).optional(),
  })
  .passthrough();

export function sanitizePersistedState(raw: any, updatedAtMs: number): Partial<SimState> {
  const parsed = persistedStateSchema.safeParse(raw);
  if (!parsed.success) {
    return { updatedAtMs } as any;
  }
  return { ...parsed.data, updatedAtMs } as Partial<SimState>;
}
