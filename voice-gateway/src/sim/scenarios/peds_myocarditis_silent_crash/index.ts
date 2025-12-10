/**
 * "The Silent Crash" - Pediatric Myocarditis Scenario
 *
 * High-fidelity 30-minute simulation of acute fulminant myocarditis
 * in a 10-year-old (Jordan, 32kg).
 *
 * Key learning objectives:
 * - Recognize cardiac etiology early (troponin/BNP/ECG)
 * - Avoid fluid overload in cardiogenic shock
 * - Safe intubation with pressor backup
 * - Early PICU/cardiology involvement
 */

export { silentCrashScenario } from "./definition";
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
export type {
  MyocarditisPhase,
  ShockStage,
} from "../../scenarioTypes";
