/**
 * Scoring System for "The Silent Crash" Scenario
 *
 * Pass/fail checklist + point-based scoring for detailed feedback.
 * Passing requires 4/5 checklist items.
 */

import type { MyocarditisExtendedState } from "../../types";

// ============================================================================
// Types
// ============================================================================

export type ChecklistItem = {
  id: string;
  description: string;
  explanation: string;
  isRequired: boolean;
  check: (state: MyocarditisExtendedState, elapsedMs: number) => boolean;
};

export type BonusItem = {
  id: string;
  description: string;
  points: number;
  check: (state: MyocarditisExtendedState, elapsedMs: number) => boolean;
};

export type PenaltyItem = {
  id: string;
  description: string;
  points: number; // Negative
  check: (state: MyocarditisExtendedState, elapsedMs: number) => boolean;
};

export type ScoreResult = {
  passed: boolean;
  checklistResults: {
    item: ChecklistItem;
    achieved: boolean;
  }[];
  checklistScore: string; // e.g., "4/5"
  bonusesEarned: {
    item: BonusItem;
    points: number;
  }[];
  penaltiesIncurred: {
    item: PenaltyItem;
    points: number;
  }[];
  totalPoints: number;
  grade: "A" | "B" | "C" | "D" | "F";
  feedback: string[];
};

// ============================================================================
// Pass/Fail Checklist Items (Need 4/5 to pass)
// ============================================================================

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "recognized_cardiac",
    description: "Recognized cardiac etiology",
    explanation: "Ordered troponin, BNP, or ECG to evaluate for cardiac cause",
    isRequired: false,
    check: (state) => {
      const cardiacTests = ["troponin", "bnp", "ecg"];
      return cardiacTests.some((test) => state.orderedDiagnostics.includes(test));
    },
  },
  {
    id: "avoided_fluid_overload",
    description: "Avoided fluid overload",
    explanation: "Total fluids ≤40 mL/kg (cardiogenic shock worsens with excessive fluids)",
    isRequired: false,
    check: (state) => state.totalFluidsMlKg <= 40,
  },
  {
    id: "called_picu_timely",
    description: "Called PICU within 10 minutes of decompensation",
    explanation: "Early PICU involvement improves outcomes in fulminant myocarditis",
    isRequired: false,
    check: (state, elapsedMs) => {
      const picuConsult = state.consults.find((c) => c.service === "picu");
      if (!picuConsult) return false;

      // Check if called within 10 min of decompensation phase entry
      const decompPhaseEntry = state.timelineEvents.find(
        (e) => e.type === "phase_change" && e.description.includes("decompensation")
      );
      if (!decompPhaseEntry) {
        // If never reached decompensation, calling PICU at all counts
        return true;
      }

      const timeFromDecomp = picuConsult.calledAt - decompPhaseEntry.ts;
      return timeFromDecomp <= 10 * 60 * 1000; // 10 minutes in ms
    },
  },
  {
    id: "safe_intubation",
    description: "Performed safe intubation",
    explanation: "Used ketamine (not propofol) and had pressor ready before intubation",
    isRequired: false,
    check: (state, elapsedMs) => {
      if (!state.airway || state.airway.type !== "intubation") {
        // If never intubated, this is N/A - give credit
        return true;
      }

      const details = state.airway.details;
      if (!details) return false;

      // Safe = ketamine (or etomidate) AND pressor ready
      const safeInduction = details.inductionAgent === "ketamine" || details.inductionAgent === "etomidate";
      const pressorReady = Boolean(details.pressorReady || details.pushDoseEpiDrawn);

      return safeInduction && pressorReady;
    },
  },
  {
    id: "consulted_cardiology",
    description: "Consulted cardiology",
    explanation: "Cardiology involvement is essential for myocarditis management",
    isRequired: false,
    check: (state) => state.consultsCalled.includes("cardiology"),
  },
];

// ============================================================================
// Bonus Points
// ============================================================================

export const BONUS_ITEMS: BonusItem[] = [
  {
    id: "early_cardiac_markers",
    description: "Ordered cardiac markers in first 5 minutes",
    points: 10,
    check: (state, elapsedMs) => {
      const cardiacOrders = state.diagnostics.filter(
        (d) => d.type === "troponin" || d.type === "bnp"
      );
      // Use scenarioStartedAt, not phaseEnteredAt (which changes on phase transitions)
      return cardiacOrders.some((d) => d.orderedAt - state.scenarioStartedAt <= 5 * 60 * 1000);
    },
  },
  {
    id: "early_ecg",
    description: "Ordered ECG in first 3 minutes",
    points: 5,
    check: (state) => {
      const ecgOrder = state.diagnostics.find((d) => d.type === "ecg");
      // Use scenarioStartedAt, not phaseEnteredAt (which changes on phase transitions)
      return ecgOrder !== undefined && ecgOrder.orderedAt - state.scenarioStartedAt <= 3 * 60 * 1000;
    },
  },
  {
    id: "early_inotropes",
    description: "Started inotropes before intubation",
    points: 10,
    check: (state) => {
      if (state.inotropes.length === 0) return false;
      if (!state.airway) return true; // Started inotropes, never intubated

      const firstInotrope = state.inotropes[0];
      return firstInotrope.startedAt < state.airway.ts;
    },
  },
  {
    id: "ecmo_alert",
    description: "Called ECMO team for evaluation",
    points: 10,
    check: (state) => state.consultsCalled.includes("ecmo"),
  },
  {
    id: "ordered_echo",
    description: "Ordered bedside echo",
    points: 5,
    check: (state) => state.orderedDiagnostics.includes("echo"),
  },
  {
    id: "cautious_fluids",
    description: "Kept fluids under 20 mL/kg total",
    points: 5,
    check: (state) => state.totalFluidsMlKg <= 20,
  },
  {
    id: "hfnc_before_intubation",
    description: "Tried HFNC before intubation",
    points: 5,
    check: (state) => {
      const hfncEvent = state.timelineEvents.find(
        (e) => e.type === "intervention" && e.description.toLowerCase().includes("hfnc")
      );
      if (!hfncEvent) return false;
      if (!state.airway || state.airway.type !== "intubation") return true;
      return hfncEvent.ts < state.airway.ts;
    },
  },
];

// ============================================================================
// Penalties
// ============================================================================

export const PENALTY_ITEMS: PenaltyItem[] = [
  {
    id: "fluid_overload",
    description: "Gave >60 mL/kg fluids (severe fluid overload)",
    points: -15,
    check: (state) => state.totalFluidsMlKg > 60,
  },
  {
    id: "propofol_crash",
    description: "Used propofol for intubation without pressor backup",
    points: -15,
    check: (state) => {
      if (!state.airway || state.airway.type !== "intubation") return false;
      const details = state.airway.details;
      return details?.inductionAgent === "propofol" && !details?.pressorReady;
    },
  },
  {
    id: "delayed_picu",
    description: "PICU called >15 minutes after decompensation",
    points: -10,
    check: (state) => {
      const picuConsult = state.consults.find((c) => c.service === "picu");
      if (!picuConsult) return false;

      const decompPhaseEntry = state.timelineEvents.find(
        (e) => e.type === "phase_change" && e.description.includes("decompensation")
      );
      if (!decompPhaseEntry) return false;

      const timeFromDecomp = picuConsult.calledAt - decompPhaseEntry.ts;
      return timeFromDecomp > 15 * 60 * 1000;
    },
  },
  {
    id: "no_cardiology",
    description: "Never consulted cardiology",
    points: -10,
    check: (state) => !state.consultsCalled.includes("cardiology"),
  },
  {
    id: "milrinone_without_epi",
    description: "Started milrinone without concurrent vasopressor",
    points: -10,
    check: (state) => {
      const milrinone = state.inotropes.find((i) => i.drug === "milrinone");
      if (!milrinone) return false;

      // Check if epi was running when milrinone started
      const epiRunning = state.inotropes.some(
        (i) => i.drug === "epi" && i.startedAt <= milrinone.startedAt && (!i.stoppedAt || i.stoppedAt > milrinone.startedAt)
      );
      return !epiRunning;
    },
  },
  {
    id: "high_peep_crash",
    description: "Used high PEEP (≥8) causing hemodynamic instability",
    points: -10,
    check: (state) => {
      if (!state.airway?.details?.peep) return false;
      return state.airway.details.peep >= 8 && state.flags.intubationCollapse;
    },
  },
  {
    id: "code_blue",
    description: "Patient went into cardiac arrest",
    points: -20,
    check: (state) => state.flags.codeBlueActive,
  },
];

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate final score and pass/fail status
 */
export function calculateScore(
  state: MyocarditisExtendedState,
  elapsedMs: number
): ScoreResult {
  // Evaluate checklist
  const checklistResults = CHECKLIST_ITEMS.map((item) => ({
    item,
    achieved: item.check(state, elapsedMs),
  }));

  const achievedCount = checklistResults.filter((r) => r.achieved).length;
  const passed = achievedCount >= 4;
  const checklistScore = `${achievedCount}/${CHECKLIST_ITEMS.length}`;

  // Evaluate bonuses
  const bonusesEarned = BONUS_ITEMS.filter((item) => item.check(state, elapsedMs)).map(
    (item) => ({ item, points: item.points })
  );

  // Evaluate penalties
  const penaltiesIncurred = PENALTY_ITEMS.filter((item) => item.check(state, elapsedMs)).map(
    (item) => ({ item, points: item.points })
  );

  // Calculate total points
  const basePoints = 50; // Start at 50
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
    checklistScore,
    bonusesEarned,
    penaltiesIncurred,
    totalPoints,
    grade,
    feedback,
  };
}

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
  bonuses: { item: BonusItem; points: number }[],
  penalties: { item: PenaltyItem; points: number }[],
  passed: boolean
): string[] {
  const feedback: string[] = [];

  // Overall pass/fail
  if (passed) {
    feedback.push("Passed: You demonstrated competence in managing fulminant myocarditis.");
  } else {
    feedback.push("Did not pass: Review the key management principles for cardiogenic shock.");
  }

  // Missed checklist items
  const missed = checklistResults.filter((r) => !r.achieved);
  if (missed.length > 0) {
    feedback.push("\nAreas for improvement:");
    missed.forEach((m) => {
      feedback.push(`• ${m.item.description}: ${m.item.explanation}`);
    });
  }

  // Highlight bonuses
  if (bonuses.length > 0) {
    feedback.push("\nStrengths demonstrated:");
    bonuses.forEach((b) => {
      feedback.push(`• ${b.item.description} (+${b.points} points)`);
    });
  }

  // Highlight penalties
  if (penalties.length > 0) {
    feedback.push("\nCritical errors:");
    penalties.forEach((p) => {
      feedback.push(`• ${p.item.description} (${p.points} points)`);
    });
  }

  return feedback;
}

// ============================================================================
// Real-Time Score Tracking
// ============================================================================

/**
 * Update extended state with newly earned bonuses/penalties
 * Call this after significant actions
 */
export function updateScoreTracking(
  state: MyocarditisExtendedState,
  elapsedMs: number
): { newBonuses: string[]; newPenalties: string[] } {
  const newBonuses: string[] = [];
  const newPenalties: string[] = [];

  // Check bonuses
  for (const bonus of BONUS_ITEMS) {
    if (!state.bonusesEarned.includes(bonus.id) && bonus.check(state, elapsedMs)) {
      state.bonusesEarned.push(bonus.id);
      state.currentScore += bonus.points;
      newBonuses.push(bonus.id);
    }
  }

  // Check penalties
  for (const penalty of PENALTY_ITEMS) {
    if (!state.penaltiesIncurred.includes(penalty.id) && penalty.check(state, elapsedMs)) {
      state.penaltiesIncurred.push(penalty.id);
      state.currentScore += penalty.points;
      newPenalties.push(penalty.id);
    }
  }

  // Clamp score
  state.currentScore = Math.max(0, Math.min(100, state.currentScore));

  return { newBonuses, newPenalties };
}

/**
 * Get current checklist status for real-time display
 */
export function getChecklistStatus(
  state: MyocarditisExtendedState,
  elapsedMs: number
): { id: string; description: string; achieved: boolean }[] {
  return CHECKLIST_ITEMS.map((item) => ({
    id: item.id,
    description: item.description,
    achieved: item.check(state, elapsedMs),
  }));
}
