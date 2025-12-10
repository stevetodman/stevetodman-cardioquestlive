/**
 * SVT Scenario Scoring System
 *
 * Pass/fail based on 5-item checklist (need 4/5 to pass)
 * Plus bonuses for excellence and penalties for critical errors.
 */

import type { SVTExtendedState } from "../../types";

// ============================================================================
// Types
// ============================================================================

export type ChecklistItem = {
  id: string;
  description: string;
  explanation: string;
  isRequired: boolean;
  check: (state: SVTExtendedState, elapsedMs: number) => boolean;
};

export type BonusItem = {
  id: string;
  description: string;
  points: number;
  check: (state: SVTExtendedState, elapsedMs: number) => boolean;
};

export type PenaltyItem = {
  id: string;
  description: string;
  points: number; // Negative
  check: (state: SVTExtendedState, elapsedMs: number) => boolean;
};

export type ScoreResult = {
  passed: boolean;
  checklistResults: { item: ChecklistItem; achieved: boolean }[];
  checklistScore: string; // e.g., "4/5"
  bonusesEarned: { item: BonusItem; points: number }[];
  penaltiesIncurred: { item: PenaltyItem; points: number }[];
  totalPoints: number;
  grade: "A" | "B" | "C" | "D" | "F";
  feedback: string[];
};

// ============================================================================
// Checklist Items (5 items, need 4/5 to pass)
// ============================================================================

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "ecg_ordered",
    description: "Ordered 12-lead ECG",
    explanation: "ECG confirms SVT diagnosis and rules out other arrhythmias (WPW, VT)",
    isRequired: false,
    check: (state) => state.ecgOrdered,
  },
  {
    id: "vagal_attempted",
    description: "Attempted vagal maneuvers before adenosine",
    explanation: "PALS recommends vagal maneuvers as first-line for hemodynamically stable SVT",
    isRequired: false,
    check: (state) => {
      // If patient was unstable from the start (stabilityLevel >= 3), vagal can be skipped
      if (state.stabilityLevel >= 3 && state.adenosineDoses.length > 0) {
        return true; // Credit given for unstable patient going straight to adenosine
      }
      return state.vagalAttempts > 0;
    },
  },
  {
    id: "adenosine_correct_dose",
    description: "Adenosine dosed correctly (0.1 mg/kg ±20%)",
    explanation: "First dose 0.1 mg/kg IV rapid push (max 6mg), second dose 0.2 mg/kg (max 12mg)",
    isRequired: false,
    check: (state) => {
      if (state.adenosineDoses.length === 0) {
        // No adenosine given - check if converted by other means
        return state.converted && state.conversionMethod === "vagal";
      }
      const firstDose = state.adenosineDoses[0];
      // 0.1 mg/kg ±20% = 0.08-0.12 mg/kg for first dose
      return firstDose.doseMgKg >= 0.08 && firstDose.doseMgKg <= 0.12;
    },
  },
  {
    id: "continuous_monitoring",
    description: "Patient on monitor during treatment",
    explanation: "Continuous cardiac monitoring essential to observe conversion and detect complications",
    isRequired: false,
    check: (state) => state.monitorOn,
  },
  {
    id: "patient_reassured",
    description: "Reassured patient/parent during episode",
    explanation: "Patient communication reduces anxiety and improves cooperation",
    isRequired: false,
    check: (state) => state.flags.patientReassured || state.flags.parentInformed,
  },
];

// ============================================================================
// Bonus Items (Excellence Points)
// ============================================================================

export const BONUS_ITEMS: BonusItem[] = [
  {
    id: "early_ecg",
    description: "ECG ordered in first 60 seconds",
    points: 10,
    check: (state, elapsedMs) => {
      if (!state.ecgOrderedTs) return false;
      const ecgDelayMs = state.ecgOrderedTs - state.scenarioStartedAt;
      return ecgDelayMs <= 60 * 1000;
    },
  },
  {
    id: "first_dose_conversion",
    description: "Converted on first adenosine dose",
    points: 15,
    check: (state) => {
      return state.converted && state.conversionMethod === "adenosine_first";
    },
  },
  {
    id: "vagal_conversion",
    description: "Converted with vagal maneuvers alone",
    points: 20,
    check: (state) => {
      return state.converted && state.conversionMethod === "vagal";
    },
  },
  {
    id: "cardiology_consult",
    description: "Consulted cardiology",
    points: 10,
    check: (state) => state.consultsCalled.includes("cardiology"),
  },
  {
    id: "proper_flush",
    description: "Used rapid flush with adenosine",
    points: 5,
    check: (state) => {
      if (state.adenosineDoses.length === 0) return false;
      return state.adenosineDoses.some((d) => d.flushGiven);
    },
  },
  {
    id: "family_history_obtained",
    description: "Asked about family history (identified WPW risk)",
    points: 5,
    check: (state) => {
      // Check if parent was engaged about family history
      return state.flags.parentInformed;
    },
  },
  {
    id: "sedation_before_cardioversion",
    description: "Properly sedated before cardioversion",
    points: 10,
    check: (state) => {
      if (state.cardioversionAttempts.length === 0) return false;
      return state.cardioversionAttempts.every((c) => c.sedated);
    },
  },
];

// ============================================================================
// Penalty Items (Critical Errors)
// ============================================================================

export const PENALTY_ITEMS: PenaltyItem[] = [
  {
    id: "adenosine_underdose",
    description: "Adenosine dose too low (<0.05 mg/kg)",
    points: -10,
    check: (state) => {
      if (state.adenosineDoses.length === 0) return false;
      return state.adenosineDoses.some((d) => d.doseMgKg < 0.05);
    },
  },
  {
    id: "adenosine_overdose",
    description: "Adenosine dose too high (>0.25 mg/kg) - risk of prolonged asystole",
    points: -15,
    check: (state) => {
      if (state.adenosineDoses.length === 0) return false;
      return state.adenosineDoses.some((d) => d.doseMgKg > 0.25);
    },
  },
  {
    id: "skipped_vagal_stable",
    description: "Skipped vagal maneuvers in stable patient",
    points: -5,
    check: (state) => {
      // Only penalize if patient was stable (level 1-2) and went straight to adenosine
      if (state.stabilityLevel >= 3) return false; // Unstable - OK to skip vagal
      if (state.vagalAttempts > 0) return false; // Tried vagal
      if (state.adenosineDoses.length === 0) return false; // No adenosine given
      return true; // Stable patient, skipped vagal, gave adenosine
    },
  },
  {
    id: "delayed_treatment",
    description: "No treatment attempted for >5 minutes during SVT",
    points: -15,
    check: (state, elapsedMs) => {
      if (state.converted) return false; // Converted - no penalty
      if (state.vagalAttempts > 0 || state.adenosineDoses.length > 0 || state.cardioversionAttempts.length > 0) {
        return false; // Treatment was attempted
      }
      // Check if we've been in SVT for >5 minutes without treatment
      const svtDuration = elapsedMs - (state.phaseEnteredAt - state.scenarioStartedAt);
      return state.currentRhythm === "svt" && svtDuration > 5 * 60 * 1000;
    },
  },
  {
    id: "unsedated_cardioversion",
    description: "Cardioversion without sedation - traumatic for patient",
    points: -20,
    check: (state) => state.flags.unsedatedCardioversion,
  },
  {
    id: "patient_decompensated",
    description: "Patient decompensated (reached unstable state)",
    points: -15,
    check: (state) => state.phase === "decompensating" || state.stabilityLevel >= 4,
  },
  {
    id: "amiodarone_first_line",
    description: "Used amiodarone before adenosine (incorrect first-line agent)",
    points: -10,
    check: (state) => {
      // Check if amiodarone was given before any adenosine
      const amioGiven = state.timelineEvents.some(
        (e) => e.type === "treatment" && e.description.toLowerCase().includes("amiodarone")
      );
      if (!amioGiven) return false;
      return state.adenosineDoses.length === 0;
    },
  },
];

// ============================================================================
// Score Calculation Functions
// ============================================================================

function getGrade(points: number, passed: boolean): "A" | "B" | "C" | "D" | "F" {
  if (!passed) return "F";
  if (points >= 90) return "A";
  if (points >= 80) return "B";
  if (points >= 70) return "C";
  if (points >= 60) return "D";
  return "F";
}

function generateFeedback(
  checklistResults: { item: ChecklistItem; achieved: boolean }[],
  bonusesEarned: { item: BonusItem; points: number }[],
  penaltiesIncurred: { item: PenaltyItem; points: number }[],
  passed: boolean
): string[] {
  const feedback: string[] = [];

  // Pass/fail message
  if (passed) {
    feedback.push("Passed! Successfully managed SVT using PALS algorithm.");
  } else {
    feedback.push("Did not pass. Review PALS SVT algorithm for improvement areas.");
  }

  // Highlight missed checklist items
  const missed = checklistResults.filter((r) => !r.achieved);
  if (missed.length > 0) {
    feedback.push("Areas to improve:");
    for (const m of missed) {
      feedback.push(`- ${m.item.description}: ${m.item.explanation}`);
    }
  }

  // Highlight bonuses
  if (bonusesEarned.length > 0) {
    feedback.push("Excellent work on:");
    for (const b of bonusesEarned) {
      feedback.push(`- ${b.item.description} (+${b.points} pts)`);
    }
  }

  // Highlight penalties
  if (penaltiesIncurred.length > 0) {
    feedback.push("Critical errors:");
    for (const p of penaltiesIncurred) {
      feedback.push(`- ${p.item.description} (${p.points} pts)`);
    }
  }

  return feedback;
}

export function calculateScore(state: SVTExtendedState, elapsedMs: number): ScoreResult {
  // Evaluate checklist
  const checklistResults = CHECKLIST_ITEMS.map((item) => ({
    item,
    achieved: item.check(state, elapsedMs),
  }));

  const achievedCount = checklistResults.filter((r) => r.achieved).length;
  const passed = achievedCount >= 4; // Need 4 out of 5

  // Evaluate bonuses
  const bonusesEarned: { item: BonusItem; points: number }[] = [];
  for (const bonus of BONUS_ITEMS) {
    if (bonus.check(state, elapsedMs)) {
      bonusesEarned.push({ item: bonus, points: bonus.points });
    }
  }

  // Evaluate penalties
  const penaltiesIncurred: { item: PenaltyItem; points: number }[] = [];
  for (const penalty of PENALTY_ITEMS) {
    if (penalty.check(state, elapsedMs)) {
      penaltiesIncurred.push({ item: penalty, points: penalty.points });
    }
  }

  // Calculate total points
  const basePoints = 50;
  const checklistPoints = achievedCount * 10; // 10 points per checklist item
  const bonusPoints = bonusesEarned.reduce((sum, b) => sum + b.points, 0);
  const penaltyPoints = penaltiesIncurred.reduce((sum, p) => sum + p.points, 0);

  const totalPoints = Math.max(0, Math.min(100, basePoints + checklistPoints + bonusPoints + penaltyPoints));

  // Determine grade
  const grade = getGrade(totalPoints, passed);

  // Generate feedback
  const feedback = generateFeedback(checklistResults, bonusesEarned, penaltiesIncurred, passed);

  return {
    passed,
    checklistResults,
    checklistScore: `${achievedCount}/5`,
    bonusesEarned,
    penaltiesIncurred,
    totalPoints,
    grade,
    feedback,
  };
}

/**
 * Real-time score tracking - called periodically to update bonuses/penalties
 */
export function updateScoreTracking(
  state: SVTExtendedState,
  elapsedMs: number
): { newBonuses: string[]; newPenalties: string[] } {
  const newBonuses: string[] = [];
  const newPenalties: string[] = [];

  // Check bonuses
  for (const bonus of BONUS_ITEMS) {
    if (!state.bonusesEarned.includes(bonus.id) && bonus.check(state, elapsedMs)) {
      state.bonusesEarned.push(bonus.id);
      state.currentScore = Math.min(100, state.currentScore + bonus.points);
      newBonuses.push(bonus.id);
    }
  }

  // Check penalties
  for (const penalty of PENALTY_ITEMS) {
    if (!state.penaltiesIncurred.includes(penalty.id) && penalty.check(state, elapsedMs)) {
      state.penaltiesIncurred.push(penalty.id);
      state.currentScore = Math.max(0, state.currentScore + penalty.points);
      newPenalties.push(penalty.id);
    }
  }

  return { newBonuses, newPenalties };
}

/**
 * Get current checklist status for display
 */
export function getChecklistStatus(
  state: SVTExtendedState,
  elapsedMs: number
): { id: string; description: string; achieved: boolean }[] {
  return CHECKLIST_ITEMS.map((item) => ({
    id: item.id,
    description: item.description,
    achieved: item.check(state, elapsedMs),
  }));
}
