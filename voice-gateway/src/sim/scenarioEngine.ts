import { ScenarioDef, ScenarioId, StageDef, StageTransition } from "./scenarioTypes";
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
    id: "exertional_chest_pain",
    version: "1.0.0",
    persona: "You are a teen with exertional chest pain and palpitations. Stay in character.",
    initialStage: "stage_1_baseline",
    stages: [
      {
        id: "stage_1_baseline",
        vitals: { hr: 88, bp: "110/70", spo2: 99 },
        allowedIntents: [
          "intent_updateVitals",
          "intent_revealFinding",
          "intent_setEmotion",
          "intent_advanceStage",
        ],
        transitions: [
          { to: "stage_2_exertion", when: { any: [{ action: "time_elapsed", seconds: 120 }] } },
        ],
      },
      {
        id: "stage_2_exertion",
        vitals: { hr: 125, bp: "104/64", spo2: 99 },
        allowedIntents: [
          "intent_updateVitals",
          "intent_revealFinding",
          "intent_setEmotion",
          "intent_advanceStage",
        ],
        transitions: [
          { to: "stage_3_recovery", when: { any: [{ action: "time_elapsed", seconds: 180 }] } },
        ],
      },
      {
        id: "stage_3_recovery",
        vitals: { hr: 96, bp: "110/70", spo2: 99 },
        allowedIntents: ["intent_updateVitals", "intent_setEmotion"],
      },
    ],
  },
  palpitations_svt: {
    id: "palpitations_svt",
    version: "1.0.0",
    persona: "You are a teen with recurrent palpitations. Stay in character.",
    initialStage: "stage_1_baseline",
    stages: [
      {
        id: "stage_1_baseline",
        vitals: { hr: 90, bp: "112/70", spo2: 99 },
        allowedIntents: [
          "intent_updateVitals",
          "intent_revealFinding",
          "intent_setEmotion",
          "intent_advanceStage",
        ],
        transitions: [
          { to: "stage_2_episode", when: { any: [{ action: "time_elapsed", seconds: 90 }] } },
        ],
      },
      {
        id: "stage_2_episode",
        vitals: { hr: 170, bp: "108/64", spo2: 98 },
        allowedIntents: [
          "intent_updateVitals",
          "intent_revealFinding",
          "intent_setEmotion",
          "intent_advanceStage",
        ],
        transitions: [
          { to: "stage_3_post_episode", when: { any: [{ action: "time_elapsed", seconds: 120 }] } },
        ],
      },
      {
        id: "stage_3_post_episode",
        vitals: { hr: 102, bp: "112/70", spo2: 99 },
        allowedIntents: ["intent_updateVitals", "intent_setEmotion"],
      },
    ],
  },
  myocarditis: {
    id: "myocarditis",
    version: "1.0.0",
    persona: "You are a pre-teen recovering from a viral illness, now with chest discomfort and fatigue. Stay in character.",
    initialStage: "stage_1_baseline",
    stages: [
      {
        id: "stage_1_baseline",
        vitals: { hr: 118, bp: "98/60", spo2: 97, temp: 38.1 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_setEmotion", "intent_advanceStage"],
        transitions: [
          { to: "stage_2_decomp", when: { any: [{ action: "time_elapsed", seconds: 180 }] } },
        ],
      },
      {
        id: "stage_2_decomp",
        vitals: { hr: 135, bp: "86/54", spo2: 95 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_setEmotion", "intent_advanceStage"],
        transitions: [
          { to: "stage_3_support", when: { any: [{ action: "time_elapsed", seconds: 240 }] } },
        ],
      },
      {
        id: "stage_3_support",
        vitals: { hr: 112, bp: "96/60", spo2: 96 },
        allowedIntents: ["intent_updateVitals", "intent_setEmotion"],
      },
    ],
  },
  exertional_syncope_hcm: {
    id: "exertional_syncope_hcm",
    version: "1.0.0",
    persona: "You are a teen with presyncope during intense exercise. Stay in character; short answers.",
    initialStage: "stage_1_baseline",
    stages: [
      {
        id: "stage_1_baseline",
        vitals: { hr: 92, bp: "110/68", spo2: 99 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_setEmotion", "intent_advanceStage"],
        transitions: [
          { to: "stage_2_exertion", when: { any: [{ action: "time_elapsed", seconds: 90 }] } },
        ],
      },
      {
        id: "stage_2_exertion",
        vitals: { hr: 130, bp: "104/62", spo2: 99 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_setEmotion", "intent_advanceStage"],
        transitions: [
          { to: "stage_3_presyncope", when: { any: [{ action: "time_elapsed", seconds: 90 }] } },
        ],
      },
      {
        id: "stage_3_presyncope",
        vitals: { hr: 140, bp: "88/50", spo2: 99 },
        allowedIntents: ["intent_updateVitals", "intent_setEmotion"],
      },
    ],
  },
  ductal_shock: {
    id: "ductal_shock",
    version: "1.0.0",
    persona: "You are an ill infant with poor perfusion; responses are limited to grunts/crying cues.",
    initialStage: "stage_1_shock",
    stages: [
      {
        id: "stage_1_shock",
        vitals: { hr: 188, bp: "62/38", spo2: 86 },
        allowedIntents: ["intent_updateVitals", "intent_advanceStage"],
        transitions: [
          { to: "stage_2_improving", when: { any: [{ action: "time_elapsed", seconds: 120 }] } },
        ],
      },
      {
        id: "stage_2_improving",
        vitals: { hr: 170, bp: "72/44", spo2: 90 },
        allowedIntents: ["intent_updateVitals", "intent_advanceStage"],
        transitions: [
          { to: "stage_3_stabilized", when: { any: [{ action: "time_elapsed", seconds: 180 }] } },
        ],
      },
      {
        id: "stage_3_stabilized",
        vitals: { hr: 150, bp: "78/48", spo2: 94 },
        allowedIntents: ["intent_updateVitals"],
      },
    ],
  },
  cyanotic_spell: {
    id: "cyanotic_spell",
    version: "1.0.0",
    persona: "You are a toddler with cyanotic episodes; often squats to feel better.",
    initialStage: "stage_1_baseline",
    stages: [
      {
        id: "stage_1_baseline",
        vitals: { hr: 110, bp: "92/58", spo2: 93 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_setEmotion", "intent_advanceStage"],
        transitions: [
          { to: "stage_2_spell", when: { any: [{ action: "time_elapsed", seconds: 120 }] } },
        ],
      },
      {
        id: "stage_2_spell",
        vitals: { hr: 150, bp: "88/54", spo2: 78 },
        allowedIntents: ["intent_updateVitals", "intent_setEmotion", "intent_advanceStage"],
        transitions: [
          { to: "stage_3_recovery", when: { any: [{ action: "time_elapsed", seconds: 120 }] } },
        ],
      },
      {
        id: "stage_3_recovery",
        vitals: { hr: 120, bp: "90/56", spo2: 88 },
        allowedIntents: ["intent_updateVitals", "intent_setEmotion"],
      },
    ],
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
      findings: [],
      stageEnteredAt: Date.now(),
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
      stageEnteredAt: Date.now(),
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
          stageEnteredAt: Date.now(),
        };
        diff = { stageId: nextStage.id, vitals: nextStage.vitals, stageEnteredAt: this.state.stageEnteredAt };
        events.push({ type: "scenario.stage.changed", payload: { to: nextStage.id } });
      }
    } else if (intent.type === "intent_revealFinding") {
      const findings = new Set(this.state.findings ?? []);
      if (intent.findingId) {
        findings.add(intent.findingId);
        const nextFindings = Array.from(findings);
        this.state = { ...this.state, findings: nextFindings };
        diff = { findings: nextFindings };
        events.push({ type: "scenario.finding.revealed", payload: { id: intent.findingId } });
      }
    }

    // Other intents currently produce only audit events.
    events.push({ type: "tool.intent.applied", payload: intent as any });
    if (Object.keys(diff).length > 0) {
      events.push({ type: "scenario.state.diff", payload: diff as any });
    }

    return { nextState: this.state, diff, events };
  }

  evaluateAutomaticTransitions(actions: string[] = [], nowMs = Date.now()): ApplyResult | null {
    const stage = this.getCurrentStage();
    if (!stage.transitions || stage.transitions.length === 0 || !this.state.stageEnteredAt) {
      return null;
    }
    const elapsedSec = (nowMs - this.state.stageEnteredAt) / 1000;
    const actionSet = new Set(actions);
    for (const transition of stage.transitions) {
      if (this.isTransitionSatisfied(transition.when, elapsedSec, actionSet)) {
        const toStage = this.getStageDef(transition.to);
        if (!toStage) continue;
        this.state = {
          ...this.state,
          stageId: toStage.id,
          vitals: toStage.vitals ?? this.state.vitals,
          stageEnteredAt: nowMs,
        };
        return {
          nextState: this.state,
          diff: { stageId: toStage.id, vitals: toStage.vitals, stageEnteredAt: nowMs },
          events: [
            { type: "scenario.transition", payload: { to: toStage.id } },
            { type: "scenario.state.diff", payload: { stageId: toStage.id, vitals: toStage.vitals } },
          ],
        };
      }
    }
    return null;
  }

  private isTransitionSatisfied(when: StageTransition["when"], elapsedSec: number, actions: Set<string>): boolean {
    const checkTrigger = (trigger: any): boolean => {
      if (trigger.action === "time_elapsed" && typeof trigger.seconds === "number") {
        return elapsedSec >= trigger.seconds;
      }
      if (typeof trigger.action === "string") {
        return actions.has(trigger.action);
      }
      return false;
    };

    if ("any" in when && Array.isArray((when as any).any)) {
      return (when as any).any.some((t: any) => checkTrigger(t));
    }
    if ("all" in when && Array.isArray((when as any).all)) {
      return (when as any).all.every((t: any) => checkTrigger(t));
    }
    return checkTrigger(when as any);
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
