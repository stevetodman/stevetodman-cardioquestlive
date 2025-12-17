import { getFirestore } from "./firebaseAdmin";
import admin from "firebase-admin";
import { SimState } from "./sim/types";
import { z } from "zod";
import { validateExtendedState } from "./extendedStateValidators";
import { log, logError } from "./logger";

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
    // Validate extended state before persistence
    const validation = validateExtendedState(state.scenarioId, state.extended);
    if (!validation.valid) {
      logError(`[persistSimState] Invalid extended state for ${simId}:`, validation.errors);
      // Still persist but log the error - don't lose data
    }
    if (validation.warnings.length > 0) {
      log(`[persistSimState] Extended state warnings for ${simId}:`, validation.warnings);
    }
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
          type: z.enum(["vitals", "ekg", "labs", "imaging", "cardiac_exam", "lung_exam", "general_exam", "iv_access"]),
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

/** Validate hydration consistency and log warnings (doesn't fail hydration) */
function validateHydrationConsistency(data: z.infer<typeof persistedStateSchema>): void {
  const warnings: string[] = [];

  // Check order completion timestamps are reasonable
  if (data.orders) {
    for (const order of data.orders) {
      if (order.completedAt !== undefined) {
        // completedAt should be a positive timestamp (after Unix epoch)
        if (order.completedAt < 0) {
          warnings.push(`Order ${order.id}: negative completedAt (${order.completedAt})`);
        }
        // completedAt should be in the past (not more than 1 minute in the future)
        if (order.completedAt > Date.now() + 60_000) {
          warnings.push(`Order ${order.id}: completedAt in far future (${new Date(order.completedAt).toISOString()})`);
        }
      }
      // completed status should have completedAt
      if (order.status === "complete" && order.completedAt === undefined) {
        warnings.push(`Order ${order.id}: status 'complete' but no completedAt`);
      }
    }
  }

  // Check timeline event monotonicity (if extended state has timelineEvents)
  if (data.extended?.timelineEvents && Array.isArray(data.extended.timelineEvents)) {
    const events = data.extended.timelineEvents as Array<{ ts: number; type: string }>;
    let lastTs = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (typeof event.ts === "number") {
        if (event.ts < lastTs) {
          warnings.push(`Timeline event ${i} (${event.type}): timestamp ${event.ts} < previous ${lastTs}`);
        }
        lastTs = event.ts;
      }
    }
  }

  // Check scenario clock consistency (if extended state has clock fields)
  if (data.extended) {
    const ext = data.extended as Record<string, unknown>;
    const scenarioStartedAt = ext.scenarioStartedAt as number | undefined;
    const totalPausedMs = ext.totalPausedMs as number | undefined;

    if (scenarioStartedAt !== undefined && scenarioStartedAt > Date.now() + 60_000) {
      warnings.push(`scenarioStartedAt in far future: ${new Date(scenarioStartedAt).toISOString()}`);
    }

    if (totalPausedMs !== undefined && totalPausedMs < 0) {
      warnings.push(`totalPausedMs is negative: ${totalPausedMs}`);
    }

    // Check phase entered timestamps make sense
    const phaseEnteredAt = ext.phaseEnteredAt as number | undefined;
    if (phaseEnteredAt !== undefined && scenarioStartedAt !== undefined) {
      if (phaseEnteredAt < scenarioStartedAt) {
        warnings.push(`phaseEnteredAt (${phaseEnteredAt}) < scenarioStartedAt (${scenarioStartedAt})`);
      }
    }
  }

  // Check telemetry/EKG/treatment history timestamps
  const historyChecks = [
    { name: "telemetryHistory", data: data.telemetryHistory },
    { name: "ekgHistory", data: data.ekgHistory },
    { name: "treatmentHistory", data: data.treatmentHistory },
  ];

  for (const { name, data: historyData } of historyChecks) {
    if (historyData && Array.isArray(historyData)) {
      let lastTs = 0;
      for (let i = 0; i < historyData.length; i++) {
        const entry = historyData[i] as { ts?: number };
        if (typeof entry.ts === "number") {
          if (entry.ts < lastTs) {
            warnings.push(`${name}[${i}]: timestamp ${entry.ts} < previous ${lastTs}`);
          }
          lastTs = entry.ts;
        }
      }
    }
  }

  // Log all warnings (don't fail hydration - graceful degradation)
  if (warnings.length > 0) {
    log(`[validateHydrationConsistency] ${warnings.length} consistency warnings:`, warnings);
  }
}

export function sanitizePersistedState(raw: any, updatedAtMs: number): Partial<SimState> {
  const parsed = persistedStateSchema.safeParse(raw);
  if (!parsed.success) {
    logError("[sanitizePersistedState] Failed to parse persisted state:", parsed.error.errors);
    return { updatedAtMs } as any;
  }

  const data = parsed.data;

  // Run consistency checks (logs warnings but doesn't fail)
  validateHydrationConsistency(data);

  // Validate extended state if present and scenarioId is known
  if (data.extended && data.scenarioId) {
    const validation = validateExtendedState(data.scenarioId, data.extended);
    if (!validation.valid) {
      logError(`[sanitizePersistedState] Invalid extended state for scenario ${data.scenarioId}:`, validation.errors);
      // Don't fail hydration - log error but continue with the data
      // The debrief analyzer will need to handle potential issues gracefully
    }
    if (validation.warnings.length > 0) {
      log(`[sanitizePersistedState] Extended state warnings:`, validation.warnings);
    }
  }

  return { ...data, updatedAtMs } as Partial<SimState>;
}
