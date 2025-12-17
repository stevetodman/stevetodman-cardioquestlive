/**
 * Extended State Validators - Zod schemas for complex scenario states
 *
 * These schemas validate the extended state for SVT and Myocarditis scenarios
 * to prevent malformed data from corrupting the scoring system or crashing
 * the debrief analyzer.
 */

import { z } from "zod";
import type { SVTExtendedState, MyocarditisExtendedState } from "./sim/types";

// ============================================================================
// Shared Sub-Schemas
// ============================================================================

const DiagnosticOrderSchema = z.object({
  id: z.string(),
  type: z.enum(["ecg", "troponin", "bnp", "cbc", "bmp", "lactate", "cxr", "echo", "abg"]),
  orderedAt: z.number().positive(),
  completedAt: z.number().positive().optional(),
  result: z.string().optional(),
});

const ConsultRecordSchema = z.object({
  service: z.enum(["picu", "cardiology", "ecmo", "pharmacy", "respiratory"]),
  calledAt: z.number().positive(),
  arrivedAt: z.number().positive().optional(),
  recommendation: z.string().optional(),
});

const RuleTriggerRecordSchema = z.object({
  ruleId: z.string(),
  triggeredAt: z.number().positive(),
  triggerCount: z.number().int().min(1),
});

const PendingEffectSchema = z.object({
  ruleId: z.string(),
  effect: z.unknown(),
  executeAt: z.number().positive(),
});

const PendingClarificationSchema = z.object({
  orderType: z.string(),
  question: z.string(),
  askedAt: z.number().positive(),
});

// ============================================================================
// SVT Extended State Schema
// ============================================================================

const SVTPhaseSchema = z.enum([
  "presentation",
  "svt_onset",
  "treatment_window",
  "cardioversion_decision",
  "decompensating",
  "converted",
]);

const AdenosineDoseSchema = z.object({
  ts: z.number().positive(),
  doseMg: z.number().positive(),
  doseMgKg: z.number().positive(),
  doseNumber: z.union([z.literal(1), z.literal(2)]),
  rapidPush: z.boolean(),
  flushGiven: z.boolean(),
});

const CardioversionAttemptSchema = z.object({
  ts: z.number().positive(),
  joules: z.number().positive(),
  joulesPerKg: z.number().positive(),
  synchronized: z.boolean(),
  sedated: z.boolean(),
  sedationAgent: z.string().optional(),
});

const SVTTimelineEventSchema = z.object({
  ts: z.number().positive(),
  type: z.enum(["phase_change", "treatment", "intervention", "diagnostic", "consult", "conversion", "critical"]),
  description: z.string(),
  details: z.record(z.unknown()).optional(),
});

const SVTFlagsSchema = z.object({
  patientReassured: z.boolean(),
  parentInformed: z.boolean(),
  valsalvaExplained: z.boolean(),
  reboundSVT: z.boolean(),
  unsedatedCardioversion: z.boolean(),
});

export const SVTExtendedStateSchema = z.object({
  // Phase tracking
  phase: SVTPhaseSchema,
  phaseEnteredAt: z.number().positive(),
  stabilityLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),

  // Rhythm state
  currentRhythm: z.enum(["sinus", "svt"]),
  converted: z.boolean(),
  conversionMethod: z.enum(["vagal", "adenosine_first", "adenosine_second", "cardioversion"]).optional(),
  conversionTs: z.number().positive().optional(),

  // Treatment tracking
  vagalAttempts: z.number().int().min(0).max(10),
  vagalAttemptTs: z.number().positive().optional(),
  adenosineDoses: z.array(AdenosineDoseSchema),
  totalAdenosineMg: z.number().min(0),
  cardioversionAttempts: z.array(CardioversionAttemptSchema),

  // Intervention tracking
  ivAccess: z.boolean(),
  ivAccessTs: z.number().positive().optional(),
  monitorOn: z.boolean(),
  monitorOnTs: z.number().positive().optional(),
  sedationGiven: z.boolean(),
  sedationAgent: z.string().optional(),
  sedationTs: z.number().positive().optional(),

  // Diagnostic tracking
  ecgOrdered: z.boolean(),
  ecgOrderedTs: z.number().positive().optional(),
  diagnostics: z.array(DiagnosticOrderSchema),
  orderedDiagnostics: z.array(z.string()),

  // Consults
  consults: z.array(ConsultRecordSchema),
  consultsCalled: z.array(z.string()),

  // Flags
  flags: SVTFlagsSchema,

  // Scenario clock control
  scenarioStartedAt: z.number().positive(),
  scenarioClockPaused: z.boolean(),
  totalPausedMs: z.number().min(0),

  // Rule tracking
  ruleTriggers: z.array(RuleTriggerRecordSchema),
  pendingEffects: z.array(PendingEffectSchema),

  // Scoring
  checklistCompleted: z.array(z.string()),
  bonusesEarned: z.array(z.string()),
  penaltiesIncurred: z.array(z.string()),
  currentScore: z.number(),

  // Optional fields
  pendingClarification: PendingClarificationSchema.optional(),
  timelineEvents: z.array(SVTTimelineEventSchema),
});

// ============================================================================
// Myocarditis Extended State Schema
// ============================================================================

const MyocarditisPhaseSchema = z.enum([
  "scene_set",
  "recognition",
  "decompensation",
  "intubation_trap",
  "confirmation_disposition",
  "end",
]);

const ShockStageSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const FluidBolusSchema = z.object({
  ts: z.number().positive(),
  mlKg: z.number().positive(),
  totalMl: z.number().positive(),
  type: z.enum(["NS", "LR", "albumin", "blood"]),
  rateMinutes: z.number().positive().optional(),
});

const InotropeInfusionSchema = z.object({
  drug: z.enum(["epi", "milrinone", "dobutamine", "dopamine", "norepi"]),
  doseMcgKgMin: z.number().positive(),
  startedAt: z.number().positive(),
  stoppedAt: z.number().positive().optional(),
});

const AirwayInterventionSchema = z.object({
  type: z.enum(["hfnc", "intubation"]),
  ts: z.number().positive(),
  details: z.object({
    inductionAgent: z.enum(["ketamine", "propofol", "etomidate"]).optional(),
    peep: z.number().min(0).max(30).optional(),
    fio2: z.number().min(0.21).max(1.0).optional(),
    pressorReady: z.boolean().optional(),
    pushDoseEpiDrawn: z.boolean().optional(),
  }).optional(),
});

const MyocarditisTimelineEventSchema = z.object({
  ts: z.number().positive(),
  type: z.enum(["phase_change", "intervention", "diagnostic", "consult", "deterioration", "critical"]),
  description: z.string(),
  details: z.record(z.unknown()).optional(),
});

const MyocarditisFlagsSchema = z.object({
  pulmonaryEdema: z.boolean(),
  intubationCollapse: z.boolean(),
  codeBlueActive: z.boolean(),
  stabilizing: z.boolean(),
});

export const MyocarditisExtendedStateSchema = z.object({
  // Phase tracking
  phase: MyocarditisPhaseSchema,
  phaseEnteredAt: z.number().positive(),
  shockStage: ShockStageSchema,
  shockStageEnteredAt: z.number().positive(),

  // Scenario clock control
  scenarioStartedAt: z.number().positive(),
  scenarioClockPaused: z.boolean(),
  scenarioClockPausedAt: z.number().positive().optional(),
  totalPausedMs: z.number().min(0),
  deteriorationRate: z.union([z.literal(0.5), z.literal(1.0), z.literal(2.0)]),

  // Interventions tracking
  fluids: z.array(FluidBolusSchema),
  totalFluidsMlKg: z.number().min(0),
  inotropes: z.array(InotropeInfusionSchema),
  activeInotropes: z.array(InotropeInfusionSchema),
  airway: AirwayInterventionSchema.optional(),
  ivAccess: z.object({
    count: z.number().int().min(0),
    locations: z.array(z.string()),
  }),
  monitorOn: z.boolean(),
  defibPadsOn: z.boolean(),

  // Diagnostic tracking
  diagnostics: z.array(DiagnosticOrderSchema),
  orderedDiagnostics: z.array(z.string()),

  // Consults
  consults: z.array(ConsultRecordSchema),
  consultsCalled: z.array(z.string()),

  // Physiology flags
  flags: MyocarditisFlagsSchema,

  // Rule tracking
  ruleTriggers: z.array(RuleTriggerRecordSchema),
  pendingEffects: z.array(PendingEffectSchema),

  // Scoring
  checklistCompleted: z.array(z.string()),
  bonusesEarned: z.array(z.string()),
  penaltiesIncurred: z.array(z.string()),
  currentScore: z.number(),

  // Optional fields
  pendingClarification: PendingClarificationSchema.optional(),
  timelineEvents: z.array(MyocarditisTimelineEventSchema),
});

// ============================================================================
// Validation Functions
// ============================================================================

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validate SVT extended state
 */
export function validateSVTExtendedState(state: unknown): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  try {
    SVTExtendedStateSchema.parse(state);
  } catch (err) {
    result.valid = false;
    if (err instanceof z.ZodError) {
      result.errors = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    } else {
      result.errors = ["Unknown validation error"];
    }
    return result;
  }

  // Additional semantic validations
  const s = state as SVTExtendedState;

  // Check timestamp consistency
  if (s.conversionTs && s.conversionTs < s.scenarioStartedAt) {
    result.warnings.push("conversionTs is before scenarioStartedAt");
  }

  if (s.ecgOrderedTs && s.ecgOrderedTs < s.scenarioStartedAt) {
    result.warnings.push("ecgOrderedTs is before scenarioStartedAt");
  }

  // Check adenosine doses are ordered by timestamp
  for (let i = 1; i < s.adenosineDoses.length; i++) {
    if (s.adenosineDoses[i].ts < s.adenosineDoses[i - 1].ts) {
      result.warnings.push(`Adenosine dose ${i} timestamp is before dose ${i - 1}`);
    }
  }

  // Check vagal attempts matches count
  if (s.vagalAttempts === 0 && s.vagalAttemptTs !== undefined) {
    result.warnings.push("vagalAttemptTs set but vagalAttempts is 0");
  }

  return result;
}

/**
 * Validate Myocarditis extended state
 */
export function validateMyocarditisExtendedState(state: unknown): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  try {
    MyocarditisExtendedStateSchema.parse(state);
  } catch (err) {
    result.valid = false;
    if (err instanceof z.ZodError) {
      result.errors = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    } else {
      result.errors = ["Unknown validation error"];
    }
    return result;
  }

  // Additional semantic validations
  const s = state as MyocarditisExtendedState;

  // Check timeline is monotonically increasing
  for (let i = 1; i < s.timelineEvents.length; i++) {
    if (s.timelineEvents[i].ts < s.timelineEvents[i - 1].ts) {
      result.warnings.push(`Timeline event ${i} timestamp is before event ${i - 1}`);
    }
  }

  // Check shock stage makes sense for phase
  if (s.phase === "scene_set" && s.shockStage > 2) {
    result.warnings.push(`Shock stage ${s.shockStage} is high for scene_set phase`);
  }

  // Check totalFluidsMlKg consistency
  const calculatedTotal = s.fluids.reduce((sum, f) => sum + f.mlKg, 0);
  if (Math.abs(calculatedTotal - s.totalFluidsMlKg) > 0.1) {
    result.warnings.push(
      `totalFluidsMlKg (${s.totalFluidsMlKg}) doesn't match sum of fluids (${calculatedTotal})`
    );
  }

  return result;
}

/**
 * Validate extended state based on scenario ID
 */
export function validateExtendedState(
  scenarioId: string,
  state: unknown
): ValidationResult {
  if (scenarioId === "teen_svt_complex_v1") {
    return validateSVTExtendedState(state);
  } else if (scenarioId === "peds_myocarditis_silent_crash_v1") {
    return validateMyocarditisExtendedState(state);
  }

  // Non-complex scenarios don't have extended state validation
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Safe parse - returns parsed state or null with errors
 */
export function safeParseSVTState(state: unknown): {
  data: SVTExtendedState | null;
  errors: string[];
} {
  const result = SVTExtendedStateSchema.safeParse(state);
  if (result.success) {
    return { data: result.data as SVTExtendedState, errors: [] };
  }
  return {
    data: null,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Safe parse - returns parsed state or null with errors
 */
export function safeParseMyocarditisState(state: unknown): {
  data: MyocarditisExtendedState | null;
  errors: string[];
} {
  const result = MyocarditisExtendedStateSchema.safeParse(state);
  if (result.success) {
    return { data: result.data as MyocarditisExtendedState, errors: [] };
  }
  return {
    data: null,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}
