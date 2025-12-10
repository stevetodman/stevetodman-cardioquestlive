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
export type OrderType = "vitals" | "ekg" | "labs" | "imaging";

/** Order result from the simulation */
export interface OrderResult {
  summary?: string;
  abnormal?: string;
  nextAction?: string;
  rationale?: string;
  imageUrl?: string;
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
}
