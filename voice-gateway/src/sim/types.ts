export type ToolIntentType =
  | "intent_updateVitals"
  | "intent_advanceStage"
  | "intent_revealFinding"
  | "intent_setEmotion";

export type ToolIntent =
  | {
      type: "intent_updateVitals";
      delta: Partial<Vitals>;
      reason?: string;
    }
  | {
      type: "intent_advanceStage";
      stageId: string;
      reason?: string;
    }
  | {
      type: "intent_revealFinding";
      findingId: string;
      reason?: string;
    }
  | {
      type: "intent_setEmotion";
      emotion: string;
      intensity?: number;
      reason?: string;
    };

export type EventType =
  | "realtime.connected"
  | "realtime.disconnected"
  | "audio.floor.changed"
  | "tool.intent.received"
  | "tool.intent.approved"
  | "tool.intent.rejected"
  | "scenario.stage.changed"
  | "scenario.finding.revealed"
  | "scenario.state.diff"
  | "fallback.enabled"
  | "fallback.disabled";

export type EventLogEntry = {
  id: string;
  ts: number;
  simId: string;
  type: EventType;
  payload?: Record<string, unknown>;
  correlationId?: string;
};

export type Vitals = {
  hr?: number;
  bp?: string;
  rr?: number;
  spo2?: number;
  temp?: number;
};

export type SimState = {
  simId: string;
  scenarioId: string;
  stageId: string;
  vitals: Vitals;
  exam?: {
    general?: string;
    cardio?: string;
    lungs?: string;
    perfusion?: string;
    neuro?: string;
    heartAudioUrl?: string;
    lungAudioUrl?: string;
  };
  telemetry?: boolean;
  rhythmSummary?: string;
  telemetryWaveform?: number[];
  telemetryHistory?: { ts: number; rhythm?: string; note?: string }[];
  ekgHistory?: { ts: number; summary: string; imageUrl?: string }[];
  treatmentHistory?: { ts: number; treatmentType: string; note?: string }[];
  findings?: string[];
  fallback: boolean;
  stageEnteredAt?: number;
  stageIds?: string[];
  orders?: {
    id: string;
    type: "vitals" | "ekg" | "labs" | "imaging";
    status: "pending" | "complete";
    result?: import("../messageTypes").OrderResult;
    completedAt?: number;
  }[];
  budget?: {
    usdEstimate?: number;
    voiceSeconds?: number;
    throttled?: boolean;
    fallback?: boolean;
  };
};

export type CostSnapshot = {
  inputTokens: number;
  outputTokens: number;
  usdEstimate: number;
};
