import { ScenarioDef, ScenarioId, StageDef } from "./scenarioTypes";
import { SimState, ToolIntent, Vitals } from "./types";

const syncopeScenario: ScenarioDef = {
  id: "syncope",
  version: "1.0.0",
  persona: "You are a 15-year-old who gets lightheaded with exertion. Stay in character.",
  initialStage: "stage_1_baseline",
  stages: [
    {
      id: "stage_1_baseline",
      vitals: { hr: 92, bp: "112/68", spo2: 99 },
      allowedIntents: [
        "intent_updateVitals",
        "intent_revealFinding",
        "intent_setEmotion",
        "intent_advanceStage",
      ],
      transitions: [
        {
          to: "stage_2_worse",
          when: { any: [{ action: "asked_about_exertion" }, { action: "time_elapsed", seconds: 180 }] },
        },
      ],
    },
    {
      id: "stage_2_worse",
      vitals: { hr: 120, bp: "94/52", spo2: 98 },
      allowedIntents: [
        "intent_updateVitals",
        "intent_revealFinding",
        "intent_setEmotion",
        "intent_advanceStage",
      ],
      transitions: [
        {
          to: "stage_3_syncopal_event",
          when: { all: [{ action: "stand_test" }, { action: "time_elapsed", seconds: 30 }] },
        },
      ],
    },
    {
      id: "stage_3_syncopal_event",
      vitals: { hr: 130, bp: "88/48", spo2: 97 },
      allowedIntents: ["intent_updateVitals", "intent_setEmotion"],
    },
  ],
};

const scenarioMap: Record<ScenarioId, ScenarioDef> = {
  syncope: syncopeScenario,
  exertional_chest_pain: {
    ...syncopeScenario,
    id: "exertional_chest_pain",
    persona: "You are a teen with exertional chest pain and palpitations. Stay in character.",
  },
  palpitations_svt: {
    ...syncopeScenario,
    id: "palpitations_svt",
    persona: "You are a teen with recurrent palpitations. Stay in character.",
  },
};

export type ApplyResult = {
  nextState: SimState;
  diff: Partial<SimState>;
  events: { type: string; payload?: Record<string, unknown> }[];
};

export class ScenarioEngine {
  private scenario: ScenarioDef;
  private state: SimState;

  constructor(simId: string, scenarioId: ScenarioId) {
    this.scenario = scenarioMap[scenarioId] ?? syncopeScenario;
    const initialStage = this.scenario.stages.find((s) => s.id === this.scenario.initialStage) ?? this.scenario.stages[0];
    this.state = {
      simId,
      scenarioId: this.scenario.id,
      stageId: initialStage.id,
      vitals: initialStage.vitals,
      fallback: false,
    };
  }

  getState(): SimState {
    return this.state;
  }

  setFallback(fallback: boolean) {
    this.state = { ...this.state, fallback };
  }

  setStage(stageId: string): boolean {
    const nextStage = this.getStageDef(stageId);
    if (!nextStage) return false;
    this.state = {
      ...this.state,
      stageId: nextStage.id,
      vitals: nextStage.vitals ?? this.state.vitals,
    };
    return true;
  }

  applyIntent(intent: ToolIntent): ApplyResult {
    const events: { type: string; payload?: Record<string, unknown> }[] = [];
    let diff: Partial<SimState> = {};
    const stage = this.getCurrentStage();

    if (intent.type === "intent_updateVitals") {
      const nextVitals = this.applyVitalsDelta(this.state.vitals, intent.delta);
      if (nextVitals) {
        this.state = { ...this.state, vitals: nextVitals };
        diff = { vitals: nextVitals };
      }
    } else if (intent.type === "intent_advanceStage") {
      const nextStage = this.scenario.stages.find((s) => s.id === intent.stageId);
      if (nextStage) {
        this.state = {
          ...this.state,
          stageId: nextStage.id,
          vitals: nextStage.vitals ?? this.state.vitals,
        };
        diff = { stageId: nextStage.id, vitals: nextStage.vitals };
        events.push({ type: "scenario.stage.changed", payload: { to: nextStage.id } });
      }
    }

    // Other intents currently produce only audit events.
    events.push({ type: "tool.intent.applied", payload: intent as any });

    return { nextState: this.state, diff, events };
  }

  private getCurrentStage(): StageDef {
    return this.scenario.stages.find((s) => s.id === this.state.stageId) ?? this.scenario.stages[0];
  }

  getStageDef(stageId: string): StageDef | undefined {
    return this.scenario.stages.find((s) => s.id === stageId);
  }

  getStageIds(): string[] {
    return this.scenario.stages.map((s) => s.id);
  }

  private applyVitalsDelta(current: Vitals, delta: Partial<Vitals>): Vitals | null {
    const next: Vitals = { ...current };
    type NumericVitalKey = "hr" | "rr" | "spo2" | "temp";
    const numericKeys: NumericVitalKey[] = ["hr", "rr", "spo2", "temp"];
    for (const key of numericKeys) {
      const value = delta[key];
      if (typeof value !== "number") continue;
      const prev = typeof next[key] === "number" ? (next[key] as number) : 0;
      next[key] = prev + value;
    }
    return next;
  }
}
