/**
 * Tests for pause-time accounting in scoring
 *
 * Ensures that time-based bonuses and penalties correctly account for
 * time spent paused, so users aren't penalized/rewarded incorrectly
 * when the scenario is paused.
 */

import { calculateScore, BONUS_ITEMS, PENALTY_ITEMS } from "../sim/scenarios/teen_svt_complex/scoring";
import type { SVTExtendedState } from "../sim/types";

function createBaseSVTState(overrides: Partial<SVTExtendedState> = {}): SVTExtendedState {
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
    ecgOrderedTs: now - 50000, // Will be overridden in tests
    diagnostics: [],
    orderedDiagnostics: ["ecg"],
    consults: [],
    consultsCalled: [],
    flags: {
      patientReassured: true,
      parentInformed: true,
      valsalvaExplained: false,
      reboundSVT: false,
      unsedatedCardioversion: false,
    },
    scenarioStartedAt: now - 120000,
    scenarioClockPaused: false,
    totalPausedMs: 0,
    ruleTriggers: [],
    pendingEffects: [],
    checklistCompleted: [],
    bonusesEarned: [],
    penaltiesIncurred: [],
    currentScore: 50,
    timelineEvents: [],
    ...overrides,
  };
}

describe("Pause Time Scoring", () => {
  describe("early_ecg bonus", () => {
    it("awards bonus when ECG ordered within 60s (no pauses)", () => {
      const scenarioStartedAt = Date.now() - 120000;
      const state = createBaseSVTState({
        scenarioStartedAt,
        ecgOrdered: true,
        ecgOrderedTs: scenarioStartedAt + 50000, // 50 seconds after start
        totalPausedMs: 0,
      });

      const result = calculateScore(state, 120000);
      const earlyEcgBonus = result.bonusesEarned.find((b) => b.item.id === "early_ecg");
      expect(earlyEcgBonus).toBeDefined();
      expect(earlyEcgBonus?.points).toBe(10);
    });

    it("awards bonus when wall-clock time is >60s but paused time brings it under", () => {
      const scenarioStartedAt = Date.now() - 120000;
      const state = createBaseSVTState({
        scenarioStartedAt,
        ecgOrdered: true,
        ecgOrderedTs: scenarioStartedAt + 90000, // 90 seconds wall-clock after start
        totalPausedMs: 35000, // 35 seconds paused → actual elapsed = 55s
      });

      const result = calculateScore(state, 120000);
      const earlyEcgBonus = result.bonusesEarned.find((b) => b.item.id === "early_ecg");
      expect(earlyEcgBonus).toBeDefined();
      expect(earlyEcgBonus?.points).toBe(10);
    });

    it("denies bonus when actual elapsed time is >60s", () => {
      const scenarioStartedAt = Date.now() - 120000;
      const state = createBaseSVTState({
        scenarioStartedAt,
        ecgOrdered: true,
        ecgOrderedTs: scenarioStartedAt + 90000, // 90 seconds wall-clock
        totalPausedMs: 20000, // 20 seconds paused → actual elapsed = 70s
      });

      const result = calculateScore(state, 120000);
      const earlyEcgBonus = result.bonusesEarned.find((b) => b.item.id === "early_ecg");
      expect(earlyEcgBonus).toBeUndefined();
    });

    it("denies bonus when no ECG ordered", () => {
      const state = createBaseSVTState({
        ecgOrdered: false,
        ecgOrderedTs: undefined,
      });

      const result = calculateScore(state, 120000);
      const earlyEcgBonus = result.bonusesEarned.find((b) => b.item.id === "early_ecg");
      expect(earlyEcgBonus).toBeUndefined();
    });

    it("handles edge case: exactly 60 seconds elapsed", () => {
      const scenarioStartedAt = Date.now() - 120000;
      const state = createBaseSVTState({
        scenarioStartedAt,
        ecgOrdered: true,
        ecgOrderedTs: scenarioStartedAt + 60000, // Exactly 60 seconds
        totalPausedMs: 0,
      });

      const result = calculateScore(state, 120000);
      const earlyEcgBonus = result.bonusesEarned.find((b) => b.item.id === "early_ecg");
      expect(earlyEcgBonus).toBeDefined();
    });

    it("handles edge case: large pause time", () => {
      const scenarioStartedAt = Date.now() - 600000; // 10 minutes ago
      const state = createBaseSVTState({
        scenarioStartedAt,
        ecgOrdered: true,
        ecgOrderedTs: scenarioStartedAt + 550000, // 9+ minutes wall-clock
        totalPausedMs: 500000, // 8+ minutes paused → actual elapsed = ~50s
      });

      const result = calculateScore(state, 600000);
      const earlyEcgBonus = result.bonusesEarned.find((b) => b.item.id === "early_ecg");
      expect(earlyEcgBonus).toBeDefined();
    });
  });

  describe("adenosine dose penalties", () => {
    it("applies moderate overdose penalty for 0.15 mg/kg", () => {
      const state = createBaseSVTState({
        adenosineDoses: [
          {
            ts: Date.now() - 10000,
            doseMg: 9,
            doseMgKg: 0.15, // Moderate overdose
            doseNumber: 1,
            rapidPush: true,
            flushGiven: true,
          },
        ],
        totalAdenosineMg: 9,
      });

      const result = calculateScore(state, 120000);
      const moderatePenalty = result.penaltiesIncurred.find(
        (p) => p.item.id === "adenosine_moderate_overdose"
      );
      expect(moderatePenalty).toBeDefined();
      expect(moderatePenalty?.points).toBe(-5);
    });

    it("applies severe overdose penalty for 0.30 mg/kg (not moderate)", () => {
      const state = createBaseSVTState({
        adenosineDoses: [
          {
            ts: Date.now() - 10000,
            doseMg: 18,
            doseMgKg: 0.30, // Severe overdose
            doseNumber: 1,
            rapidPush: true,
            flushGiven: true,
          },
        ],
        totalAdenosineMg: 18,
      });

      const result = calculateScore(state, 120000);

      // Should have severe penalty
      const severePenalty = result.penaltiesIncurred.find(
        (p) => p.item.id === "adenosine_overdose"
      );
      expect(severePenalty).toBeDefined();
      expect(severePenalty?.points).toBe(-15);

      // Should NOT have moderate penalty (severe takes precedence)
      const moderatePenalty = result.penaltiesIncurred.find(
        (p) => p.item.id === "adenosine_moderate_overdose"
      );
      expect(moderatePenalty).toBeUndefined();
    });

    it("applies underdose penalty for 0.04 mg/kg", () => {
      const state = createBaseSVTState({
        adenosineDoses: [
          {
            ts: Date.now() - 10000,
            doseMg: 2.4,
            doseMgKg: 0.04, // Underdose
            doseNumber: 1,
            rapidPush: true,
            flushGiven: true,
          },
        ],
        totalAdenosineMg: 2.4,
      });

      const result = calculateScore(state, 120000);
      const underdosePenalty = result.penaltiesIncurred.find(
        (p) => p.item.id === "adenosine_underdose"
      );
      expect(underdosePenalty).toBeDefined();
      expect(underdosePenalty?.points).toBe(-10);
    });

    it("applies no penalty for correct dose (0.10 mg/kg)", () => {
      const state = createBaseSVTState({
        adenosineDoses: [
          {
            ts: Date.now() - 10000,
            doseMg: 6,
            doseMgKg: 0.10, // Correct dose
            doseNumber: 1,
            rapidPush: true,
            flushGiven: true,
          },
        ],
        totalAdenosineMg: 6,
      });

      const result = calculateScore(state, 120000);

      // No dosing penalties
      const dosingPenalties = result.penaltiesIncurred.filter(
        (p) =>
          p.item.id === "adenosine_underdose" ||
          p.item.id === "adenosine_moderate_overdose" ||
          p.item.id === "adenosine_overdose"
      );
      expect(dosingPenalties).toHaveLength(0);
    });
  });

  describe("score calculation with pauses", () => {
    it("calculates correct total score with pause-adjusted bonuses", () => {
      const scenarioStartedAt = Date.now() - 180000;
      const state = createBaseSVTState({
        scenarioStartedAt,
        ecgOrdered: true,
        ecgOrderedTs: scenarioStartedAt + 90000, // 90s wall-clock
        totalPausedMs: 40000, // 40s paused → 50s actual elapsed (bonus!)
        converted: true,
        conversionMethod: "vagal",
        vagalAttempts: 1,
        monitorOn: true,
        flags: {
          patientReassured: true,
          parentInformed: true,
          valsalvaExplained: false,
          reboundSVT: false,
          unsedatedCardioversion: false,
        },
      });

      const result = calculateScore(state, 180000);

      // Should pass with good score due to vagal conversion and early ECG bonus
      expect(result.passed).toBe(true);
      expect(result.bonusesEarned.some((b) => b.item.id === "early_ecg")).toBe(true);
      expect(result.bonusesEarned.some((b) => b.item.id === "vagal_conversion")).toBe(true);
      expect(result.totalPoints).toBeGreaterThanOrEqual(80);
    });
  });
});

describe("BONUS_ITEMS and PENALTY_ITEMS", () => {
  it("has all expected bonus items defined", () => {
    const expectedBonuses = [
      "early_ecg",
      "first_dose_conversion",
      "vagal_conversion",
      "cardiology_consult",
      "proper_flush",
      "family_history_obtained",
      "sedation_before_cardioversion",
    ];

    for (const id of expectedBonuses) {
      expect(BONUS_ITEMS.find((b) => b.id === id)).toBeDefined();
    }
  });

  it("has all expected penalty items defined", () => {
    const expectedPenalties = [
      "adenosine_underdose",
      "adenosine_moderate_overdose", // New!
      "adenosine_overdose",
      "skipped_vagal_stable",
      "delayed_treatment",
      "unsedated_cardioversion",
      "patient_decompensated",
      "amiodarone_first_line",
    ];

    for (const id of expectedPenalties) {
      expect(PENALTY_ITEMS.find((p) => p.id === id)).toBeDefined();
    }
  });
});
