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
  fallback: boolean;
};

export type CostSnapshot = {
  inputTokens: number;
  outputTokens: number;
  usdEstimate: number;
};
