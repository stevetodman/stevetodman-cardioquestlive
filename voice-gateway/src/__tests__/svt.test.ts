/**
 * Tests for Teen SVT Complex Scenario
 * PALS SVT Algorithm: vagal → adenosine → cardioversion
 */

import {
  evaluatePhysiology,
  SVT_PHYSIOLOGY_RULES,
} from "../sim/physiologyEngine";
import { parseOrder, parseMultipleOrders, getNurseResponse } from "../orderParser";
import {
  calculateScore,
  updateScoreTracking,
  getChecklistStatus,
  CHECKLIST_ITEMS,
  BONUS_ITEMS,
  PENALTY_ITEMS,
} from "../sim/scenarios/teen_svt_complex/scoring";
import {
  getResult,
  getNurseOrderAcknowledgment,
  AVAILABLE_RESULTS,
} from "../sim/scenarios/teen_svt_complex/results";
import {
  evaluateNurseTriggers,
  evaluateParentTriggers,
  evaluatePatientTriggers,
  NURSE_TRIGGERS,
  PARENT_TRIGGERS,
  PATIENT_TRIGGERS,
  getNextTrigger,
} from "../sim/scenarios/teen_svt_complex/triggers";
import {
  svtComplexScenario,
  SVT_PHASES,
  SVT_CHARACTERS,
  SVT_SCORING_CONFIG,
  createInitialSVTState,
} from "../sim/scenarios/teen_svt_complex/definition";
import type { SVTExtendedState } from "../sim/types";

// ============================================================================
// SVT State Management Tests
// ============================================================================

describe("SVT State Management", () => {
  describe("createInitialSVTState", () => {
    it("creates state with correct initial values", () => {
      const state = createInitialSVTState(Date.now());

      expect(state.phase).toBe("presentation");
      expect(state.stabilityLevel).toBe(1);
      expect(state.currentRhythm).toBe("sinus");
      expect(state.converted).toBe(false);
      expect(state.vagalAttempts).toBe(0);
      expect(state.adenosineDoses).toHaveLength(0);
      expect(state.totalAdenosineMg).toBe(0);
      expect(state.cardioversionAttempts).toHaveLength(0);
      expect(state.ivAccess).toBe(false);
      expect(state.monitorOn).toBe(false);
      expect(state.sedationGiven).toBe(false);
      expect(state.ecgOrdered).toBe(false);
      expect(state.currentScore).toBe(50); // Start at base score
    });

    it("initializes with provided timestamp", () => {
      const ts = 1700000000000;
      const state = createInitialSVTState(ts);

      expect(state.scenarioStartedAt).toBe(ts);
      expect(state.phaseEnteredAt).toBe(ts);
    });
  });
});

// ============================================================================
// SVT Scenario Definition Tests
// ============================================================================

describe("SVT Scenario Definition", () => {
  describe("svtComplexScenario", () => {
    it("has correct scenario metadata", () => {
      expect(svtComplexScenario.id).toBe("teen_svt_complex_v1");
      expect(svtComplexScenario.scenarioType).toBe("complex");
      expect(svtComplexScenario.title).toBe("Teen SVT - PALS Algorithm");
      expect(svtComplexScenario.runtimeMinutes).toBe(15);
    });

    it("has correct patient demographics", () => {
      expect(svtComplexScenario.demographics.ageYears).toBe(14);
      expect(svtComplexScenario.demographics.weightKg).toBe(50);
      expect(svtComplexScenario.demographics.sex).toBe("female");
    });

    it("has all 6 phases defined", () => {
      expect(SVT_PHASES).toHaveLength(6);
      const phaseIds = SVT_PHASES.map((p) => p.id);
      expect(phaseIds).toContain("presentation");
      expect(phaseIds).toContain("svt_onset");
      expect(phaseIds).toContain("treatment_window");
      expect(phaseIds).toContain("cardioversion_decision");
      expect(phaseIds).toContain("decompensating");
      expect(phaseIds).toContain("converted");
    });

    it("has all 3 characters defined", () => {
      expect(SVT_CHARACTERS).toHaveLength(3);
      const roles = SVT_CHARACTERS.map((c) => c.role);
      expect(roles).toContain("patient");
      expect(roles).toContain("parent");
      expect(roles).toContain("nurse");
    });

    it("has correct vitals for presentation phase", () => {
      const presentationPhase = SVT_PHASES.find((p) => p.id === "presentation");
      expect(presentationPhase?.vitalsTarget.hr).toBe(90);
      expect(presentationPhase?.vitalsTarget.spo2).toBe(99);
      expect(presentationPhase?.stabilityRange).toEqual([1, 1]);
    });

    it("has correct vitals for SVT onset phase", () => {
      const svtPhase = SVT_PHASES.find((p) => p.id === "svt_onset");
      expect(svtPhase?.vitalsTarget.hr).toBe(220);
      expect(svtPhase?.stabilityRange).toEqual([1, 2]);
    });

    it("has correct vitals for decompensating phase", () => {
      const decompPhase = SVT_PHASES.find((p) => p.id === "decompensating");
      expect(decompPhase?.vitalsTarget.hr).toBe(250);
      expect(decompPhase?.vitalsTarget.spo2).toBe(92);
      expect(decompPhase?.stabilityRange).toEqual([3, 4]);
    });
  });
});

// ============================================================================
// Order Parser SVT-Specific Tests
// ============================================================================

describe("SVT Order Parsing", () => {
  describe("Vagal Maneuver Orders", () => {
    it("parses vagal maneuver order", () => {
      const order = parseOrder("try vagal maneuver");
      expect(order.type).toBe("vagal_maneuver");
    });

    it("parses valsalva order", () => {
      const order = parseOrder("do a valsalva");
      expect(order.type).toBe("vagal_maneuver");
      expect(order.params.method).toBe("valsalva");
    });

    it("parses ice to face order", () => {
      const order = parseOrder("try ice to the face");
      expect(order.type).toBe("vagal_maneuver");
      expect(order.params.method).toBe("ice_to_face");
    });

    it("parses modified valsalva order", () => {
      const order = parseOrder("let's try modified valsalva");
      expect(order.type).toBe("vagal_maneuver");
      expect(order.params.method).toBe("modified_valsalva");
    });

    it("parses bearing down order", () => {
      const order = parseOrder("have her bear down");
      expect(order.type).toBe("vagal_maneuver");
      expect(order.params.method).toBe("valsalva");
    });
  });

  describe("Adenosine Orders", () => {
    it("parses adenosine order", () => {
      const order = parseOrder("give adenosine");
      expect(order.type).toBe("adenosine");
    });

    it("parses adenosine with dose", () => {
      const order = parseOrder("give adenosine 5 mg");
      expect(order.type).toBe("adenosine");
      expect(order.params.doseMg).toBe(5);
    });

    it("parses second dose adenosine", () => {
      const order = parseOrder("give second dose adenosine");
      expect(order.type).toBe("adenosine");
      expect(order.params.isSecondDose).toBe(true);
    });

    it("parses push adenosine order", () => {
      const order = parseOrder("push adenosine rapid");
      expect(order.type).toBe("adenosine");
      expect(order.params.rapidPush).toBe(true);
    });
  });

  describe("Cardioversion Orders", () => {
    it("parses cardioversion order", () => {
      const order = parseOrder("let's cardiovert");
      expect(order.type).toBe("cardioversion");
    });

    it("parses cardioversion with joules", () => {
      const order = parseOrder("cardiovert at 50 joules");
      expect(order.type).toBe("cardioversion");
      expect(order.params.joules).toBe(50);
    });

    it("parses synchronized cardioversion", () => {
      const order = parseOrder("synchronized cardioversion");
      expect(order.type).toBe("cardioversion");
      expect(order.params.synchronized).toBe(true);
    });

    it("asks for clarification on cardioversion without joules", () => {
      const order = parseOrder("cardiovert");
      expect(order.type).toBe("cardioversion");
      expect(order.needsClarification).toBe(true);
    });
  });

  describe("Sedation Orders", () => {
    it("parses sedation order", () => {
      const order = parseOrder("give sedation");
      expect(order.type).toBe("sedation");
    });

    it("parses midazolam order", () => {
      const order = parseOrder("give midazolam for sedation");
      expect(order.type).toBe("sedation");
      expect(order.params.agent).toBe("midazolam");
    });

    it("parses ketamine order", () => {
      const order = parseOrder("give ketamine");
      expect(order.type).toBe("sedation");
      expect(order.params.agent).toBe("ketamine");
    });

    it("parses versed order (midazolam)", () => {
      const order = parseOrder("give versed");
      expect(order.type).toBe("sedation");
      expect(order.params.agent).toBe("midazolam");
    });
  });

  describe("Nurse Responses for SVT Orders", () => {
    it("responds appropriately to vagal maneuver", () => {
      const order = parseOrder("try valsalva");
      const response = getNurseResponse(order);
      expect(response).toContain("bear down");
    });

    it("responds appropriately to adenosine", () => {
      const order = parseOrder("give adenosine");
      const response = getNurseResponse(order);
      expect(response).toContain("0.1 mg/kg");
      expect(response).toContain("5 mg");
      expect(response).toContain("flush");
    });

    it("responds appropriately to cardioversion with joules", () => {
      const order = parseOrder("cardiovert at 50 J");
      const response = getNurseResponse(order);
      expect(response).toContain("50 J");
      expect(response).toContain("sedated");
    });

    it("asks about agent for sedation without specifying", () => {
      const order = parseOrder("sedate the patient");
      const response = getNurseResponse(order);
      // Response uses proper case "Midazolam"
      expect(response.toLowerCase()).toContain("midazolam");
      expect(response.toLowerCase()).toContain("ketamine");
    });
  });
});

// ============================================================================
// Scoring System Tests
// ============================================================================

describe("SVT Scoring System", () => {
  describe("Checklist Items", () => {
    it("has 5 checklist items", () => {
      expect(CHECKLIST_ITEMS).toHaveLength(5);
    });

    it("includes ECG ordered item", () => {
      const ecgItem = CHECKLIST_ITEMS.find((i) => i.id === "ecg_ordered");
      expect(ecgItem).toBeDefined();
      expect(ecgItem?.description).toContain("ECG");
    });

    it("includes vagal attempted item", () => {
      const vagalItem = CHECKLIST_ITEMS.find((i) => i.id === "vagal_attempted");
      expect(vagalItem).toBeDefined();
      expect(vagalItem?.description).toContain("vagal");
    });

    it("includes adenosine dose item", () => {
      const adenosineItem = CHECKLIST_ITEMS.find((i) => i.id === "adenosine_correct_dose");
      expect(adenosineItem).toBeDefined();
    });
  });

  describe("Bonus Items", () => {
    it("has bonus items for excellent performance", () => {
      expect(BONUS_ITEMS.length).toBeGreaterThan(0);
    });

    it("includes early ECG bonus", () => {
      const earlyEcgBonus = BONUS_ITEMS.find((b) => b.id === "early_ecg");
      expect(earlyEcgBonus).toBeDefined();
      expect(earlyEcgBonus?.points).toBe(10);
    });

    it("includes vagal conversion bonus", () => {
      const vagalBonus = BONUS_ITEMS.find((b) => b.id === "vagal_conversion");
      expect(vagalBonus).toBeDefined();
      expect(vagalBonus?.points).toBe(20);
    });
  });

  describe("Penalty Items", () => {
    it("has penalty items for mistakes", () => {
      expect(PENALTY_ITEMS.length).toBeGreaterThan(0);
    });

    it("includes unsedated cardioversion penalty", () => {
      const unsedatedPenalty = PENALTY_ITEMS.find((p) => p.id === "unsedated_cardioversion");
      expect(unsedatedPenalty).toBeDefined();
      expect(unsedatedPenalty?.points).toBe(-20);
    });

    it("includes delayed treatment penalty", () => {
      const delayedPenalty = PENALTY_ITEMS.find((p) => p.id === "delayed_treatment");
      expect(delayedPenalty).toBeDefined();
    });
  });

  describe("calculateScore", () => {
    it("calculates passing score when checklist items are achieved", () => {
      const state = createInitialSVTState(Date.now());
      // Set state so checklist items evaluate to true
      state.ecgOrdered = true;
      state.vagalAttempts = 1;
      state.monitorOn = true;
      state.flags.patientReassured = true;
      state.adenosineDoses.push({
        ts: Date.now(),
        doseMg: 5,
        doseMgKg: 0.1,
        doseNumber: 1,
        rapidPush: true,
        flushGiven: true,
      });

      const result = calculateScore(state, 300000); // 5 minutes elapsed in ms
      expect(result.passed).toBe(true);
    });

    it("calculates failing score when checklist items missing", () => {
      const state = createInitialSVTState(Date.now());
      // Only ECG ordered - not enough items
      state.ecgOrdered = true;

      const result = calculateScore(state, 300000);
      expect(result.passed).toBe(false);
    });

    it("adds bonus points for early ECG", () => {
      const state = createInitialSVTState(Date.now());
      state.ecgOrdered = true;
      state.ecgOrderedTs = state.scenarioStartedAt + 30000; // 30 seconds after start
      state.vagalAttempts = 1;
      state.monitorOn = true;
      state.flags.patientReassured = true;
      state.adenosineDoses.push({
        ts: Date.now(),
        doseMg: 5,
        doseMgKg: 0.1,
        doseNumber: 1,
        rapidPush: true,
        flushGiven: true,
      });

      const result = calculateScore(state, 300000);
      const earlyEcgBonus = result.bonusesEarned.find((b) => b.item.id === "early_ecg");
      expect(earlyEcgBonus).toBeDefined();
    });

    it("applies penalty for unsedated cardioversion", () => {
      const state = createInitialSVTState(Date.now());
      state.flags.unsedatedCardioversion = true;

      const result = calculateScore(state, 300000);
      const unsedatedPenalty = result.penaltiesIncurred.find((p) => p.item.id === "unsedated_cardioversion");
      expect(unsedatedPenalty).toBeDefined();
    });
  });

  describe("updateScoreTracking", () => {
    it("returns new bonuses when bonus conditions are met", () => {
      const state = createInitialSVTState(Date.now());
      state.ecgOrdered = true;
      state.ecgOrderedTs = state.scenarioStartedAt + 30000;

      const result = updateScoreTracking(state, 60000);
      expect(result.newBonuses).toContain("early_ecg");
    });
  });

  describe("getChecklistStatus", () => {
    it("returns status for all checklist items", () => {
      const state = createInitialSVTState(Date.now());
      state.ecgOrdered = true;
      state.vagalAttempts = 1;

      const status = getChecklistStatus(state, 60000);
      expect(status).toHaveLength(5);

      const ecgStatus = status.find((s) => s.id === "ecg_ordered");
      expect(ecgStatus?.achieved).toBe(true);
    });
  });
});

// ============================================================================
// Trigger System Tests
// ============================================================================

describe("SVT Trigger System", () => {
  describe("Nurse Triggers", () => {
    it("has all expected nurse triggers", () => {
      expect(NURSE_TRIGGERS.length).toBeGreaterThan(5);
    });

    it("has SVT recognition trigger", () => {
      const svtTrigger = NURSE_TRIGGERS.find((t) => t.id === "svt_recognition");
      expect(svtTrigger).toBeDefined();
    });

    it("has adenosine ready trigger", () => {
      const adenosineTrigger = NURSE_TRIGGERS.find((t) => t.id === "adenosine_ready");
      expect(adenosineTrigger).toBeDefined();
    });

    it("has decompensation alert trigger", () => {
      const decompTrigger = NURSE_TRIGGERS.find((t) => t.id === "decompensation_alert");
      expect(decompTrigger).toBeDefined();
    });
  });

  describe("Parent Triggers", () => {
    it("has parent triggers", () => {
      expect(PARENT_TRIGGERS.length).toBeGreaterThan(0);
    });

    it("has parent concern triggers", () => {
      // Check for any parent trigger related to concern or history
      const hasConcernTrigger = PARENT_TRIGGERS.some((t) =>
        t.line.toLowerCase().includes("heart") ||
        t.line.toLowerCase().includes("worried") ||
        t.line.toLowerCase().includes("happening")
      );
      expect(hasConcernTrigger).toBe(true);
    });
  });

  describe("Patient Triggers", () => {
    it("has patient triggers", () => {
      expect(PATIENT_TRIGGERS.length).toBeGreaterThan(0);
    });

    it("has patient symptom triggers", () => {
      // Check for patient triggers about symptoms
      const hasSymptomTrigger = PATIENT_TRIGGERS.some((t) =>
        t.line.toLowerCase().includes("heart") ||
        t.line.toLowerCase().includes("scared") ||
        t.line.toLowerCase().includes("racing")
      );
      expect(hasSymptomTrigger).toBe(true);
    });
  });

  describe("evaluateNurseTriggers", () => {
    it("triggers SVT recognition when in SVT onset phase", () => {
      const state = createInitialSVTState(Date.now());
      state.phase = "svt_onset";
      state.currentRhythm = "svt";
      const emptyHistory = {};

      const triggers = evaluateNurseTriggers(state, 30000, emptyHistory);
      const svtTrigger = triggers.find((t) => t.triggerId === "svt_recognition");
      expect(svtTrigger).toBeDefined();
    });

    it("triggers decompensation alert when stability drops", () => {
      const state = createInitialSVTState(Date.now());
      state.phase = "treatment_window";
      state.stabilityLevel = 3;
      state.currentRhythm = "svt";
      const emptyHistory = {};

      const triggers = evaluateNurseTriggers(state, 180000, emptyHistory);
      const decompTrigger = triggers.find((t) => t.triggerId === "decompensation_alert");
      expect(decompTrigger).toBeDefined();
    });
  });

  describe("getNextTrigger", () => {
    it("returns a trigger or null", () => {
      const state = createInitialSVTState(Date.now());
      state.phase = "svt_onset";
      state.currentRhythm = "svt";
      const emptyHistory = {};

      const trigger = getNextTrigger(state, 30000, emptyHistory);
      // getNextTrigger returns a trigger or null depending on conditions and random chance
      // We just verify the return type is correct
      if (trigger !== null) {
        expect(trigger.character).toBeDefined();
        expect(trigger.line).toBeDefined();
        expect(trigger.triggerId).toBeDefined();
      } else {
        expect(trigger).toBeNull();
      }
    });
  });
});

// ============================================================================
// Results System Tests
// ============================================================================

describe("SVT Results System", () => {
  describe("getResult", () => {
    it("returns normal ECG for presentation phase", () => {
      const result = getResult("ecg", "presentation", "sinus");
      expect(result).toBeDefined();
      expect(result.interpretation.toLowerCase()).toContain("sinus");
    });

    it("returns SVT ECG for svt_onset phase", () => {
      const result = getResult("ecg", "svt_onset", "svt");
      expect(result).toBeDefined();
      expect(result.interpretation.toLowerCase()).toContain("svt");
    });

    it("returns post-conversion ECG for converted phase", () => {
      const result = getResult("ecg", "converted", "sinus");
      expect(result).toBeDefined();
      expect(result.interpretation.toLowerCase()).toContain("sinus");
    });

    it("returns troponin results", () => {
      const result = getResult("troponin", "presentation");
      expect(result).toBeDefined();
      expect(result.resultText).toContain("Troponin");
    });
  });

  describe("AVAILABLE_RESULTS", () => {
    it("includes all expected result types", () => {
      expect(AVAILABLE_RESULTS).toContain("ecg");
      expect(AVAILABLE_RESULTS).toContain("cbc");
      expect(AVAILABLE_RESULTS).toContain("bmp");
      expect(AVAILABLE_RESULTS).toContain("troponin");
    });
  });

  describe("getNurseOrderAcknowledgment", () => {
    it("acknowledges ECG order", () => {
      const response = getNurseOrderAcknowledgment("ecg");
      expect(response).toContain("12-lead");
    });

    it("acknowledges labs order", () => {
      const response = getNurseOrderAcknowledgment("cbc");
      expect(response.toLowerCase()).toContain("sent");
    });
  });
});

// ============================================================================
// Physiology Rules Tests
// ============================================================================

describe("SVT Physiology Rules", () => {
  describe("SVT_PHYSIOLOGY_RULES", () => {
    it("has all expected SVT rules", () => {
      const ruleIds = SVT_PHYSIOLOGY_RULES.map((r) => r.id);

      expect(ruleIds).toContain("vagal_conversion");
      expect(ruleIds).toContain("adenosine_first_success");
      expect(ruleIds).toContain("adenosine_first_failure");
      expect(ruleIds).toContain("cardioversion_success");
      expect(ruleIds).toContain("cardioversion_unsedated");
      expect(ruleIds).toContain("stability_drift");
      expect(ruleIds).toContain("decompensation_severe");
    });

    it("has correct trigger conditions for vagal conversion", () => {
      const vagalRule = SVT_PHYSIOLOGY_RULES.find((r) => r.id === "vagal_conversion");
      expect(vagalRule).toBeDefined();
      expect(vagalRule?.conditions.some((c) => c.type === "vagal_attempted")).toBe(true);
    });

    it("has correct effects for cardioversion success", () => {
      const cardiovertRule = SVT_PHYSIOLOGY_RULES.find((r) => r.id === "cardioversion_success");
      expect(cardiovertRule).toBeDefined();
      expect(cardiovertRule?.effects.some((e) => e.type === "convert_rhythm")).toBe(true);
      expect(cardiovertRule?.effects.some((e) => e.type === "advance_svt_phase")).toBe(true);
    });

    it("has penalty flag for unsedated cardioversion", () => {
      const unsedatedRule = SVT_PHYSIOLOGY_RULES.find((r) => r.id === "cardioversion_unsedated");
      expect(unsedatedRule).toBeDefined();
      expect(unsedatedRule?.effects.some((e) => e.type === "set_flag")).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("SVT Scenario Integration", () => {
  it("scenario flows through all phases correctly", () => {
    // Start at presentation
    const state = createInitialSVTState(Date.now());
    expect(state.phase).toBe("presentation");

    // SVT onset
    state.phase = "svt_onset";
    state.currentRhythm = "svt";
    expect(state.phase).toBe("svt_onset");

    // Treatment attempted → treatment window
    state.phase = "treatment_window";
    state.vagalAttempts = 1;
    expect(state.vagalAttempts).toBe(1);

    // Adenosine given
    state.adenosineDoses.push({
      ts: Date.now(),
      doseMg: 5,
      doseMgKg: 0.1,
      doseNumber: 1,
      rapidPush: true,
      flushGiven: true,
    });
    state.totalAdenosineMg = 5;
    expect(state.adenosineDoses).toHaveLength(1);

    // Conversion
    state.phase = "converted";
    state.converted = true;
    state.currentRhythm = "sinus";
    expect(state.converted).toBe(true);
  });

  it("scoring integrates with state tracking", () => {
    const state = createInitialSVTState(Date.now());

    // Simulate proper PALS algorithm execution
    state.ecgOrdered = true;
    state.ecgOrderedTs = state.scenarioStartedAt + 30000;
    state.vagalAttempts = 1;
    state.vagalAttemptTs = state.scenarioStartedAt + 60000;
    state.monitorOn = true;
    state.monitorOnTs = state.scenarioStartedAt + 45000;
    state.adenosineDoses.push({
      ts: state.scenarioStartedAt + 90000,
      doseMg: 5,
      doseMgKg: 0.1,
      doseNumber: 1,
      rapidPush: true,
      flushGiven: true,
    });
    state.totalAdenosineMg = 5;
    state.converted = true;
    state.conversionMethod = "adenosine_first";
    state.flags.patientReassured = true;

    // Calculate final score
    const score = calculateScore(state, 300000);
    expect(score.passed).toBe(true);
  });

  it("proper PALS algorithm gives good score", () => {
    const state = createInitialSVTState(Date.now());

    // All checklist items completed via state
    state.ecgOrdered = true;
    state.vagalAttempts = 1;
    state.monitorOn = true;
    state.flags.patientReassured = true;
    state.adenosineDoses.push({
      ts: Date.now(),
      doseMg: 5,
      doseMgKg: 0.1,
      doseNumber: 1,
      rapidPush: true,
      flushGiven: true,
    });

    const score = calculateScore(state, 300000);
    expect(score.passed).toBe(true);
    expect(score.totalPoints).toBeGreaterThan(70);
  });

  it("skipping vagal maneuvers in stable patient incurs penalty", () => {
    const state = createInitialSVTState(Date.now());

    // Went straight to adenosine without vagal (stable patient)
    state.stabilityLevel = 1; // Stable
    state.vagalAttempts = 0;
    state.adenosineDoses.push({
      ts: Date.now(),
      doseMg: 5,
      doseMgKg: 0.1,
      doseNumber: 1,
      rapidPush: true,
      flushGiven: true,
    });

    const score = calculateScore(state, 300000);
    const skippedVagalPenalty = score.penaltiesIncurred.find((p) => p.item.id === "skipped_vagal_stable");
    expect(skippedVagalPenalty).toBeDefined();
  });

  it("unsedated cardioversion incurs major penalty", () => {
    const state = createInitialSVTState(Date.now());

    state.cardioversionAttempts.push({
      ts: Date.now(),
      joules: 50,
      joulesPerKg: 1,
      synchronized: true,
      sedated: false,
    });
    state.flags.unsedatedCardioversion = true;

    const score = calculateScore(state, 300000);
    const unsedatedPenalty = score.penaltiesIncurred.find((p) => p.item.id === "unsedated_cardioversion");
    expect(unsedatedPenalty).toBeDefined();
    expect(unsedatedPenalty?.points).toBe(-20);
  });
});
