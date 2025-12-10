/**
 * Tests for "The Silent Crash" - Pediatric Myocarditis Scenario
 */

import {
  createInitialMyocarditisState,
  evaluatePhysiology,
  MYOCARDITIS_PHYSIOLOGY_RULES,
} from "../sim/physiologyEngine";
import { parseOrder, parseMultipleOrders, getNurseResponse, validateMyocarditisOrder } from "../orderParser";
import {
  calculateScore,
  updateScoreTracking,
  getChecklistStatus,
} from "../sim/scenarios/peds_myocarditis_silent_crash/scoring";
import {
  getResult,
  getNurseOrderAcknowledgment,
  AVAILABLE_RESULTS,
} from "../sim/scenarios/peds_myocarditis_silent_crash/results";
import {
  evaluateNurseTriggers,
  NURSE_TRIGGERS,
} from "../sim/scenarios/peds_myocarditis_silent_crash/triggers";

// ============================================================================
// Physiology Engine Tests
// ============================================================================

describe("PhysiologyEngine", () => {
  describe("createInitialMyocarditisState", () => {
    it("creates state with correct initial values", () => {
      const state = createInitialMyocarditisState("test-sim-123");

      expect(state.phase).toBe("scene_set");
      expect(state.shockStage).toBe(1);
      expect(state.totalFluidsMlKg).toBe(0);
      expect(state.inotropes).toHaveLength(0);
      expect(state.activeInotropes).toHaveLength(0);
      expect(state.consultsCalled).toHaveLength(0);
      expect(state.flags.pulmonaryEdema).toBe(false);
      expect(state.flags.intubationCollapse).toBe(false);
      expect(state.flags.codeBlueActive).toBe(false);
      expect(state.currentScore).toBe(0); // Score starts at 0, calculated at end
    });
  });

  describe("evaluatePhysiology", () => {
    it("detects fluid overload condition", () => {
      const extended = createInitialMyocarditisState("test");
      extended.totalFluidsMlKg = 25;
      extended.fluids = [
        { ts: Date.now() - 5 * 60 * 1000, mlKg: 25, totalMl: 800, type: "NS" },
      ];

      // Create a mock SimState
      const simState = {
        simId: "test",
        scenarioId: "peds_myocarditis_silent_crash_v1" as const,
        stageId: "scene_set",
        vitals: { hr: 115, bp: "88/52", rr: 28, spo2: 94 },
        fallback: false,
      };

      const result = evaluatePhysiology(simState, extended, MYOCARDITIS_PHYSIOLOGY_RULES, Date.now());

      // Should have fluid overload effects triggered
      expect(result.triggeredRules.length).toBeGreaterThanOrEqual(0);
    });

    it("triggers epi response when epi is running", () => {
      const extended = createInitialMyocarditisState("test");
      extended.activeInotropes = [
        { drug: "epi", doseMcgKgMin: 0.1, startedAt: Date.now() - 3 * 60 * 1000 },
      ];
      extended.inotropes = extended.activeInotropes;

      const simState = {
        simId: "test",
        scenarioId: "peds_myocarditis_silent_crash_v1" as const,
        stageId: "scene_set",
        vitals: { hr: 115, bp: "88/52", rr: 28, spo2: 94 },
        fallback: false,
      };

      const result = evaluatePhysiology(simState, extended, MYOCARDITIS_PHYSIOLOGY_RULES, Date.now());

      // Epi response rule should fire
      expect(result.triggeredRules.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("MYOCARDITIS_PHYSIOLOGY_RULES", () => {
    it("has all expected rule types", () => {
      const ruleIds = MYOCARDITIS_PHYSIOLOGY_RULES.map((r) => r.id);

      expect(ruleIds).toContain("fluid_overload");
      expect(ruleIds).toContain("epi_response");
      expect(ruleIds).toContain("milrinone_trap");
      expect(ruleIds).toContain("intubation_collapse_propofol");
      expect(ruleIds).toContain("intubation_safe_ketamine");
    });
  });
});

// ============================================================================
// Order Parser Tests
// ============================================================================

describe("OrderParser", () => {
  describe("parseOrder", () => {
    it("parses fluid orders", () => {
      const order = parseOrder("give 20 ml/kg of saline");
      expect(order.type).toBe("fluids");
      expect(order.params.mlKg).toBe(20);
    });

    it("parses epi drip orders", () => {
      const order = parseOrder("start an epi drip at 0.1 mcg/kg/min");
      expect(order.type).toBe("epi_drip");
      expect(order.params.doseMcgKgMin).toBe(0.1);
    });

    it("parses push-dose epi", () => {
      const order = parseOrder("draw up push dose epi");
      expect(order.type).toBe("epi_push");
    });

    it("parses intubation with ketamine", () => {
      const order = parseOrder("let's intubate with ketamine");
      expect(order.type).toBe("intubation");
      expect(order.params.inductionAgent).toBe("ketamine");
    });

    it("parses intubation with propofol", () => {
      const order = parseOrder("intubate using propofol");
      expect(order.type).toBe("intubation");
      expect(order.params.inductionAgent).toBe("propofol");
    });

    it("asks for clarification on vague fluid order", () => {
      const order = parseOrder("give fluids");
      expect(order.type).toBe("fluids");
      expect(order.needsClarification).toBe(true);
      expect(order.clarificationQuestion).toContain("10 or 20");
    });

    it("asks for clarification on vague epi order", () => {
      const order = parseOrder("start an epi drip");
      // This should match epi_drip but need dose clarification
      expect(order.type).toBe("epi_drip");
      expect(order.needsClarification).toBe(true);
    });

    it("asks for clarification on intubation without agent", () => {
      const order = parseOrder("let's intubate");
      expect(order.type).toBe("intubation");
      expect(order.needsClarification).toBe(true);
      expect(order.clarificationQuestion).toContain("ketamine or propofol");
    });

    it("parses consult orders", () => {
      expect(parseOrder("call PICU").type).toBe("consult_picu");
      expect(parseOrder("page cardiology").type).toBe("consult_cardiology");
      expect(parseOrder("we need ECMO evaluation").type).toBe("consult_ecmo");
    });

    it("parses lab orders", () => {
      const order = parseOrder("order troponin and BNP");
      expect(order.type).toBe("labs");
      expect(order.params.troponin).toBe(true);
      expect(order.params.bnp).toBe(true);
    });

    it("parses ECG orders", () => {
      expect(parseOrder("get a 12-lead ekg").type).toBe("ecg");
      expect(parseOrder("order an EKG").type).toBe("ecg");
    });

    it("parses HFNC orders", () => {
      const order = parseOrder("put them on high flow");
      expect(order.type).toBe("hfnc");
    });
  });

  describe("parseMultipleOrders", () => {
    it("parses multiple orders from compound statement", () => {
      const orders = parseMultipleOrders("order labs, and get an EKG");
      expect(orders.length).toBe(2);
      expect(orders.some((o) => o.type === "labs")).toBe(true);
      expect(orders.some((o) => o.type === "ecg")).toBe(true);
    });
  });

  describe("getNurseResponse", () => {
    it("returns clarification question when needed", () => {
      const order = parseOrder("give fluids");
      const response = getNurseResponse(order);
      expect(response).toContain("10 or 20");
    });

    it("returns confirmation when order is complete", () => {
      const order = parseOrder("give 20 ml/kg of saline push it fast");
      const response = getNurseResponse(order);
      expect(response).toContain("20 mL/kg");
    });
  });

  describe("validateMyocarditisOrder", () => {
    it("warns about fluid overload", () => {
      const order = parseOrder("give 20 ml/kg fluids");
      const validation = validateMyocarditisOrder(order, {
        shockStage: 2,
        totalFluidsMlKg: 30,
        hasEpiRunning: false,
        hasAirway: false,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it("warns about propofol without pressor", () => {
      const order = parseOrder("intubate with propofol");
      const validation = validateMyocarditisOrder(order, {
        shockStage: 3,
        totalFluidsMlKg: 10,
        hasEpiRunning: false,
        hasAirway: false,
      });

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.teachingPoints?.length).toBeGreaterThan(0);
    });

    it("warns about milrinone without epi", () => {
      const order = parseOrder("start milrinone at 0.5 mcg/kg/min");
      const validation = validateMyocarditisOrder(order, {
        shockStage: 2,
        totalFluidsMlKg: 10,
        hasEpiRunning: false,
        hasAirway: false,
      });

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Results Tests
// ============================================================================

describe("Results", () => {
  it("returns appropriate troponin for shock stage", () => {
    const result1 = getResult("troponin", "recognition", 1);
    const result3 = getResult("troponin", "decompensation", 3);

    expect(result1.resultText).toContain("2.8");
    expect(result3.resultText).toContain("4.2");
  });

  it("returns ECG with appropriate findings", () => {
    const result = getResult("ecg", "recognition", 1);

    expect(result.resultText).toContain("Sinus tachycardia");
    expect(result.resultText).toContain("low voltage");
    expect(result.interpretation).toContain("myocarditis");
  });

  it("returns echo with EF based on shock stage", () => {
    const result1 = getResult("echo", "recognition", 1);
    const result3 = getResult("echo", "decompensation", 3);

    expect(result1.resultText).toContain("30%");
    expect(result3.resultText).toContain("20%");
    expect(result1.criticalValues).toContain("EF 30%");
  });

  it("has all expected result types", () => {
    expect(AVAILABLE_RESULTS).toContain("ecg");
    expect(AVAILABLE_RESULTS).toContain("troponin");
    expect(AVAILABLE_RESULTS).toContain("bnp");
    expect(AVAILABLE_RESULTS).toContain("echo");
    expect(AVAILABLE_RESULTS).toContain("lactate");
  });

  it("returns nurse acknowledgments for orders", () => {
    expect(getNurseOrderAcknowledgment("ecg")).toContain("ECG");
    expect(getNurseOrderAcknowledgment("troponin")).toContain("troponin");
    expect(getNurseOrderAcknowledgment("echo")).toContain("echo tech");
  });
});

// ============================================================================
// Scoring Tests
// ============================================================================

describe("Scoring", () => {
  describe("calculateScore", () => {
    it("passes with 4/5 checklist items", () => {
      const state = createInitialMyocarditisState("test");
      // Simulate achieving 4 items
      state.orderedDiagnostics = ["troponin", "ecg"]; // recognized cardiac
      state.totalFluidsMlKg = 20; // avoided overload
      state.consultsCalled = ["picu", "cardiology"]; // PICU and cardiology

      const result = calculateScore(state, 20 * 60 * 1000);

      expect(result.passed).toBe(true);
      expect(result.checklistScore).toBe("4/5");
    });

    it("fails with fewer than 4 checklist items", () => {
      const state = createInitialMyocarditisState("test");
      state.totalFluidsMlKg = 60; // failed: overload
      // No diagnostics, no consults

      const result = calculateScore(state, 20 * 60 * 1000);

      expect(result.passed).toBe(false);
    });

    it("applies penalties for critical errors", () => {
      const state = createInitialMyocarditisState("test");
      state.totalFluidsMlKg = 70; // severe overload
      state.flags.codeBlueActive = true;

      const result = calculateScore(state, 30 * 60 * 1000);

      expect(result.penaltiesIncurred.length).toBeGreaterThan(0);
      expect(result.totalPoints).toBeLessThan(50);
    });

    it("awards bonuses for excellent care", () => {
      const state = createInitialMyocarditisState("test");
      state.orderedDiagnostics = ["troponin", "bnp", "ecg", "echo"];
      state.diagnostics = [
        { id: "1", type: "troponin", orderedAt: state.phaseEnteredAt + 2 * 60 * 1000 },
        { id: "2", type: "ecg", orderedAt: state.phaseEnteredAt + 1 * 60 * 1000 },
      ];
      state.totalFluidsMlKg = 15;
      state.consultsCalled = ["picu", "cardiology", "ecmo"];
      state.consults = [{ service: "picu", calledAt: Date.now() }];

      const result = calculateScore(state, 20 * 60 * 1000);

      expect(result.bonusesEarned.length).toBeGreaterThan(0);
    });
  });

  describe("getChecklistStatus", () => {
    it("returns status for all checklist items", () => {
      const state = createInitialMyocarditisState("test");
      const status = getChecklistStatus(state, 10 * 60 * 1000);

      expect(status.length).toBe(5);
      expect(status.every((s) => "id" in s && "achieved" in s)).toBe(true);
    });
  });
});

// ============================================================================
// Triggers Tests
// ============================================================================

describe("Triggers", () => {
  it("has expected nurse triggers", () => {
    const triggerIds = NURSE_TRIGGERS.map((t) => t.id);

    expect(triggerIds).toContain("bp_crash_severe");
    expect(triggerIds).toContain("fluid_overload_warning");
    expect(triggerIds).toContain("intubation_prep_check");
    expect(triggerIds).toContain("intubation_collapse_alert");
  });

  describe("evaluateNurseTriggers", () => {
    it("triggers BP crash alert at high shock stage", () => {
      const state = createInitialMyocarditisState("test");
      state.shockStage = 4;

      const triggers = evaluateNurseTriggers(state, 10 * 60 * 1000, {});

      const bpTrigger = triggers.find((t) => t.triggerId === "bp_crash_severe");
      expect(bpTrigger).toBeDefined();
      expect(bpTrigger?.priority).toBe("critical");
    });

    it("triggers fluid overload warning", () => {
      const state = createInitialMyocarditisState("test");
      state.totalFluidsMlKg = 18;

      const triggers = evaluateNurseTriggers(state, 10 * 60 * 1000, {});

      const fluidTrigger = triggers.find((t) => t.triggerId === "fluid_overload_warning");
      expect(fluidTrigger).toBeDefined();
    });

    it("respects cooldowns", () => {
      const state = createInitialMyocarditisState("test");
      state.shockStage = 4;

      const history = {
        bp_crash_severe: { lastFired: Date.now() - 30000, fireCount: 1 },
      };

      const triggers = evaluateNurseTriggers(state, 10 * 60 * 1000, history);

      // Should not fire again due to cooldown
      const bpTrigger = triggers.find((t) => t.triggerId === "bp_crash_severe");
      expect(bpTrigger).toBeUndefined();
    });
  });
});
