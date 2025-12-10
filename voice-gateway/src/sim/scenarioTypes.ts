export type ScenarioId =
  | "syncope"
  | "exertional_chest_pain"
  | "palpitations_svt"
  | "myocarditis"
  | "exertional_syncope_hcm"
  | "ductal_shock"
  | "cyanotic_spell"
  | "kawasaki"
  | "coarctation_shock"
  | "arrhythmogenic_syncope"
  // Complex scenarios
  | "peds_myocarditis_silent_crash_v1";

export type ActionTrigger =
  | { action: "asked_about_exertion" }
  | { action: "asked_family_history" }
  | { action: "stand_test" }
  | { action: "time_elapsed"; seconds: number };

export type StageTransition = {
  to: string;
  when: ActionTrigger | { any: ActionTrigger[] } | { all: ActionTrigger[] };
};

export type StageDef = {
  id: string;
  vitals: { hr: number; bp: string; rr?: number; spo2?: number; temp?: number };
  exam?: {
    general?: string;
    cardio?: string;
    lungs?: string;
    perfusion?: string;
    neuro?: string;
  };
  rhythm?: string;
  drift?: {
    hrPerMin?: number;
    spo2PerMin?: number;
    sbpPerMin?: number;
    dbpPerMin?: number;
  };
  allowedIntents?: string[];
  allowedStages?: string[];
  reveals?: { id: string; trigger: "always" | "on_question"; text: string }[];
  transitions?: StageTransition[];
};

export type PatientDemographics = {
  ageYears: number;
  ageMonths?: number;
  weightKg: number;
  sex?: "male" | "female";
};

export type ScenarioDef = {
  id: ScenarioId;
  version: string;
  persona?: string;
  /** Patient demographics for weight-based dosing */
  demographics: PatientDemographics;
  stages: StageDef[];
  initialStage: string;
};

// ============================================================================
// Complex Scenario Types (Phase-Based with Physiology Engine)
// ============================================================================

export type ShockStage = 1 | 2 | 3 | 4 | 5; // compensated → decompensated → peri-arrest → arrest → stabilized

export type MyocarditisPhase =
  | "scene_set"
  | "recognition"
  | "decompensation"
  | "intubation_trap"
  | "confirmation_disposition"
  | "end";

/** Physiology rule trigger condition */
export type PhysiologyCondition =
  | { type: "fluids_ml_kg_in_window"; thresholdMlKg: number; windowMinutes: number }
  | { type: "inotrope_running"; drug: "epi" | "milrinone" | "both" }
  | { type: "inotrope_dose_gte"; drug: "epi"; doseMcgKgMin: number }
  | { type: "airway_intervention"; method: "hfnc" | "intubation" }
  | { type: "intubation_induction"; agent: "ketamine" | "propofol" }
  | { type: "pressor_at_bedside"; ready: boolean }
  | { type: "peep_gte"; peep: number }
  | { type: "shock_stage_gte"; stage: ShockStage }
  | { type: "consult_called"; service: "picu" | "cardiology" | "ecmo" }
  | { type: "time_in_phase_gte"; minutes: number }
  | { type: "diagnostic_ordered"; test: string };

/** Physiology rule effect */
export type PhysiologyEffect =
  | { type: "vitals_delta"; hr?: number; sbp?: number; dbp?: number; spo2?: number; rr?: number }
  | { type: "set_flag"; flag: string; value: boolean }
  | { type: "nurse_line"; line: string; priority?: "critical" | "normal" }
  | { type: "advance_shock_stage"; to: ShockStage }
  | { type: "advance_phase"; to: MyocarditisPhase }
  | { type: "trigger_code_blue" };

/** Deterministic physiology rule */
export type PhysiologyRule = {
  id: string;
  name: string;
  conditions: PhysiologyCondition[];
  conditionLogic?: "all" | "any"; // default "all"
  effects: PhysiologyEffect[];
  delaySeconds?: number; // delay before effects apply
  cooldownSeconds?: number; // prevent re-triggering
  maxTriggers?: number; // limit how many times this can fire
};

/** Phase definition for complex scenarios */
export type PhaseDef = {
  id: MyocarditisPhase;
  name: string;
  durationMinutes?: number; // auto-advance after this time (if set)
  vitalsTarget: { hr: number; bp: string; rr: number; spo2: number };
  examFindings: {
    general?: string;
    cardio?: string;
    lungs?: string;
    perfusion?: string;
    neuro?: string;
  };
  rhythmSummary?: string;
  shockStageRange?: [ShockStage, ShockStage]; // valid shock stages for this phase
  drift?: {
    hrPerMin?: number;
    spo2PerMin?: number;
    sbpPerMin?: number;
    dbpPerMin?: number;
  };
  nurseTriggers?: { condition: string; line: string }[];
  autoTransitions?: { to: MyocarditisPhase; when: PhysiologyCondition[] }[];
};

/** Characters for complex scenarios */
export type ComplexCharacter = {
  id: string;
  name: string;
  role: "nurse" | "parent" | "patient" | "consultant" | "tech";
  persona: string;
  clarificationPrompts?: Record<string, string>; // order type → clarification question
};

/** Complex scenario definition (extends base ScenarioDef concept) */
export type ComplexScenarioDef = {
  id: ScenarioId;
  version: string;
  scenarioType: "complex";
  title: string;
  description: string;
  runtimeMinutes: number;
  demographics: PatientDemographics;
  characters: ComplexCharacter[];
  phases: PhaseDef[];
  initialPhase: MyocarditisPhase;
  physiologyRules: PhysiologyRule[];
  scoringConfig: {
    passingThreshold: number; // e.g., 4 out of 5
    checklistItems: { id: string; description: string; points: number }[];
    bonuses: { id: string; description: string; points: number; condition: string }[];
    penalties: { id: string; description: string; points: number; condition: string }[];
  };
};

/** Type guard for complex scenarios */
export function isComplexScenario(
  def: ScenarioDef | ComplexScenarioDef
): def is ComplexScenarioDef {
  return "scenarioType" in def && def.scenarioType === "complex";
}
