import type { MyocarditisPhase, ShockStage, SVTPhase } from "./scenarioTypes";

export type ToolIntentType =
  | "intent_updateVitals"
  | "intent_advanceStage"
  | "intent_revealFinding"
  | "intent_setEmotion";

export type ToolIntent =
  | {
      type: "intent_updateVitals";
      delta: Partial<Vitals>;
      reason?: string;
    }
  | {
      type: "intent_advanceStage";
      stageId: string;
      reason?: string;
    }
  | {
      type: "intent_revealFinding";
      findingId: string;
      reason?: string;
    }
  | {
      type: "intent_setEmotion";
      emotion: string;
      intensity?: number;
      reason?: string;
    };

export type EventType =
  | "realtime.connected"
  | "realtime.disconnected"
  | "audio.floor.changed"
  | "tool.intent.received"
  | "tool.intent.approved"
  | "tool.intent.rejected"
  | "scenario.stage.changed"
  | "scenario.finding.revealed"
  | "scenario.state.diff"
  | "fallback.enabled"
  | "fallback.disabled";

export type EventLogEntry = {
  id: string;
  ts: number;
  simId: string;
  type: EventType;
  payload?: Record<string, unknown>;
  correlationId?: string;
};

export type Vitals = {
  hr?: number;
  bp?: string;
  rr?: number;
  spo2?: number;
  temp?: number;
};

// Patient interventions for visual display
export type IVLocation = "left_ac" | "right_ac" | "left_hand" | "right_hand" | "left_foot" | "right_foot";

export type IVStatus = {
  location: IVLocation;
  gauge?: number;
  fluidsRunning?: boolean;
  fluidType?: string;
};

export type OxygenStatus = {
  type: "nasal_cannula" | "mask" | "non_rebreather" | "high_flow" | "blow_by";
  flowRateLpm?: number;
};

export type Interventions = {
  iv?: IVStatus;
  oxygen?: OxygenStatus;
  defibPads?: { placed: boolean };
  monitor?: { leads: boolean };
  ngTube?: { placed: boolean };
  foley?: { placed: boolean };
};

// ============================================================================
// Complex Scenario Extended State (Myocarditis)
// ============================================================================

/** Fluid administration record */
export type FluidBolus = {
  ts: number;
  mlKg: number;
  totalMl: number;
  type: "NS" | "LR" | "albumin" | "blood";
  rateMinutes?: number; // e.g., 20 for "over 20 minutes"
};

/** Inotrope/vasopressor infusion */
export type InotropeInfusion = {
  drug: "epi" | "milrinone" | "dobutamine" | "dopamine" | "norepi";
  doseMcgKgMin: number;
  startedAt: number;
  stoppedAt?: number;
};

/** Airway intervention */
export type AirwayIntervention = {
  type: "hfnc" | "intubation";
  ts: number;
  details?: {
    inductionAgent?: "ketamine" | "propofol" | "etomidate";
    peep?: number;
    fio2?: number;
    pressorReady?: boolean;
    pushDoseEpiDrawn?: boolean;
  };
};

/** Diagnostic order for complex scenario */
export type DiagnosticOrder = {
  id: string;
  type: "ecg" | "troponin" | "bnp" | "cbc" | "bmp" | "lactate" | "cxr" | "echo" | "abg";
  orderedAt: number;
  completedAt?: number;
  result?: string;
};

/** Consult record */
export type ConsultRecord = {
  service: "picu" | "cardiology" | "ecmo" | "pharmacy" | "respiratory";
  calledAt: number;
  arrivedAt?: number;
  recommendation?: string;
};

/** Rule trigger history for cooldowns */
export type RuleTriggerRecord = {
  ruleId: string;
  triggeredAt: number;
  triggerCount: number;
};

/** Extended state for myocarditis complex scenario */
export type MyocarditisExtendedState = {
  // Phase tracking
  phase: MyocarditisPhase;
  phaseEnteredAt: number;
  shockStage: ShockStage;
  shockStageEnteredAt: number;

  // Scenario clock control
  scenarioClockPaused: boolean;
  scenarioClockPausedAt?: number;
  totalPausedMs: number;
  deteriorationRate: number; // 0.5, 1.0, or 2.0 (multiplier)

  // Interventions tracking
  fluids: FluidBolus[];
  totalFluidsMlKg: number;
  inotropes: InotropeInfusion[];
  activeInotropes: InotropeInfusion[];
  airway?: AirwayIntervention;
  ivAccess: { count: number; locations: string[] };
  monitorOn: boolean;
  defibPadsOn: boolean;

  // Diagnostic tracking
  diagnostics: DiagnosticOrder[];
  orderedDiagnostics: string[]; // quick lookup of ordered test types

  // Consults
  consults: ConsultRecord[];
  consultsCalled: string[]; // quick lookup

  // Physiology flags (set by rules)
  flags: {
    pulmonaryEdema: boolean;
    intubationCollapse: boolean;
    codeBlueActive: boolean;
    stabilizing: boolean;
  };

  // Rule tracking
  ruleTriggers: RuleTriggerRecord[];
  pendingEffects: { ruleId: string; effect: unknown; executeAt: number }[];

  // Scoring (accumulated during scenario)
  checklistCompleted: string[]; // IDs of checklist items achieved
  bonusesEarned: string[];
  penaltiesIncurred: string[];
  currentScore: number;

  // Nurse pending clarification
  pendingClarification?: {
    orderType: string;
    question: string;
    askedAt: number;
  };

  // Timeline events for debrief
  timelineEvents: {
    ts: number;
    type: "phase_change" | "intervention" | "diagnostic" | "consult" | "deterioration" | "critical";
    description: string;
    details?: Record<string, unknown>;
  }[];
};

// ============================================================================
// SimState (Base + Extended)
// ============================================================================

/** Base SimState for all scenarios */
export type SimStateBase = {
  simId: string;
  scenarioId: string;
  stageId: string;
  updatedAtMs?: number;
  vitals: Vitals;
  exam?: {
    general?: string;
    cardio?: string;
    lungs?: string;
    perfusion?: string;
    neuro?: string;
    heartAudioUrl?: string;
    lungAudioUrl?: string;
  };
  interventions?: Interventions;
  telemetry?: boolean;
  rhythmSummary?: string;
  telemetryWaveform?: number[];
  telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
  ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
  treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
  findings?: string[];
  fallback: boolean;
  scenarioStartedAt?: number;
  stageEnteredAt?: number;
  stageIds?: string[];
  orders?: {
    id: string;
    type: "vitals" | "ekg" | "labs" | "imaging" | "cardiac_exam" | "lung_exam" | "general_exam";
    status: "pending" | "complete";
    result?: import("../messageTypes").OrderResult;
    completedAt?: number;
  }[];
  budget?: {
    usdEstimate?: number;
    voiceSeconds?: number;
    throttled?: boolean;
    fallback?: boolean;
  };
};

/** SimState with optional extended state for complex scenarios */
export type SimState = SimStateBase & {
  /** Extended state for complex scenarios (e.g., myocarditis, SVT) */
  extended?: MyocarditisExtendedState | SVTExtendedState;
};

export type CostSnapshot = {
  inputTokens: number;
  outputTokens: number;
  usdEstimate: number;
};

/** Type guard to check if a SimState has extended myocarditis state */
export function hasMyocarditisExtended(
  state: SimState
): state is SimState & { extended: MyocarditisExtendedState } {
  return (
    state.scenarioId === "peds_myocarditis_silent_crash_v1" &&
    "extended" in state &&
    state.extended !== undefined
  );
}

// ============================================================================
// Complex Scenario Extended State (SVT)
// ============================================================================

/** Adenosine dose record */
export type AdenosineDose = {
  ts: number;
  doseMg: number;
  doseMgKg: number;
  doseNumber: 1 | 2;
  rapidPush: boolean;
  flushGiven: boolean;
};

/** Cardioversion attempt record */
export type CardioversionAttempt = {
  ts: number;
  joules: number;
  joulesPerKg: number;
  synchronized: boolean;
  sedated: boolean;
  sedationAgent?: string;
};

/** Extended state for SVT complex scenario */
export type SVTExtendedState = {
  // Phase tracking
  phase: SVTPhase;
  phaseEnteredAt: number;
  stabilityLevel: 1 | 2 | 3 | 4; // 1=stable, 2=mildly unstable, 3=unstable, 4=critical

  // Rhythm state
  currentRhythm: "sinus" | "svt";
  converted: boolean;
  conversionMethod?: "vagal" | "adenosine_first" | "adenosine_second" | "cardioversion";
  conversionTs?: number;

  // Treatment tracking
  vagalAttempts: number;
  vagalAttemptTs?: number;
  adenosineDoses: AdenosineDose[];
  totalAdenosineMg: number;
  cardioversionAttempts: CardioversionAttempt[];

  // Intervention tracking
  ivAccess: boolean;
  ivAccessTs?: number;
  monitorOn: boolean;
  monitorOnTs?: number;
  sedationGiven: boolean;
  sedationAgent?: string;
  sedationTs?: number;

  // Diagnostic tracking
  ecgOrdered: boolean;
  ecgOrderedTs?: number;
  diagnostics: DiagnosticOrder[];
  orderedDiagnostics: string[];

  // Consults
  consults: ConsultRecord[];
  consultsCalled: string[];

  // Flags
  flags: {
    patientReassured: boolean;
    parentInformed: boolean;
    valsalvaExplained: boolean;
    reboundSVT: boolean;
    unsedatedCardioversion: boolean;
  };

  // Scenario clock control
  scenarioStartedAt: number;
  scenarioClockPaused: boolean;
  totalPausedMs: number;

  // Rule tracking
  ruleTriggers: RuleTriggerRecord[];
  pendingEffects: { ruleId: string; effect: unknown; executeAt: number }[];

  // Scoring
  checklistCompleted: string[];
  bonusesEarned: string[];
  penaltiesIncurred: string[];
  currentScore: number;

  // Nurse pending clarification
  pendingClarification?: {
    orderType: string;
    question: string;
    askedAt: number;
  };

  // Timeline events for debrief
  timelineEvents: {
    ts: number;
    type: "phase_change" | "treatment" | "intervention" | "diagnostic" | "consult" | "conversion" | "critical";
    description: string;
    details?: Record<string, unknown>;
  }[];
};

/** Type guard to check if a SimState has extended SVT state */
export function hasSVTExtended(
  state: SimState
): state is SimState & { extended: SVTExtendedState } {
  return (
    state.scenarioId === "teen_svt_complex_v1" &&
    "extended" in state &&
    state.extended !== undefined
  );
}
