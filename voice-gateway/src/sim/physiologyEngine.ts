/**
 * PhysiologyEngine - Deterministic rules engine for complex scenarios
 *
 * Handles medically-accurate physiologic responses:
 * - Fluid overload → pulmonary edema
 * - Inotrope effects on BP/HR
 * - Intubation complications
 * - Airway intervention effects
 */

import type {
  PhysiologyCondition,
  PhysiologyEffect,
  PhysiologyRule,
  ShockStage,
  MyocarditisPhase,
} from "./scenarioTypes";
import type { SimState, MyocarditisExtendedState, FluidBolus } from "./types";

/** Result of evaluating physiology rules */
export type PhysiologyResult = {
  triggeredRules: string[];
  effects: PhysiologyEffect[];
  nurseLine?: string;
  shouldAdvancePhase?: MyocarditisPhase;
  shouldAdvanceShockStage?: ShockStage;
  vitalsDelta?: { hr?: number; sbp?: number; dbp?: number; spo2?: number; rr?: number };
  flagsToSet?: Record<string, boolean>;
};

/** Patient weight for calculations */
const PATIENT_WEIGHT_KG = 32; // Jordan, 10yo

/**
 * Check if a single condition is met
 */
function evaluateCondition(
  condition: PhysiologyCondition,
  state: SimState,
  extended: MyocarditisExtendedState,
  nowMs: number
): boolean {
  switch (condition.type) {
    case "fluids_ml_kg_in_window": {
      // Calculate total fluids given in the time window
      const windowStartMs = nowMs - condition.windowMinutes * 60 * 1000;
      const fluidsInWindow = extended.fluids
        .filter((f) => f.ts >= windowStartMs)
        .reduce((sum, f) => sum + f.mlKg, 0);
      return fluidsInWindow >= condition.thresholdMlKg;
    }

    case "inotrope_running": {
      const activeInotropes = extended.activeInotropes;
      if (condition.drug === "both") {
        return activeInotropes.some((i) => i.drug === "epi") && activeInotropes.some((i) => i.drug === "milrinone");
      }
      return activeInotropes.some((i) => i.drug === condition.drug);
    }

    case "inotrope_dose_gte": {
      const epiInfusion = extended.activeInotropes.find((i) => i.drug === "epi");
      return epiInfusion !== undefined && epiInfusion.doseMcgKgMin >= condition.doseMcgKgMin;
    }

    case "airway_intervention": {
      if (!extended.airway) return false;
      return extended.airway.type === condition.method;
    }

    case "intubation_induction": {
      if (!extended.airway || extended.airway.type !== "intubation") return false;
      return extended.airway.details?.inductionAgent === condition.agent;
    }

    case "pressor_at_bedside": {
      // Check if push-dose epi was drawn up before intubation
      return extended.airway?.details?.pushDoseEpiDrawn === condition.ready;
    }

    case "peep_gte": {
      if (!extended.airway || extended.airway.type !== "intubation") return false;
      return (extended.airway.details?.peep ?? 5) >= condition.peep;
    }

    case "shock_stage_gte": {
      return extended.shockStage >= condition.stage;
    }

    case "consult_called": {
      return extended.consultsCalled.includes(condition.service);
    }

    case "time_in_phase_gte": {
      const phaseElapsedMs = nowMs - extended.phaseEnteredAt;
      return phaseElapsedMs >= condition.minutes * 60 * 1000;
    }

    case "diagnostic_ordered": {
      return extended.orderedDiagnostics.includes(condition.test);
    }

    default:
      return false;
  }
}

/**
 * Check if a rule's conditions are satisfied
 */
function evaluateRuleConditions(
  rule: PhysiologyRule,
  state: SimState,
  extended: MyocarditisExtendedState,
  nowMs: number
): boolean {
  const logic = rule.conditionLogic ?? "all";

  if (logic === "all") {
    return rule.conditions.every((c) => evaluateCondition(c, state, extended, nowMs));
  } else {
    return rule.conditions.some((c) => evaluateCondition(c, state, extended, nowMs));
  }
}

/**
 * Check if a rule is on cooldown
 */
function isRuleOnCooldown(
  rule: PhysiologyRule,
  extended: MyocarditisExtendedState,
  nowMs: number
): boolean {
  if (!rule.cooldownSeconds) return false;

  const trigger = extended.ruleTriggers.find((t) => t.ruleId === rule.id);
  if (!trigger) return false;

  const cooldownEndMs = trigger.triggeredAt + rule.cooldownSeconds * 1000;
  return nowMs < cooldownEndMs;
}

/**
 * Check if a rule has exceeded max triggers
 */
function hasExceededMaxTriggers(
  rule: PhysiologyRule,
  extended: MyocarditisExtendedState
): boolean {
  if (!rule.maxTriggers) return false;

  const trigger = extended.ruleTriggers.find((t) => t.ruleId === rule.id);
  return trigger !== undefined && trigger.triggerCount >= rule.maxTriggers;
}

/**
 * Apply effects from a triggered rule
 */
function applyEffects(effects: PhysiologyEffect[]): PhysiologyResult {
  const result: PhysiologyResult = {
    triggeredRules: [],
    effects,
    vitalsDelta: {},
    flagsToSet: {},
  };

  for (const effect of effects) {
    switch (effect.type) {
      case "vitals_delta":
        result.vitalsDelta = {
          hr: (result.vitalsDelta?.hr ?? 0) + (effect.hr ?? 0),
          sbp: (result.vitalsDelta?.sbp ?? 0) + (effect.sbp ?? 0),
          dbp: (result.vitalsDelta?.dbp ?? 0) + (effect.dbp ?? 0),
          spo2: (result.vitalsDelta?.spo2 ?? 0) + (effect.spo2 ?? 0),
          rr: (result.vitalsDelta?.rr ?? 0) + (effect.rr ?? 0),
        };
        break;

      case "set_flag":
        result.flagsToSet![effect.flag] = effect.value;
        break;

      case "nurse_line":
        // Priority: critical overrides normal
        if (effect.priority === "critical" || !result.nurseLine) {
          result.nurseLine = effect.line;
        }
        break;

      case "advance_shock_stage":
        result.shouldAdvanceShockStage = effect.to;
        break;

      case "advance_phase":
        result.shouldAdvancePhase = effect.to;
        break;

      case "trigger_code_blue":
        result.flagsToSet!["codeBlueActive"] = true;
        result.shouldAdvanceShockStage = 4; // Arrest
        result.nurseLine = "No pulse! Starting CPR! Someone call for help!";
        break;
    }
  }

  return result;
}

/**
 * Main physiology evaluation function
 * Call this on each tick or after interventions
 */
export function evaluatePhysiology(
  state: SimState,
  extended: MyocarditisExtendedState,
  rules: PhysiologyRule[],
  nowMs: number = Date.now()
): PhysiologyResult {
  const result: PhysiologyResult = {
    triggeredRules: [],
    effects: [],
    vitalsDelta: {},
    flagsToSet: {},
  };

  for (const rule of rules) {
    // Skip if on cooldown or exceeded max triggers
    if (isRuleOnCooldown(rule, extended, nowMs)) continue;
    if (hasExceededMaxTriggers(rule, extended)) continue;

    // Check conditions
    if (!evaluateRuleConditions(rule, state, extended, nowMs)) continue;

    // Rule triggered!
    result.triggeredRules.push(rule.id);

    // Apply effects (may be delayed)
    if (rule.delaySeconds && rule.delaySeconds > 0) {
      // Queue delayed effects
      for (const effect of rule.effects) {
        extended.pendingEffects.push({
          ruleId: rule.id,
          effect,
          executeAt: nowMs + rule.delaySeconds * 1000,
        });
      }
    } else {
      // Apply immediately
      const ruleResult = applyEffects(rule.effects);
      result.effects.push(...rule.effects);

      // Merge results
      if (ruleResult.vitalsDelta) {
        result.vitalsDelta = {
          hr: (result.vitalsDelta?.hr ?? 0) + (ruleResult.vitalsDelta.hr ?? 0),
          sbp: (result.vitalsDelta?.sbp ?? 0) + (ruleResult.vitalsDelta.sbp ?? 0),
          dbp: (result.vitalsDelta?.dbp ?? 0) + (ruleResult.vitalsDelta.dbp ?? 0),
          spo2: (result.vitalsDelta?.spo2 ?? 0) + (ruleResult.vitalsDelta.spo2 ?? 0),
          rr: (result.vitalsDelta?.rr ?? 0) + (ruleResult.vitalsDelta.rr ?? 0),
        };
      }
      if (ruleResult.flagsToSet) {
        result.flagsToSet = { ...result.flagsToSet, ...ruleResult.flagsToSet };
      }
      if (ruleResult.nurseLine) {
        result.nurseLine = ruleResult.nurseLine;
      }
      if (ruleResult.shouldAdvancePhase) {
        result.shouldAdvancePhase = ruleResult.shouldAdvancePhase;
      }
      if (ruleResult.shouldAdvanceShockStage) {
        result.shouldAdvanceShockStage = ruleResult.shouldAdvanceShockStage;
      }
    }
  }

  // Process pending (delayed) effects
  const readyEffects = extended.pendingEffects.filter((pe) => pe.executeAt <= nowMs);
  if (readyEffects.length > 0) {
    // Remove executed effects from pending
    extended.pendingEffects = extended.pendingEffects.filter((pe) => pe.executeAt > nowMs);

    // Apply ready effects
    const delayedResult = applyEffects(readyEffects.map((pe) => pe.effect as PhysiologyEffect));
    if (delayedResult.vitalsDelta) {
      result.vitalsDelta = {
        hr: (result.vitalsDelta?.hr ?? 0) + (delayedResult.vitalsDelta.hr ?? 0),
        sbp: (result.vitalsDelta?.sbp ?? 0) + (delayedResult.vitalsDelta.sbp ?? 0),
        dbp: (result.vitalsDelta?.dbp ?? 0) + (delayedResult.vitalsDelta.dbp ?? 0),
        spo2: (result.vitalsDelta?.spo2 ?? 0) + (delayedResult.vitalsDelta.spo2 ?? 0),
        rr: (result.vitalsDelta?.rr ?? 0) + (delayedResult.vitalsDelta.rr ?? 0),
      };
    }
    if (delayedResult.flagsToSet) {
      result.flagsToSet = { ...result.flagsToSet, ...delayedResult.flagsToSet };
    }
    if (delayedResult.nurseLine && !result.nurseLine) {
      result.nurseLine = delayedResult.nurseLine;
    }
    if (delayedResult.shouldAdvancePhase && !result.shouldAdvancePhase) {
      result.shouldAdvancePhase = delayedResult.shouldAdvancePhase;
    }
    if (delayedResult.shouldAdvanceShockStage && !result.shouldAdvanceShockStage) {
      result.shouldAdvanceShockStage = delayedResult.shouldAdvanceShockStage;
    }
  }

  return result;
}

// ============================================================================
// Predefined Rules for Myocarditis Scenario
// ============================================================================

export const MYOCARDITIS_PHYSIOLOGY_RULES: PhysiologyRule[] = [
  // Rule 1: Fluid overload → pulmonary edema
  {
    id: "fluid_overload",
    name: "Fluid Overload",
    conditions: [{ type: "fluids_ml_kg_in_window", thresholdMlKg: 20, windowMinutes: 10 }],
    effects: [
      { type: "set_flag", flag: "pulmonaryEdema", value: true },
      { type: "vitals_delta", spo2: -8, rr: 10 },
      { type: "nurse_line", line: "Crackles getting worse with the fluids. SpO2 is dropping.", priority: "critical" },
    ],
    cooldownSeconds: 300, // 5 min cooldown
    maxTriggers: 2,
  },

  // Rule 2: Epi response - BP improves with adequate dose
  {
    id: "epi_response",
    name: "Epinephrine Response",
    conditions: [{ type: "inotrope_dose_gte", drug: "epi", doseMcgKgMin: 0.05 }],
    effects: [
      { type: "vitals_delta", sbp: 15, dbp: 8, hr: 10 },
      { type: "nurse_line", line: "Epi is in and running. Pressure is coming up.", priority: "normal" },
    ],
    delaySeconds: 120, // Effect in 2 minutes
    cooldownSeconds: 180,
  },

  // Rule 3: Milrinone trap - milrinone without epi causes BP drop
  {
    id: "milrinone_trap",
    name: "Milrinone Without Vasopressor",
    conditions: [
      { type: "inotrope_running", drug: "milrinone" },
    ],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", sbp: -8, dbp: -5 },
      { type: "nurse_line", line: "Pressure is dropping with the milrinone. Do you want to add a vasopressor?", priority: "critical" },
    ],
    delaySeconds: 180,
    cooldownSeconds: 300,
  },

  // Rule 4: HFNC effect - improves SpO2 and RR
  {
    id: "hfnc_effect",
    name: "HFNC Respiratory Support",
    conditions: [{ type: "airway_intervention", method: "hfnc" }],
    effects: [
      { type: "vitals_delta", spo2: 5, rr: -8 },
      { type: "nurse_line", line: "HFNC is on. Work of breathing is a little better.", priority: "normal" },
    ],
    delaySeconds: 300, // 5 minutes
  },

  // Rule 5: Intubation collapse - propofol without pressor ready
  {
    id: "intubation_collapse_propofol",
    name: "Intubation Collapse (Propofol)",
    conditions: [
      { type: "intubation_induction", agent: "propofol" },
      { type: "pressor_at_bedside", ready: false },
    ],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", sbp: -40, dbp: -30, hr: -50 },
      { type: "set_flag", flag: "intubationCollapse", value: true },
      { type: "nurse_line", line: "BP is crashing! 40 systolic! Patient is bradycardic!", priority: "critical" },
    ],
    delaySeconds: 30,
    maxTriggers: 1,
  },

  // Rule 6: Safe intubation with ketamine
  {
    id: "intubation_safe_ketamine",
    name: "Safe Intubation (Ketamine)",
    conditions: [
      { type: "intubation_induction", agent: "ketamine" },
      { type: "pressor_at_bedside", ready: true },
    ],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", sbp: 5, dbp: 3, hr: 5 },
      { type: "nurse_line", line: "Tube is in. Good color change on CO2. Vitals holding steady.", priority: "normal" },
    ],
    delaySeconds: 60,
  },

  // Rule 7: High PEEP in cardiogenic shock causes further decompensation
  {
    id: "high_peep_decomp",
    name: "High PEEP Decompensation",
    conditions: [
      { type: "peep_gte", peep: 8 },
      { type: "shock_stage_gte", stage: 2 },
    ],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", sbp: -10, dbp: -8 },
      { type: "nurse_line", line: "Pressure is dropping. PEEP might be too high for this cardiac patient.", priority: "critical" },
    ],
    delaySeconds: 120,
    cooldownSeconds: 300,
  },

  // Rule 8: PICU consult called - helps with scoring
  {
    id: "picu_called",
    name: "PICU Consult Called",
    conditions: [{ type: "consult_called", service: "picu" }],
    effects: [
      { type: "nurse_line", line: "PICU fellow is on the way. ETA 5 minutes.", priority: "normal" },
    ],
    maxTriggers: 1,
  },

  // Rule 9: Cardiology consult called
  {
    id: "cardiology_called",
    name: "Cardiology Consult Called",
    conditions: [{ type: "consult_called", service: "cardiology" }],
    effects: [
      { type: "nurse_line", line: "Cardiology is paged. They're sending someone from the echo lab.", priority: "normal" },
    ],
    maxTriggers: 1,
  },

  // Rule 10: ECMO alert - stabilization pathway
  {
    id: "ecmo_alert",
    name: "ECMO Alert Called",
    conditions: [{ type: "consult_called", service: "ecmo" }],
    effects: [
      { type: "set_flag", flag: "stabilizing", value: true },
      { type: "nurse_line", line: "ECMO team is mobilizing. Surgeon says 20 minutes to bedside.", priority: "normal" },
    ],
    maxTriggers: 1,
  },

  // Rule 11: Cardiac markers ordered early - good recognition
  {
    id: "early_cardiac_markers",
    name: "Early Cardiac Marker Recognition",
    conditions: [
      { type: "diagnostic_ordered", test: "troponin" },
      { type: "time_in_phase_gte", minutes: 0 }, // Any time
    ],
    conditionLogic: "all",
    effects: [
      { type: "nurse_line", line: "I'll send the troponin and BNP right away.", priority: "normal" },
    ],
    maxTriggers: 1,
  },

  // Rule 12: Decompensation phase auto-advance after time
  {
    id: "auto_decomp",
    name: "Auto Decompensation",
    conditions: [
      { type: "time_in_phase_gte", minutes: 6 },
    ],
    effects: [
      { type: "advance_shock_stage", to: 2 },
      { type: "advance_phase", to: "decompensation" },
      { type: "nurse_line", line: "Doctor, BP is 72/40 now. Patient looks worse.", priority: "critical" },
    ],
    maxTriggers: 1,
  },
];

/**
 * Calculate total fluids given in mL/kg
 */
export function calculateTotalFluidsMlKg(fluids: FluidBolus[]): number {
  return fluids.reduce((sum, f) => sum + f.mlKg, 0);
}

// ============================================================================
// SVT Physiology Rules
// ============================================================================

/**
 * SVT-specific physiology rules for deterministic scenario progression.
 *
 * Key mechanics:
 * - Vagal maneuvers: 30% conversion rate
 * - Adenosine first dose (0.1 mg/kg): 60% conversion rate
 * - Adenosine second dose (0.2 mg/kg): 90% cumulative conversion rate
 * - Cardioversion: 95% conversion rate
 * - Decompensation if untreated for >5 minutes
 */
export const SVT_PHYSIOLOGY_RULES: PhysiologyRule[] = [
  // Rule 1: Vagal Maneuver Success (30% handled elsewhere, this fires on success)
  {
    id: "vagal_conversion",
    name: "Vagal Maneuver Conversion",
    conditions: [{ type: "vagal_attempted" }, { type: "converted" }],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", hr: -125 }, // Drop from ~220 to ~95
      { type: "convert_rhythm" },
      { type: "advance_svt_phase", to: "converted" },
      { type: "nurse_line", line: "It worked! She's converting... heart rate coming down!", priority: "critical" },
    ],
    maxTriggers: 1,
  },

  // Rule 2: Adenosine First Dose Success
  {
    id: "adenosine_first_success",
    name: "Adenosine First Dose Conversion",
    conditions: [{ type: "adenosine_given", doseNumber: 1 }, { type: "converted" }],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", hr: -125 },
      { type: "convert_rhythm" },
      { type: "advance_svt_phase", to: "converted" },
      { type: "nurse_line", line: "There's the conversion! Sinus rhythm. Heart rate dropping to 95.", priority: "critical" },
    ],
    delaySeconds: 10,
    maxTriggers: 1,
  },

  // Rule 3: Adenosine First Dose Failure
  {
    id: "adenosine_first_failure",
    name: "Adenosine First Dose Failure",
    conditions: [{ type: "adenosine_given", doseNumber: 1 }],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", hr: -30 }, // Brief dip
      { type: "nurse_line", line: "Brief pause... and it's back. Still in SVT. Want to try the higher dose?", priority: "normal" },
    ],
    delaySeconds: 15,
    cooldownSeconds: 60,
    maxTriggers: 1,
  },

  // Rule 4: Adenosine Second Dose Success
  {
    id: "adenosine_second_success",
    name: "Adenosine Second Dose Conversion",
    conditions: [{ type: "adenosine_given", doseNumber: 2 }, { type: "converted" }],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", hr: -130 },
      { type: "convert_rhythm" },
      { type: "advance_svt_phase", to: "converted" },
      { type: "nurse_line", line: "That did it! She's in sinus. HR 95 and stable.", priority: "critical" },
    ],
    delaySeconds: 10,
    maxTriggers: 1,
  },

  // Rule 5: Cardioversion Success
  {
    id: "cardioversion_success",
    name: "Synchronized Cardioversion Success",
    conditions: [{ type: "cardioversion_performed", synchronized: true }, { type: "converted" }],
    conditionLogic: "all",
    effects: [
      { type: "vitals_delta", hr: -150 },
      { type: "convert_rhythm" },
      { type: "advance_svt_phase", to: "converted" },
      { type: "nurse_line", line: "Shock delivered. She's in sinus! HR 90, BP coming up.", priority: "critical" },
    ],
    delaySeconds: 5,
    maxTriggers: 1,
  },

  // Rule 6: Unsedated Cardioversion
  {
    id: "cardioversion_unsedated",
    name: "Cardioversion Without Sedation",
    conditions: [{ type: "cardioversion_performed", synchronized: true }],
    conditionLogic: "all",
    effects: [
      { type: "set_flag", flag: "unsedatedCardioversion", value: true },
      { type: "nurse_line", line: "She felt that! Poor thing. We should have sedated first.", priority: "critical" },
    ],
    maxTriggers: 1,
  },

  // Rule 7: Stability Deterioration
  {
    id: "stability_drift",
    name: "Hemodynamic Deterioration",
    conditions: [{ type: "time_in_phase_gte", minutes: 3 }, { type: "rhythm_is", rhythm: "svt" }],
    conditionLogic: "all",
    effects: [
      { type: "set_stability_level", level: 2 },
      { type: "vitals_delta", sbp: -15, spo2: -2 },
      { type: "nurse_line", line: "BP is dropping. She's not tolerating this rhythm well.", priority: "critical" },
    ],
    cooldownSeconds: 180,
    maxTriggers: 2,
  },

  // Rule 8: Severe Decompensation
  {
    id: "decompensation_severe",
    name: "Severe Hemodynamic Compromise",
    conditions: [{ type: "stability_level_gte", level: 3 }, { type: "rhythm_is", rhythm: "svt" }],
    conditionLogic: "all",
    effects: [
      { type: "advance_svt_phase", to: "decompensating" },
      { type: "vitals_delta", sbp: -20, spo2: -5, hr: 10 },
      { type: "nurse_line", line: "She's decompensating! Altered mental status, BP 75 systolic. We need to cardiovert NOW.", priority: "critical" },
    ],
    maxTriggers: 1,
  },

  // Rule 9: Rebound SVT (20% chance after adenosine conversion - handled elsewhere)
  {
    id: "rebound_svt",
    name: "Rebound SVT After Conversion",
    conditions: [{ type: "converted" }],
    conditionLogic: "all",
    effects: [
      { type: "rebound_svt" },
      { type: "vitals_delta", hr: 125 },
      { type: "nurse_line", line: "Rate's climbing again - she's back in SVT! Want another dose?", priority: "critical" },
    ],
    delaySeconds: 60, // 1 minute after conversion
    maxTriggers: 1,
  },

  // Rule 10: Cardiology Consult Response
  {
    id: "cardiology_consult",
    name: "Cardiology Consult Called",
    conditions: [{ type: "consult_called", service: "cardiology" }],
    conditionLogic: "all",
    effects: [
      {
        type: "nurse_line",
        line: "Cardiology is on the phone. They recommend EP study and possible ablation given family history of WPW.",
        priority: "normal",
      },
    ],
    delaySeconds: 120, // 2 minute callback
    maxTriggers: 1,
  },

  // Rule 11: Auto-advance to treatment window
  {
    id: "svt_onset_to_treatment",
    name: "SVT Onset to Treatment Window",
    conditions: [{ type: "time_in_phase_gte", minutes: 1 }],
    conditionLogic: "all",
    effects: [
      { type: "advance_svt_phase", to: "treatment_window" },
    ],
    maxTriggers: 1,
  },

  // Rule 12: IV Access Established
  // DISABLED: Nurse response handled by handleOrder in index.ts to avoid duplicate/conflicting gauge responses.
  // The order handler builds the nurse line from parsed gauge/location, e.g., "22 gauge IV placed in right hand."
  // {
  //   id: "iv_access_confirmed",
  //   name: "IV Access Confirmed",
  //   conditions: [],
  //   conditionLogic: "all",
  //   effects: [
  //     { type: "nurse_line", line: "IV is in - 20 gauge in the right AC. Good blood return.", priority: "normal" },
  //   ],
  //   maxTriggers: 1,
  // },
];

/**
 * Create initial extended state for myocarditis scenario
 */
export function createInitialMyocarditisState(nowMs: number = Date.now()): MyocarditisExtendedState {
  return {
    phase: "scene_set",
    phaseEnteredAt: nowMs,
    shockStage: 1,
    shockStageEnteredAt: nowMs,

    scenarioStartedAt: nowMs,
    scenarioClockPaused: false,
    totalPausedMs: 0,
    deteriorationRate: 1.0,

    fluids: [],
    totalFluidsMlKg: 0,
    inotropes: [],
    activeInotropes: [],
    ivAccess: { count: 0, locations: [] },
    monitorOn: false,
    defibPadsOn: false,

    diagnostics: [],
    orderedDiagnostics: [],

    consults: [],
    consultsCalled: [],

    flags: {
      pulmonaryEdema: false,
      intubationCollapse: false,
      codeBlueActive: false,
      stabilizing: false,
    },

    ruleTriggers: [],
    pendingEffects: [],

    checklistCompleted: [],
    bonusesEarned: [],
    penaltiesIncurred: [],
    currentScore: 0,

    timelineEvents: [
      {
        ts: nowMs,
        type: "phase_change",
        description: "Scenario started - Scene set phase",
      },
    ],
  };
}
