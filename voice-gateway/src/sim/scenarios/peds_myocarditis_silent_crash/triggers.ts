/**
 * Deterministic Trigger Lines for "The Silent Crash" Scenario
 *
 * These lines fire automatically based on state conditions.
 * They are NOT AI-generated - they are safety-critical clinical information
 * that must be communicated accurately.
 */

import type { MyocarditisExtendedState } from "../../types";
import type { ShockStage, MyocarditisPhase } from "../../scenarioTypes";

// ============================================================================
// Trigger Types
// ============================================================================

export type TriggerPriority = "critical" | "high" | "normal";

export type NurseTrigger = {
  id: string;
  condition: (state: MyocarditisExtendedState, elapsedMs: number) => boolean;
  line: string;
  priority: TriggerPriority;
  cooldownMs: number;
  maxFires?: number;
};

export type ParentTrigger = {
  id: string;
  condition: (state: MyocarditisExtendedState, elapsedMs: number) => boolean;
  line: string;
  cooldownMs: number;
  maxFires?: number;
};

// ============================================================================
// Nurse Taylor - Critical Safety Lines
// ============================================================================

export const NURSE_TRIGGERS: NurseTrigger[] = [
  // BP crash alerts
  {
    id: "bp_crash_severe",
    condition: (state) => state.shockStage >= 4,
    line: "BP is crashing - I'm getting 60 systolic. We need to do something now!",
    priority: "critical",
    cooldownMs: 60000,
  },
  {
    id: "bp_dropping",
    condition: (state) => state.shockStage === 3,
    line: "Doc, BP is dropping. Systolic in the 70s now.",
    priority: "high",
    cooldownMs: 45000,
  },

  // Fluid overload warning
  {
    id: "fluid_overload_warning",
    condition: (state) => state.totalFluidsMlKg >= 15 && state.totalFluidsMlKg < 25,
    line: "That's about 15 mL/kg of fluid so far. Kid's starting to sound wet. Want me to slow down or hold?",
    priority: "high",
    cooldownMs: 120000,
    maxFires: 1,
  },
  {
    id: "fluid_overload_critical",
    condition: (state) => state.totalFluidsMlKg >= 25 && state.flags.pulmonaryEdema,
    line: "Crackles are definitely worse with the fluids. Sats are dropping. I'd hold off on more fluid if I were you.",
    priority: "critical",
    cooldownMs: 60000,
    maxFires: 2,
  },

  // Pre-intubation safety checks
  {
    id: "intubation_prep_check",
    condition: (state) => {
      // Fire when airway intervention is being considered (phase 3-4) but no inotrope running
      return (
        (state.phase === "decompensation" || state.phase === "intubation_trap") &&
        state.shockStage >= 3 &&
        state.activeInotropes.length === 0 &&
        !state.airway
      );
    },
    line: "If we're thinking about intubation, should I draw up push-dose epi? This kid's pretty shocky.",
    priority: "high",
    cooldownMs: 90000,
    maxFires: 2,
  },
  {
    id: "intubation_induction_query",
    condition: (state) => {
      // When airway is being discussed but not yet performed
      return state.phase === "intubation_trap" && !state.airway;
    },
    line: "What induction agent are you thinking? Ketamine or something else? I'll get it drawn up.",
    priority: "normal",
    cooldownMs: 120000,
    maxFires: 1,
  },

  // Post-intubation collapse
  {
    id: "intubation_collapse_alert",
    condition: (state) => state.flags.intubationCollapse,
    line: "BP just tanked after intubation! I'm pushing the epi now - get ready for compressions if we need them!",
    priority: "critical",
    cooldownMs: 30000,
    maxFires: 1,
  },

  // SpO2 alerts
  {
    id: "spo2_dropping",
    condition: (state) => state.shockStage >= 3 && !state.airway,
    line: "Sats are trending down. Want to try high-flow or should we think about the airway?",
    priority: "high",
    cooldownMs: 60000,
    maxFires: 2,
  },

  // Inotrope prompts
  {
    id: "epi_suggestion",
    condition: (state) => {
      return (
        state.shockStage >= 2 &&
        state.activeInotropes.length === 0 &&
        state.phase !== "scene_set" &&
        state.totalFluidsMlKg >= 10
      );
    },
    line: "We've given some fluid but BP's not budging. Should I get an epi drip ready?",
    priority: "normal",
    cooldownMs: 120000,
    maxFires: 2,
  },

  // Consult reminders
  {
    id: "picu_reminder",
    condition: (state) => {
      return (
        state.shockStage >= 2 &&
        !state.consultsCalled.includes("picu") &&
        state.phase === "decompensation"
      );
    },
    line: "This kid's looking sicker. Want me to give PICU a heads up?",
    priority: "normal",
    cooldownMs: 180000,
    maxFires: 1,
  },
  {
    id: "cardiology_reminder",
    condition: (state) => {
      const hasCardiacMarkers = state.orderedDiagnostics.includes("troponin") ||
        state.orderedDiagnostics.includes("bnp");
      return (
        hasCardiacMarkers &&
        !state.consultsCalled.includes("cardiology") &&
        state.phase !== "scene_set"
      );
    },
    line: "With those cardiac markers, should I page cardiology?",
    priority: "normal",
    cooldownMs: 180000,
    maxFires: 1,
  },

  // Code blue
  {
    id: "code_blue_start",
    condition: (state) => state.flags.codeBlueActive,
    line: "No pulse! Starting compressions! Someone call for help!",
    priority: "critical",
    cooldownMs: 10000,
    maxFires: 1,
  },

  // Stabilization acknowledgment
  {
    id: "stabilizing_notice",
    condition: (state) => state.flags.stabilizing && state.activeInotropes.length > 0,
    line: "BP is coming up with the epi. Looking a little better.",
    priority: "normal",
    cooldownMs: 60000,
    maxFires: 2,
  },
];

// ============================================================================
// Ms. Lane (Parent) - History & Emotional Lines
// ============================================================================

export const PARENT_TRIGGERS: ParentTrigger[] = [
  // Opening history (when asked)
  {
    id: "history_opening",
    condition: () => true, // Always available when parent is addressed
    line: "Jordan's been so tired since that cold last week. Barely got off the couch yesterday. And he said his chest hurts when he breathes deep.",
    cooldownMs: 300000,
    maxFires: 1,
  },

  // Viral prodrome details
  {
    id: "viral_prodrome",
    condition: (state) => state.phase === "scene_set" || state.phase === "recognition",
    line: "The cold started about 5 days ago. Runny nose, low fever for a couple days. We thought he was getting better, then this happened.",
    cooldownMs: 300000,
    maxFires: 1,
  },

  // Escalating worry
  {
    id: "worry_mild",
    condition: (state) => state.shockStage === 2,
    line: "He looks so pale. Is that normal? What's happening to him?",
    cooldownMs: 120000,
    maxFires: 1,
  },
  {
    id: "worry_moderate",
    condition: (state) => state.shockStage === 3,
    line: "Why are there so many people in here? Is Jordan going to be okay?",
    cooldownMs: 90000,
    maxFires: 1,
  },
  {
    id: "worry_severe",
    condition: (state) => state.shockStage >= 4,
    line: "Oh my god, what's happening? Please help him! Jordan, honey, can you hear me?",
    cooldownMs: 60000,
    maxFires: 2,
  },

  // Activity level context
  {
    id: "activity_history",
    condition: (state) => state.phase !== "end",
    line: "He's usually so active - soccer practice twice a week. But he couldn't even walk up the stairs today without getting winded.",
    cooldownMs: 300000,
    maxFires: 1,
  },

  // Family history
  {
    id: "family_history",
    condition: () => true,
    line: "No one in the family has heart problems that I know of. Jordan's always been healthy.",
    cooldownMs: 300000,
    maxFires: 1,
  },

  // Response to procedures
  {
    id: "procedure_concern",
    condition: (state) => state.airway !== undefined,
    line: "What are you doing to him? Is he going to be able to breathe?",
    cooldownMs: 120000,
    maxFires: 1,
  },

  // ECMO discussion
  {
    id: "ecmo_question",
    condition: (state) => state.consultsCalled.includes("ecmo"),
    line: "The other doctor mentioned a machine to help his heart. Is it really that bad?",
    cooldownMs: 180000,
    maxFires: 1,
  },
];

// ============================================================================
// Patient Jordan - Age-Appropriate Lines
// ============================================================================

export type PatientTrigger = {
  id: string;
  condition: (state: MyocarditisExtendedState, elapsedMs: number) => boolean;
  line: string;
  cooldownMs: number;
  maxFires?: number;
};

export const PATIENT_TRIGGERS: PatientTrigger[] = [
  // Chief complaint
  {
    id: "chief_complaint",
    condition: (state) => state.phase === "scene_set",
    line: "My chest hurts and I feel really tired. Like... I can't catch my breath even sitting here.",
    cooldownMs: 300000,
    maxFires: 1,
  },

  // Symptom descriptions
  {
    id: "chest_pain_detail",
    condition: (state) => state.phase === "scene_set" || state.phase === "recognition",
    line: "It's like a pressure... right here in the middle. It gets worse when I try to take a deep breath.",
    cooldownMs: 180000,
    maxFires: 1,
  },
  {
    id: "fatigue_detail",
    condition: () => true,
    line: "I've been so tired. Like, I couldn't even finish walking to school yesterday. Had to stop and rest.",
    cooldownMs: 180000,
    maxFires: 1,
  },

  // Deterioration responses
  {
    id: "feeling_worse",
    condition: (state) => state.shockStage >= 2,
    line: "I don't feel good... everything's kind of... fuzzy...",
    cooldownMs: 90000,
    maxFires: 2,
  },
  {
    id: "scared",
    condition: (state) => state.shockStage >= 3,
    line: "Mom? I'm scared... I can't... breathe...",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Recent illness
  {
    id: "cold_symptoms",
    condition: () => true,
    line: "I had a cold last week. Stuffy nose, cough, felt kind of hot for a couple days. I thought I was better.",
    cooldownMs: 300000,
    maxFires: 1,
  },
];

// ============================================================================
// Trigger Evaluation Functions
// ============================================================================

export type FiredTrigger = {
  triggerId: string;
  character: "nurse" | "parent" | "patient";
  line: string;
  priority: TriggerPriority;
  firedAt: number;
};

type TriggerHistory = {
  [triggerId: string]: {
    lastFired: number;
    fireCount: number;
  };
};

/**
 * Evaluate all nurse triggers and return any that should fire
 */
export function evaluateNurseTriggers(
  state: MyocarditisExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger[] {
  const now = Date.now();
  const fired: FiredTrigger[] = [];

  for (const trigger of NURSE_TRIGGERS) {
    const record = history[trigger.id];

    // Check cooldown
    if (record && now - record.lastFired < trigger.cooldownMs) {
      continue;
    }

    // Check max fires
    if (trigger.maxFires && record && record.fireCount >= trigger.maxFires) {
      continue;
    }

    // Check condition
    if (trigger.condition(state, elapsedMs)) {
      fired.push({
        triggerId: trigger.id,
        character: "nurse",
        line: trigger.line,
        priority: trigger.priority,
        firedAt: now,
      });
    }
  }

  // Sort by priority (critical > high > normal)
  const priorityOrder = { critical: 0, high: 1, normal: 2 };
  fired.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return fired;
}

/**
 * Evaluate parent triggers
 */
export function evaluateParentTriggers(
  state: MyocarditisExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger[] {
  const now = Date.now();
  const fired: FiredTrigger[] = [];

  for (const trigger of PARENT_TRIGGERS) {
    const record = history[trigger.id];

    if (record && now - record.lastFired < trigger.cooldownMs) continue;
    if (trigger.maxFires && record && record.fireCount >= trigger.maxFires) continue;

    if (trigger.condition(state, elapsedMs)) {
      fired.push({
        triggerId: trigger.id,
        character: "parent",
        line: trigger.line,
        priority: "normal",
        firedAt: now,
      });
    }
  }

  return fired;
}

/**
 * Evaluate patient triggers
 */
export function evaluatePatientTriggers(
  state: MyocarditisExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger[] {
  const now = Date.now();
  const fired: FiredTrigger[] = [];

  for (const trigger of PATIENT_TRIGGERS) {
    const record = history[trigger.id];

    if (record && now - record.lastFired < trigger.cooldownMs) continue;
    if (trigger.maxFires && record && record.fireCount >= trigger.maxFires) continue;

    if (trigger.condition(state, elapsedMs)) {
      fired.push({
        triggerId: trigger.id,
        character: "patient",
        line: trigger.line,
        priority: "normal",
        firedAt: now,
      });
    }
  }

  return fired;
}

/**
 * Get the single highest-priority trigger to fire (if any)
 * This prevents overwhelming the learner with multiple simultaneous messages
 */
export function getNextTrigger(
  state: MyocarditisExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger | null {
  // Nurse triggers take priority (safety-critical)
  const nurseTriggers = evaluateNurseTriggers(state, elapsedMs, history);
  if (nurseTriggers.length > 0) {
    return nurseTriggers[0];
  }

  // Then check parent triggers (less frequent)
  const parentTriggers = evaluateParentTriggers(state, elapsedMs, history);
  if (parentTriggers.length > 0 && Math.random() < 0.3) { // 30% chance to interject
    return parentTriggers[0];
  }

  return null;
}
