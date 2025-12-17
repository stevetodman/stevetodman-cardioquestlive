/**
 * Shared simulation state types.
 * Centralizes simState structure to reduce duplication across components.
 */

import type { PatientScenarioId } from "./voiceGateway";

/** Auscultation audio clip for heart/lung sounds */
export interface AuscultationClip {
  type: "heart" | "lung";
  label: string;
  url: string;
}

/** Order status in the simulation */
export type OrderStatus = "pending" | "complete";

/** Order types supported by the simulation */
export type OrderType =
  | "vitals"
  | "ekg"
  | "labs"
  | "imaging"
  | "cardiac_exam"
  | "lung_exam"
  | "general_exam"
  | "iv_access";

/** Order result from the simulation */
export interface OrderResult {
  summary?: string;
  details?: string;
  abnormal?: boolean | string;
  nextAction?: string;
  rationale?: string;
  imageUrl?: string;
  /** Additional metadata from backend order processing */
  meta?: Record<string, unknown>;
}

/** Order in the simulation */
export interface SimOrder {
  id: string;
  type: OrderType;
  status: OrderStatus;
  result?: OrderResult;
  completedAt?: number;
  orderedBy?: { id: string; name: string; role: string };
}

/** EKG history entry */
export interface EkgHistoryEntry {
  ts: number;
  summary: string;
  imageUrl?: string;
}

/** Telemetry history entry */
export interface TelemetryHistoryEntry {
  ts: number;
  rhythm?: string;
  note?: string;
}

/** Treatment history entry */
export interface TreatmentHistoryEntry {
  ts: number;
  treatmentType: string;
  note?: string;
}

/** Budget/cost tracking state */
export interface BudgetState {
  usdEstimate?: number;
  voiceSeconds?: number;
  throttled?: boolean;
  fallback?: boolean;
}

/** IV access status */
export interface IVStatus {
  placed: boolean;
  site?: string;
  gauge?: number;
}

/** Oxygen delivery status */
export interface OxygenStatus {
  type: "nasal_cannula" | "simple_mask" | "non_rebreather" | "high_flow";
  flowRateLpm: number;
}

/** Defibrillator pads status */
export interface DefibPadsStatus {
  placed: boolean;
}

/** Cardiac monitor status */
export interface MonitorStatus {
  attached: boolean;
}

/** NG tube status */
export interface NGTubeStatus {
  placed: boolean;
  size?: number;
}

/** Foley catheter status */
export interface FoleyStatus {
  placed: boolean;
  size?: number;
}

/** Endotracheal tube status */
export interface ETTStatus {
  placed: boolean;
  size?: number;
  depth?: number;
}

/** All interventions applied to patient */
export interface Interventions {
  iv?: IVStatus;
  oxygen?: OxygenStatus;
  defibPads?: DefibPadsStatus;
  monitor?: MonitorStatus;
  ngTube?: NGTubeStatus;
  foley?: FoleyStatus;
  ett?: ETTStatus;
}

/**
 * Core simulation state shared between presenter and participant views.
 * This is the canonical type for simState across the app.
 */
export interface SimulationState {
  stageId: string;
  stageIds?: string[];
  scenarioId?: PatientScenarioId;
  vitals: Record<string, unknown>;
  exam?: Record<string, string | undefined>;
  examAudio?: AuscultationClip[];
  telemetry?: boolean;
  rhythmSummary?: string;
  telemetryWaveform?: number[];
  findings?: string[];
  fallback: boolean;
  budget?: BudgetState;
  orders?: SimOrder[];
  ekgHistory?: EkgHistoryEntry[];
  telemetryHistory?: TelemetryHistoryEntry[];
  treatmentHistory?: TreatmentHistoryEntry[];
  scenarioStartedAt?: number;
  /** Current interventions applied to patient */
  interventions?: Interventions;
  /** Extended state for complex scenarios (SVT, myocarditis, etc.) */
  extended?: Record<string, unknown>;
  /** Elapsed time in seconds since scenario start */
  elapsedSeconds?: number;
}
