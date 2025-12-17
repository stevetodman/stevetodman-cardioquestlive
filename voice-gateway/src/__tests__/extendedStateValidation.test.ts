import {
  SVTExtendedStateSchema,
  MyocarditisExtendedStateSchema,
  validateSVTExtendedState,
  validateMyocarditisExtendedState,
  validateExtendedState,
  safeParseSVTState,
  safeParseMyocarditisState,
} from "../extendedStateValidators";
import type { SVTExtendedState, MyocarditisExtendedState } from "../sim/types";

// ============================================================================
// Test Fixtures
// ============================================================================

function createValidSVTState(): SVTExtendedState {
  const now = Date.now();
  return {
    phase: "svt_onset",
    phaseEnteredAt: now - 60000,
    stabilityLevel: 2,
    currentRhythm: "svt",
    converted: false,
    vagalAttempts: 1,
    vagalAttemptTs: now - 30000,
    adenosineDoses: [],
    totalAdenosineMg: 0,
    cardioversionAttempts: [],
    ivAccess: true,
    ivAccessTs: now - 45000,
    monitorOn: true,
    monitorOnTs: now - 55000,
    sedationGiven: false,
    ecgOrdered: true,
    ecgOrderedTs: now - 50000,
    diagnostics: [],
    orderedDiagnostics: ["ecg"],
    consults: [],
    consultsCalled: [],
    flags: {
      patientReassured: true,
      parentInformed: true,
      valsalvaExplained: true,
      reboundSVT: false,
      unsedatedCardioversion: false,
    },
    scenarioStartedAt: now - 120000,
    scenarioClockPaused: false,
    totalPausedMs: 0,
    ruleTriggers: [],
    pendingEffects: [],
    checklistCompleted: ["ecg_ordered", "vagal_attempted"],
    bonusesEarned: ["early_ecg"],
    penaltiesIncurred: [],
    currentScore: 70,
    timelineEvents: [
      { ts: now - 120000, type: "phase_change", description: "Scenario started" },
      { ts: now - 60000, type: "phase_change", description: "SVT onset" },
    ],
  };
}

function createValidMyocarditisState(): MyocarditisExtendedState {
  const now = Date.now();
  return {
    phase: "recognition",
    phaseEnteredAt: now - 120000,
    shockStage: 2,
    shockStageEnteredAt: now - 60000,
    scenarioStartedAt: now - 180000,
    scenarioClockPaused: false,
    totalPausedMs: 0,
    deteriorationRate: 1.0,
    fluids: [
      { ts: now - 90000, mlKg: 10, totalMl: 300, type: "NS" },
    ],
    totalFluidsMlKg: 10,
    inotropes: [],
    activeInotropes: [],
    ivAccess: { count: 1, locations: ["right_ac"] },
    monitorOn: true,
    defibPadsOn: false,
    diagnostics: [
      { id: "d1", type: "ecg", orderedAt: now - 150000, completedAt: now - 140000, result: "Sinus tach" },
    ],
    orderedDiagnostics: ["ecg"],
    consults: [],
    consultsCalled: [],
    flags: {
      pulmonaryEdema: false,
      intubationCollapse: false,
      codeBlueActive: false,
      stabilizing: false,
    },
    ruleTriggers: [],
    pendingEffects: [],
    checklistCompleted: ["recognized_cardiac"],
    bonusesEarned: ["early_ecg"],
    penaltiesIncurred: [],
    currentScore: 65,
    timelineEvents: [
      { ts: now - 180000, type: "phase_change", description: "Scenario started" },
    ],
  };
}

// ============================================================================
// SVT Validation Tests
// ============================================================================

describe("SVT Extended State Validation", () => {
  describe("SVTExtendedStateSchema", () => {
    it("validates correct SVT state", () => {
      const state = createValidSVTState();
      expect(() => SVTExtendedStateSchema.parse(state)).not.toThrow();
    });

    it("rejects invalid phase", () => {
      const state = { ...createValidSVTState(), phase: "invalid_phase" };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects invalid stability level", () => {
      const state = { ...createValidSVTState(), stabilityLevel: 5 };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects negative vagal attempts", () => {
      const state = { ...createValidSVTState(), vagalAttempts: -1 };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects vagal attempts > 10", () => {
      const state = { ...createValidSVTState(), vagalAttempts: 15 };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects invalid rhythm", () => {
      const state = { ...createValidSVTState(), currentRhythm: "vfib" };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects invalid conversion method", () => {
      const state = { ...createValidSVTState(), conversionMethod: "magic" };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("validates adenosine dose with correct structure", () => {
      const state = createValidSVTState();
      state.adenosineDoses = [
        {
          ts: Date.now() - 10000,
          doseMg: 6,
          doseMgKg: 0.1,
          doseNumber: 1,
          rapidPush: true,
          flushGiven: true,
        },
      ];
      state.totalAdenosineMg = 6;
      expect(() => SVTExtendedStateSchema.parse(state)).not.toThrow();
    });

    it("rejects adenosine dose with invalid dose number", () => {
      const state = createValidSVTState();
      state.adenosineDoses = [
        {
          ts: Date.now() - 10000,
          doseMg: 6,
          doseMgKg: 0.1,
          doseNumber: 3 as 1 | 2, // Invalid
          rapidPush: true,
          flushGiven: true,
        },
      ];
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects negative timestamp", () => {
      const state = { ...createValidSVTState(), scenarioStartedAt: -1 };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects negative totalPausedMs", () => {
      const state = { ...createValidSVTState(), totalPausedMs: -100 };
      expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
    });
  });

  describe("validateSVTExtendedState", () => {
    it("returns valid for correct state", () => {
      const result = validateSVTExtendedState(createValidSVTState());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns errors for invalid state", () => {
      const state = { ...createValidSVTState(), phase: "invalid" };
      const result = validateSVTExtendedState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("warns when conversionTs is before scenarioStartedAt", () => {
      const state = createValidSVTState();
      state.converted = true;
      state.conversionTs = state.scenarioStartedAt - 10000;
      state.conversionMethod = "vagal";
      const result = validateSVTExtendedState(state);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("conversionTs is before scenarioStartedAt");
    });

    it("warns when ecgOrderedTs is before scenarioStartedAt", () => {
      const state = createValidSVTState();
      state.ecgOrderedTs = state.scenarioStartedAt - 10000;
      const result = validateSVTExtendedState(state);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("ecgOrderedTs is before scenarioStartedAt");
    });

    it("warns when adenosine doses are out of order", () => {
      const state = createValidSVTState();
      const now = Date.now();
      state.adenosineDoses = [
        { ts: now - 10000, doseMg: 6, doseMgKg: 0.1, doseNumber: 1, rapidPush: true, flushGiven: true },
        { ts: now - 20000, doseMg: 12, doseMgKg: 0.2, doseNumber: 2, rapidPush: true, flushGiven: true }, // Earlier!
      ];
      const result = validateSVTExtendedState(state);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("timestamp is before"))).toBe(true);
    });
  });

  describe("safeParseSVTState", () => {
    it("returns data for valid state", () => {
      const result = safeParseSVTState(createValidSVTState());
      expect(result.data).not.toBeNull();
      expect(result.errors).toHaveLength(0);
    });

    it("returns null with errors for invalid state", () => {
      const result = safeParseSVTState({ phase: "invalid" });
      expect(result.data).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Myocarditis Validation Tests
// ============================================================================

describe("Myocarditis Extended State Validation", () => {
  describe("MyocarditisExtendedStateSchema", () => {
    it("validates correct myocarditis state", () => {
      const state = createValidMyocarditisState();
      expect(() => MyocarditisExtendedStateSchema.parse(state)).not.toThrow();
    });

    it("rejects invalid phase", () => {
      const state = { ...createValidMyocarditisState(), phase: "invalid_phase" };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects shock stage out of range", () => {
      const state = { ...createValidMyocarditisState(), shockStage: 10 };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects shock stage 0", () => {
      const state = { ...createValidMyocarditisState(), shockStage: 0 };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects invalid deterioration rate", () => {
      const state = { ...createValidMyocarditisState(), deteriorationRate: 3.0 };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("validates valid deterioration rates", () => {
      const rates = [0.5, 1.0, 2.0] as const;
      for (const rate of rates) {
        const state = { ...createValidMyocarditisState(), deteriorationRate: rate };
        expect(() => MyocarditisExtendedStateSchema.parse(state)).not.toThrow();
      }
    });

    it("validates fluid bolus with correct structure", () => {
      const state = createValidMyocarditisState();
      state.fluids = [
        { ts: Date.now() - 60000, mlKg: 20, totalMl: 600, type: "NS", rateMinutes: 20 },
      ];
      state.totalFluidsMlKg = 20;
      expect(() => MyocarditisExtendedStateSchema.parse(state)).not.toThrow();
    });

    it("rejects fluid with invalid type", () => {
      const state = createValidMyocarditisState();
      state.fluids = [
        { ts: Date.now() - 60000, mlKg: 20, totalMl: 600, type: "water" as "NS" },
      ];
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("validates inotrope infusion", () => {
      const state = createValidMyocarditisState();
      state.inotropes = [
        { drug: "epi", doseMcgKgMin: 0.1, startedAt: Date.now() - 30000 },
      ];
      state.activeInotropes = state.inotropes;
      expect(() => MyocarditisExtendedStateSchema.parse(state)).not.toThrow();
    });

    it("rejects invalid inotrope drug", () => {
      const state = createValidMyocarditisState();
      state.inotropes = [
        { drug: "aspirin" as "epi", doseMcgKgMin: 0.1, startedAt: Date.now() },
      ];
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("validates airway intervention", () => {
      const state = createValidMyocarditisState();
      state.airway = {
        type: "intubation",
        ts: Date.now() - 10000,
        details: {
          inductionAgent: "ketamine",
          peep: 8,
          fio2: 1.0,
          pressorReady: true,
        },
      };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).not.toThrow();
    });

    it("rejects invalid induction agent", () => {
      const state = createValidMyocarditisState();
      state.airway = {
        type: "intubation",
        ts: Date.now(),
        details: { inductionAgent: "morphine" as "ketamine" },
      };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects PEEP out of range", () => {
      const state = createValidMyocarditisState();
      state.airway = {
        type: "intubation",
        ts: Date.now(),
        details: { peep: 50 }, // Way too high
      };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });

    it("rejects FiO2 out of range", () => {
      const state = createValidMyocarditisState();
      state.airway = {
        type: "intubation",
        ts: Date.now(),
        details: { fio2: 1.5 }, // > 1.0
      };
      expect(() => MyocarditisExtendedStateSchema.parse(state)).toThrow();
    });
  });

  describe("validateMyocarditisExtendedState", () => {
    it("returns valid for correct state", () => {
      const result = validateMyocarditisExtendedState(createValidMyocarditisState());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns errors for invalid state", () => {
      const state = { ...createValidMyocarditisState(), phase: "invalid" };
      const result = validateMyocarditisExtendedState(state);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("warns when timeline events are out of order", () => {
      const state = createValidMyocarditisState();
      const now = Date.now();
      state.timelineEvents = [
        { ts: now - 60000, type: "phase_change", description: "First" },
        { ts: now - 120000, type: "phase_change", description: "Second (earlier!)" },
      ];
      const result = validateMyocarditisExtendedState(state);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("timestamp is before"))).toBe(true);
    });

    it("warns when shock stage is high for early phase", () => {
      const state = createValidMyocarditisState();
      state.phase = "scene_set";
      state.shockStage = 4;
      const result = validateMyocarditisExtendedState(state);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("Shock stage"))).toBe(true);
    });

    it("warns when totalFluidsMlKg doesn't match sum", () => {
      const state = createValidMyocarditisState();
      state.fluids = [
        { ts: Date.now() - 60000, mlKg: 10, totalMl: 300, type: "NS" },
        { ts: Date.now() - 30000, mlKg: 10, totalMl: 300, type: "NS" },
      ];
      state.totalFluidsMlKg = 50; // Wrong!
      const result = validateMyocarditisExtendedState(state);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes("totalFluidsMlKg"))).toBe(true);
    });
  });

  describe("safeParseMyocarditisState", () => {
    it("returns data for valid state", () => {
      const result = safeParseMyocarditisState(createValidMyocarditisState());
      expect(result.data).not.toBeNull();
      expect(result.errors).toHaveLength(0);
    });

    it("returns null with errors for invalid state", () => {
      const result = safeParseMyocarditisState({ phase: "invalid" });
      expect(result.data).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Generic validateExtendedState Tests
// ============================================================================

describe("validateExtendedState", () => {
  it("validates SVT state for teen_svt_complex_v1", () => {
    const result = validateExtendedState("teen_svt_complex_v1", createValidSVTState());
    expect(result.valid).toBe(true);
  });

  it("validates myocarditis state for peds_myocarditis_silent_crash_v1", () => {
    const result = validateExtendedState("peds_myocarditis_silent_crash_v1", createValidMyocarditisState());
    expect(result.valid).toBe(true);
  });

  it("returns valid for non-complex scenarios", () => {
    const result = validateExtendedState("syncope", {});
    expect(result.valid).toBe(true);
  });

  it("returns errors for wrong state type", () => {
    // Pass myocarditis state to SVT validator
    const result = validateExtendedState("teen_svt_complex_v1", createValidMyocarditisState());
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  it("handles empty arrays", () => {
    const state = createValidSVTState();
    state.adenosineDoses = [];
    state.cardioversionAttempts = [];
    state.diagnostics = [];
    state.timelineEvents = [];
    expect(() => SVTExtendedStateSchema.parse(state)).not.toThrow();
  });

  it("handles missing optional fields", () => {
    const state = createValidSVTState();
    delete (state as Record<string, unknown>).conversionMethod;
    delete (state as Record<string, unknown>).conversionTs;
    delete (state as Record<string, unknown>).pendingClarification;
    expect(() => SVTExtendedStateSchema.parse(state)).not.toThrow();
  });

  it("rejects null instead of undefined for optional fields", () => {
    const state = createValidSVTState();
    (state as Record<string, unknown>).conversionMethod = null;
    expect(() => SVTExtendedStateSchema.parse(state)).toThrow();
  });

  it("handles very large scores", () => {
    const state = createValidSVTState();
    state.currentScore = 999999;
    expect(() => SVTExtendedStateSchema.parse(state)).not.toThrow();
  });

  it("handles negative scores", () => {
    const state = createValidSVTState();
    state.currentScore = -50;
    expect(() => SVTExtendedStateSchema.parse(state)).not.toThrow();
  });

  it("handles timestamp at epoch", () => {
    const state = createValidSVTState();
    // Very old timestamp but still valid positive number
    state.scenarioStartedAt = 1;
    expect(() => SVTExtendedStateSchema.parse(state)).not.toThrow();
  });
});
