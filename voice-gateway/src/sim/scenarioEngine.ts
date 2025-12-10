import { ScenarioDef, ScenarioId, StageDef, StageTransition } from "./scenarioTypes";
import { SimState, ToolIntent, Vitals, Interventions } from "./types";

const syncopeScenario: ScenarioDef = {
  id: "syncope",
  version: "1.0.0",
  persona: "You are a 15-year-old who gets lightheaded with exertion. Stay in character.",
  demographics: { ageYears: 15, weightKg: 55, sex: "male" },
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

// Placeholder for complex scenario - will be handled separately by ComplexScenarioEngine
const complexMyocarditisPlaceholder: ScenarioDef = {
  id: "peds_myocarditis_silent_crash_v1",
  version: "1.0.0",
  persona: "Complex scenario - handled by ComplexScenarioEngine",
  demographics: { ageYears: 10, weightKg: 32, sex: "male" },
  initialStage: "scene_set",
  stages: [{ id: "scene_set", vitals: { hr: 115, bp: "88/52", rr: 28, spo2: 94 } }],
};

const scenarioMap: Record<ScenarioId, ScenarioDef> = {
  syncope: syncopeScenario,
  peds_myocarditis_silent_crash_v1: complexMyocarditisPlaceholder,
  exertional_chest_pain: {
    id: "exertional_chest_pain",
    version: "1.0.0",
    persona: "You are a teen with exertional chest pain and palpitations. Stay in character.",
    demographics: { ageYears: 16, weightKg: 62, sex: "male" },
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
    demographics: { ageYears: 14, weightKg: 50, sex: "female" },
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
    demographics: { ageYears: 11, weightKg: 38, sex: "male" },
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
    demographics: { ageYears: 17, weightKg: 70, sex: "male" },
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
    demographics: { ageYears: 0, ageMonths: 1, weightKg: 3.5 },
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
    demographics: { ageYears: 2, weightKg: 12, sex: "male" },
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
  kawasaki: {
    id: "kawasaki",
    version: "1.0.0",
    persona: "You are a febrile preschooler with rash and red eyes. Irritable and tired.",
    demographics: { ageYears: 4, weightKg: 16, sex: "male" },
    initialStage: "stage_1_fever",
    stages: [
      {
        id: "stage_1_fever",
        vitals: { hr: 130, bp: "96/60", spo2: 98, temp: 39.2 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_advanceStage"],
        transitions: [{ to: "stage_2_incomplete", when: { any: [{ action: "time_elapsed", seconds: 180 }] } }],
      },
      {
        id: "stage_2_incomplete",
        vitals: { hr: 122, bp: "98/62", spo2: 98, temp: 38.4 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_advanceStage"],
      },
    ],
  },
  coarctation_shock: {
    id: "coarctation_shock",
    version: "1.0.0",
    persona: "You are a young infant in low-output shock; minimal verbal cues.",
    demographics: { ageYears: 0, ageMonths: 2, weightKg: 4.5 },
    initialStage: "stage_1_shock",
    stages: [
      {
        id: "stage_1_shock",
        vitals: { hr: 182, bp: "78/40", spo2: 88, rr: 48 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_advanceStage"],
        transitions: [{ to: "stage_2_after_bolus", when: { any: [{ action: "time_elapsed", seconds: 180 }] } }],
      },
      {
        id: "stage_2_after_bolus",
        vitals: { hr: 168, bp: "84/48", spo2: 90, rr: 42 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_advanceStage"],
      },
    ],
  },
  arrhythmogenic_syncope: {
    id: "arrhythmogenic_syncope",
    version: "1.0.0",
    persona: "You are a teen who collapsed during sports; short, anxious answers.",
    demographics: { ageYears: 15, weightKg: 58, sex: "male" },
    initialStage: "stage_1_baseline",
    stages: [
      {
        id: "stage_1_baseline",
        vitals: { hr: 96, bp: "110/68", spo2: 99 },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_advanceStage"],
        transitions: [{ to: "stage_2_irritable", when: { any: [{ action: "time_elapsed", seconds: 120 }] } }],
      },
      {
        id: "stage_2_irritable",
        vitals: { hr: 112, bp: "104/64", spo2: 99 },
        exam: { cardio: "Occasional irregular beats; no murmur", general: "Anxious" },
        allowedIntents: ["intent_updateVitals", "intent_revealFinding", "intent_advanceStage"],
        transitions: [{ to: "stage_3_vtach_risk", when: { any: [{ action: "time_elapsed", seconds: 120 }] } }],
      },
      {
        id: "stage_3_vtach_risk",
        vitals: { hr: 140, bp: "92/58", spo2: 98 },
        rhythm: "Possible VT runs",
        allowedIntents: ["intent_updateVitals", "intent_setEmotion"],
      },
    ],
  },
};

const examTemplates: Record<
  ScenarioId,
  {
    baseline: StageDef["exam"];
    decomp?: StageDef["exam"];
    spell?: StageDef["exam"];
    heartAudioUrl?: string;
    lungAudioUrl?: string;
  }
> = {
  syncope: {
    baseline: {
      general: "Well-appearing, oriented.",
      cardio: "Regular rhythm, no loud murmurs.",
      lungs: "Clear to auscultation.",
      perfusion: "Warm, good pulses, no edema.",
      neuro: "Normal speech, intact strength.",
    },
    decomp: {
      general: "Dizzy and pale on standing.",
      cardio: "Tachycardic, otherwise normal heart sounds.",
      lungs: "Clear.",
      perfusion: "Mildly cool, delayed cap refill.",
      neuro: "Lightheaded, near-syncope.",
    },
  },
  exertional_chest_pain: {
    baseline: {
      general: "Well-appearing teen, mild discomfort.",
      cardio: "Regular rhythm, possible soft SEM LSB.",
      lungs: "Clear bilaterally.",
      perfusion: "Warm extremities, brisk cap refill.",
      neuro: "Alert, answers appropriately.",
    },
    decomp: {
      general: "Uncomfortable after exertion.",
      cardio: "Tachycardic, no rub, no JVD.",
      lungs: "Clear.",
      perfusion: "Warm but anxious.",
      neuro: "Anxious, oriented.",
    },
  },
  palpitations_svt: {
    baseline: {
      general: "Comfortable between episodes.",
      cardio: "Regular rhythm, no murmurs at rest.",
      lungs: "Clear.",
      perfusion: "Warm, normal pulses.",
      neuro: "Alert, no focal deficits.",
    },
    decomp: {
      general: "Anxious during tachycardia.",
      cardio: "Rapid regular pulse, no gallop.",
      lungs: "Clear.",
      perfusion: "Warm, slightly diaphoretic.",
      neuro: "Alert, follows commands.",
    },
  },
  myocarditis: {
    baseline: {
      general: "Tired, low energy.",
      cardio: "Tachycardic, possible S3/rub.",
      lungs: "Mild crackles bases.",
      perfusion: "Cool extremities, delayed cap refill.",
      neuro: "Sleepy but oriented.",
    },
    decomp: {
      general: "Ill-appearing, tachypneic.",
      cardio: "Tachycardic with gallop.",
      lungs: "Bibasilar crackles.",
      perfusion: "Cool, weak pulses.",
      neuro: "Lethargic but arousable.",
    },
  },
  exertional_syncope_hcm: {
    baseline: {
      general: "Well-appearing athlete.",
      cardio: "Harsh SEM LLSB increases with Valsalva/standing.",
      lungs: "Clear.",
      perfusion: "Warm, strong pulses.",
      neuro: "Alert.",
    },
    decomp: {
      general: "Lightheaded post-exertion.",
      cardio: "Tachycardic, murmur more pronounced standing.",
      lungs: "Clear.",
      perfusion: "Warm, cap refill slightly delayed.",
      neuro: "Dizzy when upright.",
    },
  },
  ductal_shock: {
    baseline: {
      general: "Ill, irritable infant.",
      cardio: "Tachycardic, possible gallop.",
      lungs: "Mild retractions, coarse breath sounds.",
      perfusion: "Cool extremities, weak pulses, hepatomegaly.",
      neuro: "Irritable, hypotonic when tired.",
    },
    decomp: {
      general: "Lethargic, mottled.",
      cardio: "Severe tachycardia, weak heart sounds.",
      lungs: "Crackles, increased work of breathing.",
      perfusion: "Poor pulses, delayed cap refill.",
      neuro: "Lethargic.",
    },
  },
  cyanotic_spell: {
    baseline: {
      general: "Quiet toddler, mildly cyanotic lips.",
      cardio: "Soft systolic murmur LUSB.",
      lungs: "Clear.",
      perfusion: "Warm, slight clubbing.",
      neuro: "Alert, playful.",
    },
    spell: {
      general: "Irritable, squatting, cyanotic.",
      cardio: "Tachycardic, murmur louder.",
      lungs: "Clear.",
      perfusion: "Cool extremities, delayed cap refill.",
      neuro: "Fussy but alert.",
    },
  },
  kawasaki: {
    baseline: {
      general: "Febrile, irritable preschooler.",
      cardio: "Tachycardic, no murmur.",
      lungs: "Clear.",
      perfusion: "Warm, swollen hands/feet.",
      neuro: "Irritable but alert.",
    },
    decomp: {
      general: "Less febrile, still irritable.",
      cardio: "Tachycardic, no murmur.",
      lungs: "Clear.",
      perfusion: "Warm.",
    },
    heartAudioUrl: "/audio/heart/pediatric-tachy.mp3",
    lungAudioUrl: "/audio/lung/clear-child.mp3",
  },
  coarctation_shock: {
    baseline: {
      general: "Ill infant, cool legs.",
      cardio: "Tachycardic; weak femoral pulses.",
      lungs: "Tachypneic, coarse sounds.",
      perfusion: "Delayed cap refill lower extremities.",
    },
    decomp: {
      general: "Slightly improved alertness after fluids.",
      cardio: "Femoral pulses weak; upper stronger.",
      lungs: "Tachypnea improving.",
      perfusion: "Arms warm, legs cooler.",
    },
    heartAudioUrl: "/audio/heart/infant-murmur.mp3",
    lungAudioUrl: "/audio/lung/coarse.mp3",
  },
  arrhythmogenic_syncope: {
    baseline: {
      general: "Anxious teen, otherwise stable.",
      cardio: "Occasional irregular beats; no murmur.",
      lungs: "Clear.",
      perfusion: "Warm, strong pulses.",
    },
    decomp: {
      general: "More anxious, lightheaded.",
      cardio: "Frequent irregular beats.",
      lungs: "Clear.",
      perfusion: "Warm.",
    },
    heartAudioUrl: "/audio/heart/irregular-teen.mp3",
    lungAudioUrl: "/audio/lung/clear-teen.mp3",
  },
  // Complex scenario - exam findings are phase-based and handled by ComplexScenarioEngine
  peds_myocarditis_silent_crash_v1: {
    baseline: {
      general: "Tired-appearing 10-year-old, mildly tachypneic.",
      cardio: "Tachycardic, gallop rhythm, possible friction rub.",
      lungs: "Bibasilar crackles.",
      perfusion: "Cool extremities, delayed cap refill 3-4s.",
      neuro: "Sleepy but oriented, answers appropriately.",
    },
    decomp: {
      general: "Ill-appearing, diaphoretic, increased work of breathing.",
      cardio: "Tachycardic with S3 gallop, weak pulses.",
      lungs: "Diffuse crackles, subcostal retractions.",
      perfusion: "Mottled, cap refill 5s, thready pulses.",
      neuro: "Lethargic, slow to respond.",
    },
  },
};

const rhythmTemplates: Record<
  ScenarioId,
  { baseline: string; decomp?: string; episode?: string; spell?: string }
> = {
  syncope: {
    baseline: "Sinus 90s, normal intervals",
    decomp: "Sinus tachy 120s, borderline QTc",
  },
  exertional_chest_pain: {
    baseline: "Sinus 80-90s, nonspecific ST/T",
    decomp: "Sinus tachy 110-120s, nonspecific changes",
  },
  palpitations_svt: {
    baseline: "Sinus 90s at rest",
    episode: "Narrow regular tachycardia ~180",
  },
  myocarditis: {
    baseline: "Sinus tachy 120s, low voltage, diffuse ST/T changes",
    decomp: "Sinus tachy 130s, low voltage with ST depressions",
  },
  exertional_syncope_hcm: {
    baseline: "Sinus 90s, LVH with deep Qs",
    decomp: "Sinus 110s, LVH with repol changes",
  },
  ductal_shock: {
    baseline: "Sinus tachy 180s, possible RV strain",
    decomp: "Sinus tachy 190s, low amplitude complexes",
  },
  cyanotic_spell: {
    baseline: "Sinus 100s, RVH/right axis",
    spell: "Sinus 150s, RV strain pattern",
  },
  kawasaki: {
    baseline: "Sinus tachy due to fever",
    decomp: "Sinus tachy, no ischemic changes expected",
  },
  coarctation_shock: {
    baseline: "Sinus tachy 180s, possible RV strain",
    decomp: "Sinus tachy 170s, low amplitude complexes",
  },
  arrhythmogenic_syncope: {
    baseline: "Sinus with occasional PVCs",
    decomp: "Sinus with runs of VT possible",
    episode: "Nonsustained VT",
  },
  // Complex scenario - rhythm is phase-dependent and handled by ComplexScenarioEngine
  peds_myocarditis_silent_crash_v1: {
    baseline: "Sinus tachycardia 115 bpm, low voltage QRS, diffuse ST-T wave abnormalities",
    decomp: "Sinus tachycardia 140 bpm, low voltage, ST depressions V4-V6, frequent PVCs",
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
  private lastTickMs: number;

  constructor(simId: string, scenarioId: ScenarioId) {
    this.scenario = scenarioMap[scenarioId] ?? syncopeScenario;
    const initialStage = this.scenario.stages.find((s) => s.id === this.scenario.initialStage) ?? this.scenario.stages[0];
    const now = Date.now();
    this.state = {
      simId,
      scenarioId: this.scenario.id,
      stageId: initialStage.id,
      vitals: initialStage.vitals,
      exam: this.getExam(initialStage.id, this.scenario.id),
      rhythmSummary: this.getRhythm(initialStage.id, this.scenario.id),
      fallback: false,
      telemetry: false,
      telemetryHistory: [],
      ekgHistory: [],
      findings: [],
      scenarioStartedAt: now,
      stageEnteredAt: now,
    };
    this.lastTickMs = now;
  }

  hydrate(partial: Partial<SimState> & { updatedAtMs?: number }) {
    const now = partial.updatedAtMs ?? Date.now();
    const stageId = partial.stageId && this.getStageDef(partial.stageId) ? partial.stageId : this.state.stageId;
    const stageDef = this.getStageDef(stageId) ?? this.getCurrentStage();
    this.state = {
      ...this.state,
      scenarioId: partial.scenarioId ?? this.state.scenarioId,
      stageId,
      vitals: partial.vitals ?? stageDef.vitals ?? this.state.vitals,
      exam: partial.exam ?? this.getExam(stageId, (partial.scenarioId as ScenarioId) ?? (this.state.scenarioId as ScenarioId)),
      rhythmSummary:
        partial.rhythmSummary ?? this.getRhythm(stageId, (partial.scenarioId as ScenarioId) ?? (this.state.scenarioId as ScenarioId)),
      telemetry: partial.telemetry ?? this.state.telemetry,
      telemetryHistory: partial.telemetryHistory ?? this.state.telemetryHistory,
      ekgHistory: partial.ekgHistory ?? this.state.ekgHistory,
      treatmentHistory: partial.treatmentHistory ?? this.state.treatmentHistory,
      findings: partial.findings ?? this.state.findings,
      orders: partial.orders ?? this.state.orders,
      scenarioStartedAt: partial.scenarioStartedAt ?? this.state.scenarioStartedAt ?? now,
      stageEnteredAt: partial.stageEnteredAt ?? this.state.stageEnteredAt ?? now,
      fallback: partial.fallback ?? this.state.fallback,
      budget: partial.budget ?? this.state.budget,
    };
    this.lastTickMs = now;
  }

  getState(): SimState {
    return this.state;
  }

  getElapsedSeconds(): number {
    const startedAt = this.state.scenarioStartedAt ?? Date.now();
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  getDemographics() {
    return this.scenario.demographics;
  }

  getPatientWeight(): number {
    return this.scenario.demographics.weightKg;
  }

  setFallback(fallback: boolean) {
    this.state = { ...this.state, fallback };
  }

  setTelemetry(on: boolean, rhythmSummary?: string) {
    this.state = {
      ...this.state,
      telemetry: on,
      rhythmSummary: rhythmSummary ?? this.state.rhythmSummary,
    };
    if (on) {
      const history = this.state.telemetryHistory ?? [];
      this.state = {
        ...this.state,
        telemetryHistory: [...history, { ts: Date.now(), rhythm: this.state.rhythmSummary }],
      };
    }
  }

  applyVitalsAdjustment(delta: Partial<Vitals>) {
    const nextVitals = this.applyVitalsDelta(this.state.vitals, delta);
    if (!nextVitals) return this.state;
    this.state = { ...this.state, vitals: nextVitals };
    return this.state;
  }

  setEkgHistory(history: { ts: number; summary: string; imageUrl?: string }[]) {
    this.state = { ...this.state, ekgHistory: history };
  }

  setTelemetryHistory(history: { ts: number; rhythm?: string; note?: string }[]) {
    this.state = { ...this.state, telemetryHistory: history };
  }

  setTreatmentHistory(history: { ts: number; treatmentType: string; note?: string }[]) {
    this.state = { ...this.state, treatmentHistory: history };
  }

  setInterventions(interventions: Interventions) {
    this.state = { ...this.state, interventions };
  }

  updateIntervention<K extends keyof Interventions>(key: K, value: Interventions[K]) {
    this.state = {
      ...this.state,
      interventions: { ...this.state.interventions, [key]: value },
    };
  }

  /**
   * Update the rhythm summary and log to telemetry history.
   * Used when treatments or events change the cardiac rhythm.
   */
  setRhythm(rhythmSummary: string, note?: string) {
    const history = this.state.telemetryHistory ?? [];
    this.state = {
      ...this.state,
      rhythmSummary,
      telemetryHistory: [...history, { ts: Date.now(), rhythm: rhythmSummary, note }],
    };
  }

  /**
   * Get age-dependent heart rate thresholds based on PALS guidelines.
   * Returns { nsrLow, nsrHigh, tachyThreshold, bradyThreshold, svtThreshold }
   */
  private getAgeBasedHRThresholds(): {
    nsrLow: number;
    nsrHigh: number;
    tachyThreshold: number;
    bradyThreshold: number;
    svtThreshold: number;
  } {
    const demo = this.scenario.demographics;
    const ageMonths = (demo.ageYears * 12) + (demo.ageMonths ?? 0);

    // PALS age-based heart rate ranges
    if (ageMonths < 1) {
      // Neonate (0-28 days): NSR 100-180, tachy >180, brady <100, SVT >220
      return { nsrLow: 100, nsrHigh: 180, tachyThreshold: 180, bradyThreshold: 100, svtThreshold: 220 };
    } else if (ageMonths < 12) {
      // Infant (1-12 months): NSR 100-160, tachy >160, brady <100, SVT >220
      return { nsrLow: 100, nsrHigh: 160, tachyThreshold: 160, bradyThreshold: 100, svtThreshold: 220 };
    } else if (ageMonths < 36) {
      // Toddler (1-3 years): NSR 90-150, tachy >150, brady <90, SVT >220
      return { nsrLow: 90, nsrHigh: 150, tachyThreshold: 150, bradyThreshold: 90, svtThreshold: 220 };
    } else if (ageMonths < 72) {
      // Preschool (3-6 years): NSR 80-120, tachy >120, brady <80, SVT >220
      return { nsrLow: 80, nsrHigh: 120, tachyThreshold: 120, bradyThreshold: 80, svtThreshold: 220 };
    } else if (ageMonths < 144) {
      // School-age (6-12 years): NSR 70-110, tachy >110, brady <70, SVT >220
      return { nsrLow: 70, nsrHigh: 110, tachyThreshold: 110, bradyThreshold: 70, svtThreshold: 220 };
    } else {
      // Adolescent (>12 years): NSR 60-100, tachy >100, brady <60, SVT >220
      return { nsrLow: 60, nsrHigh: 100, tachyThreshold: 100, bradyThreshold: 60, svtThreshold: 220 };
    }
  }

  /**
   * Get rhythm description based on heart rate and scenario context.
   * Uses age-dependent thresholds per PALS guidelines.
   * SVT threshold is >220 bpm regardless of age.
   */
  getDynamicRhythm(): string {
    const hr = this.state.vitals.hr ?? 80;
    const spo2 = this.state.vitals.spo2 ?? 98;
    const scenarioId = this.state.scenarioId as ScenarioId;
    const stageId = this.state.stageId;
    const thresholds = this.getAgeBasedHRThresholds();

    // Cardiac arrest states
    if (hr === 0) return "Asystole / PEA - no cardiac output";
    if (hr < 20) return "Agonal rhythm - impending arrest";

    // VF - chaotic, no discernible rate
    if (scenarioId === "arrhythmogenic_syncope" && hr >= 300) {
      return "Ventricular fibrillation - coarse";
    }

    // Polymorphic VT / Torsades (very fast, irregular VT)
    if (hr >= 250) {
      return `Polymorphic VT / Torsades de Pointes`;
    }

    // SVT (>220 bpm per PALS) - narrow complex, regular, no P waves
    if (hr > thresholds.svtThreshold) {
      if (scenarioId === "palpitations_svt") {
        return `SVT ${hr} bpm, narrow complex, regular, P waves absent`;
      }
      if (scenarioId === "arrhythmogenic_syncope") {
        return `Monomorphic VT ${hr} bpm, wide complex, AV dissociation`;
      }
      // Differentiate SVT vs sinus tachy in infants (can have very high sinus rates)
      if (scenarioId === "ductal_shock" || scenarioId === "coarctation_shock") {
        // In infants, SVT is typically >220 with NO rate variability
        return `SVT vs extreme sinus tachycardia ${hr} bpm - no beat-to-beat variability suggests SVT`;
      }
      return `Narrow complex tachycardia ${hr} bpm - SVT vs sinus tachycardia with aberrancy`;
    }

    // Ventricular tachycardia (wide complex, regular)
    if (scenarioId === "arrhythmogenic_syncope" && hr >= 150) {
      if (stageId.includes("episode") || stageId.includes("decomp")) {
        return `Monomorphic VT ${hr} bpm, wide complex, regular`;
      }
      // PVCs - can be conducted (wide) or may trigger compensatory pause
      return `Sinus rhythm ${hr} bpm with frequent PVCs (wide, compensatory pause)`;
    }

    // Sinus tachycardia (age-dependent threshold)
    if (hr > thresholds.tachyThreshold) {
      let base = `Sinus tachycardia ${hr} bpm`;
      // Add scenario-specific findings
      if (scenarioId === "myocarditis") return `${base}, low voltage QRS, diffuse ST-T changes`;
      if (scenarioId === "cyanotic_spell") return `${base}, RVH pattern, right axis`;
      if (scenarioId === "kawasaki") return `${base} (fever-related)`;
      if (scenarioId === "ductal_shock" || scenarioId === "coarctation_shock") return `${base}, RV strain pattern`;
      if (scenarioId === "exertional_syncope_hcm") return `${base}, LVH with repolarization changes`;
      if (spo2 < 90) return `${base}, hypoxia`;
      return base;
    }

    // Sinus bradycardia (age-dependent threshold)
    if (hr < thresholds.bradyThreshold) {
      if (hr < thresholds.bradyThreshold - 30) {
        return `Severe sinus bradycardia ${hr} bpm - consider junctional escape`;
      }
      return `Sinus bradycardia ${hr} bpm`;
    }

    // Normal sinus rhythm (within age-appropriate range)
    let nsr = `Normal sinus rhythm ${hr} bpm`;

    // Add scenario-specific baseline findings
    if (scenarioId === "syncope") return `${nsr}, normal intervals, no preexcitation`;
    if (scenarioId === "exertional_chest_pain") return `${nsr}, nonspecific ST-T changes`;
    if (scenarioId === "palpitations_svt") return `${nsr}, no delta wave, normal PR`;
    if (scenarioId === "myocarditis") return `${nsr}, low voltage, diffuse ST-T abnormalities`;
    if (scenarioId === "exertional_syncope_hcm") return `${nsr}, LVH voltage, deep Q waves V5-V6`;
    if (scenarioId === "arrhythmogenic_syncope") return `${nsr}, occasional PACs (conducted)`;
    if (scenarioId === "ductal_shock" || scenarioId === "coarctation_shock") return `${nsr}, RVH pattern`;
    if (scenarioId === "cyanotic_spell") return `${nsr}, RVH, right axis deviation`;
    if (scenarioId === "kawasaki") return `${nsr}, no ischemic changes`;

    return nsr;
  }

  setStage(stageId: string): boolean {
    const nextStage = this.getStageDef(stageId);
    if (!nextStage) return false;
    this.state = {
      ...this.state,
      stageId: nextStage.id,
      vitals: nextStage.vitals ?? this.state.vitals,
      exam: this.getExam(nextStage.id, this.state.scenarioId as ScenarioId),
      rhythmSummary: this.getRhythm(nextStage.id, this.state.scenarioId as ScenarioId),
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
        events.push({ type: "scenario.state.diff", payload: { vitals: nextVitals } });
      }
    } else if (intent.type === "intent_advanceStage") {
      const nextStage = this.scenario.stages.find((s) => s.id === intent.stageId);
      if (nextStage) {
        this.state = {
          ...this.state,
          stageId: nextStage.id,
          vitals: nextStage.vitals ?? this.state.vitals,
          exam: this.getExam(nextStage.id, this.state.scenarioId as ScenarioId),
          rhythmSummary: this.getRhythm(nextStage.id, this.state.scenarioId as ScenarioId),
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
          exam: this.getExam(toStage.id, this.state.scenarioId as ScenarioId),
          rhythmSummary: this.getRhythm(toStage.id, this.state.scenarioId as ScenarioId),
          stageEnteredAt: nowMs,
        };
        return {
          nextState: this.state,
          diff: { stageId: toStage.id, vitals: toStage.vitals, stageEnteredAt: nowMs },
          events: [
            { type: "scenario.transition", payload: { to: toStage.id } },
            { type: "scenario.state.diff", payload: { stageId: toStage.id, vitals: toStage.vitals, exam: this.state.exam } },
          ],
        };
      }
    }
    return null;
  }

  tick(nowMs = Date.now()): ApplyResult | null {
    const stage = this.getCurrentStage();
    let changed = false;
    const events: { type: string; payload?: Record<string, unknown> }[] = [];
    let diff: Partial<SimState> = {};
    const elapsedSec = (nowMs - this.lastTickMs) / 1000;
    this.lastTickMs = nowMs;

    // Apply drift if configured
    if (stage.drift && elapsedSec > 0 && this.state.vitals) {
      const nextVitals = { ...this.state.vitals };
      if (stage.drift.hrPerMin) {
        nextVitals.hr = Math.max(0, Math.round((nextVitals.hr ?? 0) + (stage.drift.hrPerMin / 60) * elapsedSec));
      }
      const parseBp = (bp: string | undefined) => {
        if (!bp) return { sbp: 0, dbp: 0 };
        const [s, d] = bp.split("/").map((n) => Number(n));
        return { sbp: s || 0, dbp: d || 0 };
      };
      const bpParsed = parseBp(nextVitals.bp as string | undefined);
      if (stage.drift.spo2PerMin) {
        const nextSpo2 = Math.max(50, Math.min(100, (nextVitals.spo2 ?? 100) + (stage.drift.spo2PerMin / 60) * elapsedSec));
        nextVitals.spo2 = Math.round(nextSpo2);
      }
      if (stage.drift.sbpPerMin || stage.drift.dbpPerMin) {
        const nextSbp = Math.max(40, Math.round(bpParsed.sbp + (stage.drift.sbpPerMin ?? 0) / 60 * elapsedSec));
        const nextDbp = Math.max(20, Math.round(bpParsed.dbp + (stage.drift.dbpPerMin ?? 0) / 60 * elapsedSec));
        nextVitals.bp = `${nextSbp}/${nextDbp}`;
      }
      this.state = { ...this.state, vitals: nextVitals };
      diff = { ...diff, vitals: nextVitals };
      changed = true;
    }

    const transition = this.evaluateAutomaticTransitions([], nowMs);
    if (transition) {
      changed = true;
      diff = { ...diff, ...transition.diff };
      events.push(...(transition.events ?? []));
    }

    if (!changed) return null;
    events.push({ type: "scenario.state.diff", payload: diff as any });
    return { nextState: this.state, diff, events };
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

  private getExam(stageId: string, scenarioId: ScenarioId) {
    const template = examTemplates[scenarioId] ?? examTemplates.syncope;
    const isDecomp = stageId.includes("decomp") || stageId.includes("worse") || stageId.includes("support") || stageId.includes("episode");
    const isSpell = stageId.includes("spell");
    const baseExam =
      (isSpell && template.spell) ? template.spell : (isDecomp && template.decomp) ? template.decomp : template.baseline;
    const merged = { ...baseExam } as StageDef["exam"] & { heartAudioUrl?: string; lungAudioUrl?: string };
    if (template.heartAudioUrl && !merged.heartAudioUrl) merged.heartAudioUrl = template.heartAudioUrl;
    if (template.lungAudioUrl && !merged.lungAudioUrl) merged.lungAudioUrl = template.lungAudioUrl;
    return merged;
  }

  private getRhythm(stageId: string, scenarioId: ScenarioId) {
    const template = rhythmTemplates[scenarioId] ?? rhythmTemplates.syncope;
    const isDecomp = stageId.includes("decomp") || stageId.includes("worse") || stageId.includes("support") || stageId.includes("episode");
    const isSpell = stageId.includes("spell");
    if (isSpell && template.spell) return template.spell;
    if (isDecomp && template.decomp) return template.decomp;
    if (stageId.includes("episode") && template.episode) return template.episode;
    return template.baseline;
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
    // Allow sbp/dbp per minute deltas for fluids/meds
    if (typeof (delta as any).sbpPerMin === "number" || typeof (delta as any).dbpPerMin === "number") {
      const bp = next.bp || current.bp;
      const [sRaw, dRaw] = (bp ?? "0/0").split("/").map((n) => Number(n));
      const sbp = sRaw + ((delta as any).sbpPerMin ?? 0) / 60;
      const dbp = dRaw + ((delta as any).dbpPerMin ?? 0) / 60;
      next.bp = `${Math.round(sbp)}/${Math.round(dbp)}`;
    }
    // Clamp SpO2 to physiological range
    if (typeof next.spo2 === "number") {
      next.spo2 = Math.min(100, Math.max(50, next.spo2));
    }
    return next;
  }
}
