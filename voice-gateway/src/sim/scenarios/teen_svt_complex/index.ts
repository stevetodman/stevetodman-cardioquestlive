/**
 * Teen SVT Complex Scenario
 *
 * High-fidelity simulation of supraventricular tachycardia in a 14-year-old.
 * Teaches PALS SVT algorithm: vagal → adenosine → cardioversion
 *
 * Key learning objectives:
 * - Recognize SVT on ECG (narrow complex, regular, rate >220)
 * - Apply PALS algorithm in correct sequence
 * - Proper adenosine dosing (0.1 mg/kg rapid push with flush)
 * - Decision-making for stable vs unstable SVT
 * - Safe sedation before cardioversion
 */

export {
  svtComplexScenario,
  SVT_PHASES,
  SVT_CHARACTERS,
  SVT_SCORING_CONFIG,
  createInitialSVTState,
  type SVTPhaseDef,
  type SVTCharacter,
} from "./definition";

export {
  getResult,
  getNurseOrderAcknowledgment,
  AVAILABLE_RESULTS,
  type ResultType,
  type LabResult,
} from "./results";

export {
  NURSE_TRIGGERS,
  PARENT_TRIGGERS,
  PATIENT_TRIGGERS,
  evaluateNurseTriggers,
  evaluateParentTriggers,
  evaluatePatientTriggers,
  getNextTrigger,
  type NurseTrigger,
  type ParentTrigger,
  type PatientTrigger,
  type FiredTrigger,
  type TriggerPriority,
  type TriggerHistory,
} from "./triggers";

export {
  CHECKLIST_ITEMS,
  BONUS_ITEMS,
  PENALTY_ITEMS,
  calculateScore,
  updateScoreTracking,
  getChecklistStatus,
  type ChecklistItem,
  type BonusItem,
  type PenaltyItem,
  type ScoreResult,
} from "./scoring";

// Re-export types for convenience
export type { SVTPhase } from "../../scenarioTypes";
export type { SVTExtendedState } from "../../types";
