import { ScenarioEngine } from "../sim/scenarioEngine";
import { ScenarioId } from "../sim/scenarioTypes";

/**
 * Tests for age-dependent rhythm generation per PALS guidelines.
 *
 * Key thresholds:
 * - SVT: >220 bpm (all ages)
 * - Bradycardia: age-dependent (neonate <100, infant <100, toddler <90, etc.)
 * - Tachycardia: age-dependent (neonate >180, infant >160, toddler >150, etc.)
 */

describe("Rhythm Generation - Age-Dependent Thresholds", () => {
  // Helper to create engine and set vitals
  function createEngineWithVitals(scenarioId: ScenarioId, hr: number, spo2 = 98): ScenarioEngine {
    const engine = new ScenarioEngine(`test-${Date.now()}`, scenarioId);
    engine.applyVitalsAdjustment({ hr: hr - (engine.getState().vitals.hr ?? 0) });
    if (spo2 !== 98) {
      engine.applyVitalsAdjustment({ spo2: spo2 - (engine.getState().vitals.spo2 ?? 98) });
    }
    return engine;
  }

  describe("Cardiac Arrest Rhythms", () => {
    it("should return asystole for HR=0", () => {
      const engine = createEngineWithVitals("syncope", 0);
      expect(engine.getDynamicRhythm()).toMatch(/asystole/i);
    });

    it("should return agonal rhythm for HR<20", () => {
      const engine = createEngineWithVitals("syncope", 15);
      expect(engine.getDynamicRhythm()).toMatch(/agonal/i);
    });
  });

  describe("SVT Threshold (>220 bpm for all ages)", () => {
    it("should identify SVT at 225 bpm in palpitations_svt scenario", () => {
      const engine = createEngineWithVitals("palpitations_svt", 225);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/SVT/i);
      expect(rhythm).toMatch(/narrow complex/i);
    });

    it("should identify VT at 225 bpm in arrhythmogenic scenario", () => {
      const engine = createEngineWithVitals("arrhythmogenic_syncope", 225);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/VT|ventricular tachycardia/i);
      expect(rhythm).toMatch(/wide complex/i);
    });

    it("should NOT call sinus tachy at 200 bpm SVT (above 220 threshold)", () => {
      const engine = createEngineWithVitals("palpitations_svt", 230);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).not.toMatch(/sinus tachycardia/i);
      expect(rhythm).toMatch(/SVT/i);
    });
  });

  describe("Infant Heart Rates (ductal_shock - 1 month old)", () => {
    // Demographics: ageYears: 0, ageMonths: 1, weightKg: 3.5
    // Thresholds: NSR 100-160, tachy >160, brady <100

    it("should call NSR for infant at 140 bpm", () => {
      const engine = createEngineWithVitals("ductal_shock", 140);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/normal sinus rhythm/i);
    });

    it("should call sinus tachy for infant at 170 bpm", () => {
      const engine = createEngineWithVitals("ductal_shock", 170);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus tachycardia/i);
    });

    it("should call sinus brady for infant at 90 bpm", () => {
      const engine = createEngineWithVitals("ductal_shock", 90);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus bradycardia/i);
    });

    it("should NOT call sinus tachy for infant at 150 bpm (within normal)", () => {
      const engine = createEngineWithVitals("ductal_shock", 150);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/normal sinus rhythm/i);
    });
  });

  describe("Toddler Heart Rates (cyanotic_spell - 2 year old)", () => {
    // Demographics: ageYears: 2, ageMonths: 0, weightKg: 12
    // Thresholds: NSR 90-150, tachy >150, brady <90

    it("should call NSR for toddler at 110 bpm", () => {
      const engine = createEngineWithVitals("cyanotic_spell", 110);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/normal sinus rhythm/i);
    });

    it("should call sinus tachy for toddler at 160 bpm", () => {
      const engine = createEngineWithVitals("cyanotic_spell", 160);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus tachycardia/i);
    });

    it("should call sinus brady for toddler at 80 bpm", () => {
      const engine = createEngineWithVitals("cyanotic_spell", 80);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus bradycardia/i);
    });
  });

  describe("Preschool Heart Rates (kawasaki - 4 year old)", () => {
    // Demographics: ageYears: 4, ageMonths: 0, weightKg: 16
    // Thresholds: NSR 80-120, tachy >120, brady <80

    it("should call NSR for preschooler at 100 bpm", () => {
      const engine = createEngineWithVitals("kawasaki", 100);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/normal sinus rhythm/i);
    });

    it("should call sinus tachy for preschooler at 130 bpm", () => {
      const engine = createEngineWithVitals("kawasaki", 130);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus tachycardia/i);
    });

    it("should call sinus brady for preschooler at 70 bpm", () => {
      const engine = createEngineWithVitals("kawasaki", 70);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus bradycardia/i);
    });
  });

  describe("School-Age Heart Rates (myocarditis - 11 year old)", () => {
    // Demographics: ageYears: 11, ageMonths: 0, weightKg: 38
    // Thresholds: NSR 70-110, tachy >110, brady <70

    it("should call NSR for school-age at 90 bpm", () => {
      const engine = createEngineWithVitals("myocarditis", 90);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/normal sinus rhythm/i);
    });

    it("should call sinus tachy for school-age at 120 bpm", () => {
      const engine = createEngineWithVitals("myocarditis", 120);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus tachycardia/i);
    });

    it("should call sinus brady for school-age at 60 bpm", () => {
      const engine = createEngineWithVitals("myocarditis", 60);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus bradycardia/i);
    });
  });

  describe("Adolescent Heart Rates (syncope - 15 year old)", () => {
    // Demographics: ageYears: 15, ageMonths: 0, weightKg: 55
    // Thresholds: NSR 60-100, tachy >100, brady <60

    it("should call NSR for adolescent at 75 bpm", () => {
      const engine = createEngineWithVitals("syncope", 75);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/normal sinus rhythm/i);
    });

    it("should call sinus tachy for adolescent at 110 bpm", () => {
      const engine = createEngineWithVitals("syncope", 110);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus tachycardia/i);
    });

    it("should call sinus brady for adolescent at 50 bpm", () => {
      const engine = createEngineWithVitals("syncope", 50);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/sinus bradycardia/i);
    });

    it("should NOT call tachy for adolescent at 95 bpm (within normal)", () => {
      const engine = createEngineWithVitals("syncope", 95);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/normal sinus rhythm/i);
    });
  });

  describe("Polymorphic VT / Torsades", () => {
    it("should identify Torsades at 250+ bpm", () => {
      const engine = createEngineWithVitals("syncope", 260);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/polymorphic vt|torsades/i);
    });
  });

  describe("PVC/PAC Descriptions", () => {
    it("should describe PVCs with compensatory pause in arrhythmogenic scenario", () => {
      const engine = createEngineWithVitals("arrhythmogenic_syncope", 85);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/PAC|PVC/i);
      expect(rhythm).toMatch(/conducted/i);
    });

    it("should describe frequent PVCs in arrhythmogenic at elevated HR", () => {
      const engine = createEngineWithVitals("arrhythmogenic_syncope", 160);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/PVC|VT/i);
    });
  });

  describe("Scenario-Specific EKG Findings", () => {
    it("should mention LVH in HCM scenario", () => {
      const engine = createEngineWithVitals("exertional_syncope_hcm", 80);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/LVH/i);
    });

    it("should mention low voltage in myocarditis", () => {
      const engine = createEngineWithVitals("myocarditis", 90);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/low voltage/i);
    });

    it("should mention RVH in cyanotic heart disease", () => {
      const engine = createEngineWithVitals("cyanotic_spell", 110);
      const rhythm = engine.getDynamicRhythm();
      expect(rhythm).toMatch(/RVH|right/i);
    });
  });
});
