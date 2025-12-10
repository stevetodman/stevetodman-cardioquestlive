/**
 * SVT Scenario Triggers
 *
 * Deterministic character interjections based on scenario state.
 * These are NOT AI-generated - they're safety-critical clinical lines.
 */

import type { SVTExtendedState } from "../../types";
import type {
  TriggerPriority,
  TriggerHistory,
  NurseTrigger as GenericNurseTrigger,
  ParentTrigger as GenericParentTrigger,
  PatientTrigger as GenericPatientTrigger,
  FiredTrigger,
} from "../../triggers/types";

// Re-export shared types for convenience
export type { TriggerPriority, TriggerHistory, FiredTrigger };

// Scenario-specific type aliases
export type NurseTrigger = GenericNurseTrigger<SVTExtendedState>;
export type ParentTrigger = GenericParentTrigger<SVTExtendedState>;
export type PatientTrigger = GenericPatientTrigger<SVTExtendedState>;

// ============================================================================
// Nurse Triggers (Safety-Critical)
// ============================================================================

export const NURSE_TRIGGERS: NurseTrigger[] = [
  // SVT Recognition
  {
    id: "svt_recognition",
    condition: (state) =>
      state.phase === "svt_onset" && !state.ecgOrdered && state.currentRhythm === "svt",
    line: "Heart rate is 220, very regular. Looks like SVT. Want me to get a 12-lead?",
    priority: "high",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Vagal Maneuver Prompt
  {
    id: "vagal_prompt",
    condition: (state) =>
      (state.phase === "svt_onset" || state.phase === "treatment_window") &&
      state.ecgOrdered &&
      state.vagalAttempts === 0 &&
      state.adenosineDoses.length === 0 &&
      state.stabilityLevel <= 2,
    line: "She's hemodynamically stable. Want to try vagal maneuvers first while I draw up the adenosine?",
    priority: "normal",
    cooldownMs: 45000,
    maxFires: 1,
  },

  // Vagal Failed - Ready for Adenosine
  {
    id: "adenosine_ready",
    condition: (state) =>
      state.vagalAttempts > 0 &&
      !state.converted &&
      state.adenosineDoses.length === 0 &&
      state.currentRhythm === "svt",
    line: "Vagal didn't convert it. Adenosine is drawn up - 5 mg for her weight. Ready when you are.",
    priority: "normal",
    cooldownMs: 30000,
    maxFires: 1,
  },

  // First Adenosine Failed
  {
    id: "first_adenosine_failed",
    condition: (state) =>
      state.adenosineDoses.length === 1 &&
      !state.converted &&
      state.currentRhythm === "svt",
    line: "Briefly slowed then came right back. Want to try the higher dose - 0.2 mg/kg?",
    priority: "high",
    cooldownMs: 30000,
    maxFires: 1,
  },

  // Flush Reminder
  {
    id: "flush_reminder",
    condition: (state) =>
      state.adenosineDoses.length >= 1 &&
      !state.converted &&
      state.adenosineDoses.some((d) => !d.flushGiven),
    line: "Make sure we push that flush immediately after - adenosine has a really short half-life.",
    priority: "normal",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Hemodynamic Deterioration Warning
  {
    id: "stability_warning",
    condition: (state) => state.stabilityLevel >= 2 && state.currentRhythm === "svt",
    line: "BP is dropping - 90 systolic. She's getting more uncomfortable. We may need to move faster.",
    priority: "high",
    cooldownMs: 60000,
    maxFires: 2,
  },

  // Decompensation Alert
  {
    id: "decompensation_alert",
    condition: (state) => state.stabilityLevel >= 3,
    line: "She's decompensating - altered mental status, BP 75 systolic. We need to cardiovert now.",
    priority: "critical",
    cooldownMs: 30000,
    maxFires: 2,
  },

  // Cardioversion Setup
  {
    id: "cardioversion_setup",
    condition: (state) =>
      (state.phase === "cardioversion_decision" || state.stabilityLevel >= 3) &&
      state.cardioversionAttempts.length === 0,
    line: "Defib pads are on, synchronized mode ready. What sedation do you want before we shock?",
    priority: "critical",
    cooldownMs: 45000,
    maxFires: 1,
  },

  // Sedation Reminder Before Cardioversion
  {
    id: "sedation_reminder",
    condition: (state) =>
      state.phase === "cardioversion_decision" &&
      !state.sedationGiven &&
      state.cardioversionAttempts.length === 0,
    line: "She's still conscious - we should sedate before cardioversion. Midazolam or ketamine?",
    priority: "critical",
    cooldownMs: 30000,
    maxFires: 1,
  },

  // Conversion Success
  {
    id: "conversion_success",
    condition: (state) => state.converted && state.currentRhythm === "sinus",
    line: "She's in sinus! Heart rate coming down to 95. She looks so much better already.",
    priority: "critical",
    cooldownMs: 10000,
    maxFires: 1,
  },

  // Rebound SVT Alert
  {
    id: "rebound_alert",
    condition: (state) => state.flags.reboundSVT,
    line: "Rate's climbing again - she's back in SVT! 220 again. Ready for another dose?",
    priority: "critical",
    cooldownMs: 30000,
    maxFires: 1,
  },

  // IV Access Needed
  {
    id: "iv_needed",
    condition: (state) =>
      !state.ivAccess &&
      state.adenosineDoses.length === 0 &&
      (state.phase === "svt_onset" || state.phase === "treatment_window"),
    line: "We'll need IV access for adenosine. Want me to get a line in?",
    priority: "normal",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Monitor Reminder
  {
    id: "monitor_reminder",
    condition: (state) =>
      !state.monitorOn &&
      state.currentRhythm === "svt" &&
      state.phase !== "presentation",
    line: "Let's make sure she's on the monitor so we can watch for conversion.",
    priority: "normal",
    cooldownMs: 45000,
    maxFires: 1,
  },
];

// ============================================================================
// Parent Triggers (Emotional, History-Based)
// ============================================================================

export const PARENT_TRIGGERS: ParentTrigger[] = [
  // Initial Worry
  {
    id: "initial_worry",
    condition: (state) => state.phase === "svt_onset" && state.currentRhythm === "svt",
    line: "Oh my god, her heart is beating so fast! Is she going to be okay?",
    cooldownMs: 120000,
    maxFires: 1,
  },

  // History of Episodes
  {
    id: "episode_history",
    condition: (state) =>
      state.phase !== "presentation" &&
      state.phase !== "converted" &&
      !state.flags.parentInformed,
    line: "This has happened a few times before, but it usually stops on its own. This is the longest one.",
    cooldownMs: 180000,
    maxFires: 1,
  },

  // Family History
  {
    id: "family_history",
    condition: (state) =>
      state.phase !== "converted" && state.vagalAttempts > 0 && !state.converted,
    line: "My mother has something called WPW - she had an ablation years ago. Could Alex have that?",
    cooldownMs: 180000,
    maxFires: 1,
  },

  // Medication Concern
  {
    id: "medication_concern",
    condition: (state) => state.adenosineDoses.length > 0 && !state.converted,
    line: "What was that medicine you gave her? It looked like something weird happened for a second.",
    cooldownMs: 90000,
    maxFires: 1,
  },

  // Cardioversion Fear
  {
    id: "cardioversion_fear",
    condition: (state) =>
      state.phase === "cardioversion_decision" || state.stabilityLevel >= 3,
    line: "You have to shock her? Is that safe? She's only 14!",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Relief After Conversion
  {
    id: "relief",
    condition: (state) => state.converted && state.currentRhythm === "sinus",
    line: "Oh thank goodness! She looks so much better. What caused this? Will it happen again?",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Escalating Worry
  {
    id: "escalating_worry",
    condition: (state) => state.stabilityLevel >= 2 && !state.converted,
    line: "She doesn't look good - she's so pale! Please help her!",
    cooldownMs: 90000,
    maxFires: 2,
  },
];

// ============================================================================
// Patient Triggers (Age-Appropriate)
// ============================================================================

export const PATIENT_TRIGGERS: PatientTrigger[] = [
  // Chief Complaint
  {
    id: "chief_complaint",
    condition: (state) => state.phase === "presentation",
    line: "Sometimes my heart just starts racing out of nowhere. It's really scary when it happens.",
    cooldownMs: 180000,
    maxFires: 1,
  },

  // SVT Onset Reaction
  {
    id: "svt_onset_reaction",
    condition: (state) => state.phase === "svt_onset" && state.currentRhythm === "svt",
    line: "It's happening again! My heart is going so fast... I can feel it in my throat...",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Scared
  {
    id: "scared",
    condition: (state) =>
      state.currentRhythm === "svt" &&
      state.phase !== "presentation" &&
      state.stabilityLevel >= 1,
    line: "Is this going to stop? I'm scared... it won't slow down...",
    cooldownMs: 45000,
    maxFires: 2,
  },

  // Dizzy/Unwell
  {
    id: "feeling_worse",
    condition: (state) => state.stabilityLevel >= 2 && state.currentRhythm === "svt",
    line: "I feel dizzy... kind of like I might pass out... everything's fuzzy...",
    cooldownMs: 45000,
    maxFires: 2,
  },

  // Adenosine Sensation
  {
    id: "adenosine_feeling",
    condition: (state) => {
      if (state.adenosineDoses.length === 0) return false;
      const lastDose = state.adenosineDoses[state.adenosineDoses.length - 1];
      return Date.now() - lastDose.ts < 30000;
    },
    line: "Whoa... that felt so weird... like my heart stopped for a second and then... fluttered...",
    cooldownMs: 60000,
    maxFires: 2,
  },

  // Post-Conversion Relief
  {
    id: "relief",
    condition: (state) => state.converted && state.currentRhythm === "sinus",
    line: "Oh my god, it stopped! That's so much better... I can breathe again...",
    cooldownMs: 120000,
    maxFires: 1,
  },

  // Severe Distress
  {
    id: "severe_distress",
    condition: (state) => state.stabilityLevel >= 3,
    line: "Mom... I don't feel good... I think something's really wrong...",
    cooldownMs: 60000,
    maxFires: 1,
  },

  // Vagal Maneuver Confusion
  {
    id: "vagal_confusion",
    condition: (state) => state.vagalAttempts > 0 && !state.converted,
    line: "That didn't work... what else can you do? Please make it stop...",
    cooldownMs: 90000,
    maxFires: 1,
  },
];

// ============================================================================
// Trigger Evaluation Functions
// ============================================================================

export function evaluateNurseTriggers(
  state: SVTExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger[] {
  const triggered: FiredTrigger[] = [];
  const now = Date.now();

  for (const trigger of NURSE_TRIGGERS) {
    const historyEntry = history[trigger.id];

    // Check cooldown
    if (historyEntry && now - historyEntry.lastFired < trigger.cooldownMs) {
      continue;
    }

    // Check max fires
    if (trigger.maxFires && historyEntry && historyEntry.fireCount >= trigger.maxFires) {
      continue;
    }

    // Evaluate condition
    if (trigger.condition(state, elapsedMs)) {
      triggered.push({
        triggerId: trigger.id,
        character: "nurse",
        line: trigger.line,
        priority: trigger.priority,
      });
    }
  }

  // Sort by priority: critical > high > normal
  const priorityOrder: Record<TriggerPriority, number> = { critical: 0, high: 1, normal: 2 };
  triggered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return triggered;
}

export function evaluateParentTriggers(
  state: SVTExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger[] {
  const triggered: FiredTrigger[] = [];
  const now = Date.now();

  for (const trigger of PARENT_TRIGGERS) {
    const historyEntry = history[trigger.id];

    if (historyEntry && now - historyEntry.lastFired < trigger.cooldownMs) {
      continue;
    }

    if (trigger.maxFires && historyEntry && historyEntry.fireCount >= trigger.maxFires) {
      continue;
    }

    if (trigger.condition(state, elapsedMs)) {
      triggered.push({
        triggerId: trigger.id,
        character: "parent",
        line: trigger.line,
        priority: "normal",
      });
    }
  }

  return triggered;
}

export function evaluatePatientTriggers(
  state: SVTExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger[] {
  const triggered: FiredTrigger[] = [];
  const now = Date.now();

  for (const trigger of PATIENT_TRIGGERS) {
    const historyEntry = history[trigger.id];

    if (historyEntry && now - historyEntry.lastFired < trigger.cooldownMs) {
      continue;
    }

    if (trigger.maxFires && historyEntry && historyEntry.fireCount >= trigger.maxFires) {
      continue;
    }

    if (trigger.condition(state, elapsedMs)) {
      triggered.push({
        triggerId: trigger.id,
        character: "patient",
        line: trigger.line,
        priority: "normal",
      });
    }
  }

  return triggered;
}

/**
 * Get the next trigger to fire (only one per evaluation cycle).
 * Priority: nurse (safety-critical) > parent (30% chance) > patient (30% chance)
 */
export function getNextTrigger(
  state: SVTExtendedState,
  elapsedMs: number,
  history: TriggerHistory
): FiredTrigger | null {
  // Nurse triggers are highest priority (safety-critical)
  const nurseTriggers = evaluateNurseTriggers(state, elapsedMs, history);
  if (nurseTriggers.length > 0) {
    return nurseTriggers[0];
  }

  // Parent triggers (30% chance to interject)
  const parentTriggers = evaluateParentTriggers(state, elapsedMs, history);
  if (parentTriggers.length > 0 && Math.random() < 0.3) {
    return parentTriggers[0];
  }

  // Patient triggers (30% chance to interject)
  const patientTriggers = evaluatePatientTriggers(state, elapsedMs, history);
  if (patientTriggers.length > 0 && Math.random() < 0.3) {
    return patientTriggers[0];
  }

  return null;
}
