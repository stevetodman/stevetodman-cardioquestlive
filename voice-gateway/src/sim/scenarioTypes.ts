export type ScenarioId = "syncope" | "exertional_chest_pain" | "palpitations_svt";

export type ActionTrigger =
  | { action: "asked_about_exertion" }
  | { action: "asked_family_history" }
  | { action: "stand_test" }
  | { action: "time_elapsed"; seconds: number };

export type StageTransition = {
  to: string;
  when: ActionTrigger | { any: ActionTrigger[] } | { all: ActionTrigger[] };
};

export type StageDef = {
  id: string;
  vitals: { hr: number; bp: string; rr?: number; spo2?: number; temp?: number };
  allowedIntents?: string[];
  allowedStages?: string[];
  reveals?: { id: string; trigger: "always" | "on_question"; text: string }[];
  transitions?: StageTransition[];
};

export type ScenarioDef = {
  id: ScenarioId;
  version: string;
  persona?: string;
  stages: StageDef[];
  initialStage: string;
};
