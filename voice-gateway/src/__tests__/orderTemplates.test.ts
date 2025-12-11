/**
 * Tests for orderTemplates.ts
 * Verifies scenario-specific order results (EKG, vitals, labs, imaging)
 */

import { getOrderResultTemplate } from "../orderTemplates";

describe("orderTemplates", () => {
  describe("teen_svt_complex_v1", () => {
    it("returns SVT vitals during tachycardia", () => {
      const result = getOrderResultTemplate("vitals", "teen_svt_complex_v1", "svt_onset");

      expect(result.type).toBe("vitals");
      expect(result.hr).toBe(218);
      expect(result.bp).toBe("98/62");
    });

    it("returns normal vitals after conversion", () => {
      const result = getOrderResultTemplate("vitals", "teen_svt_complex_v1", "converted");

      expect(result.hr).toBe(92);
      expect(result.spo2).toBe(99);
    });

    it("returns SVT EKG during tachycardia", () => {
      const result = getOrderResultTemplate("ekg", "teen_svt_complex_v1", "treatment_window");

      expect(result.type).toBe("ekg");
      expect(result.summary).toContain("220 bpm");
      expect(result.summary).toContain("Narrow regular tachycardia");
      expect(result.meta?.rate).toContain("220 bpm");
      expect(result.abnormal).toContain("Narrow complex tachycardia");
      expect(result.nextAction).toContain("vagal");
    });

    it("returns post-conversion EKG after sinus rhythm restored", () => {
      const result = getOrderResultTemplate("ekg", "teen_svt_complex_v1", "converted");

      expect(result.summary).toContain("Sinus rhythm");
      expect(result.summary).toContain("90 bpm");
      expect(result.imageUrl).toBe("/images/ekg/ekg-baseline.png");
      expect(result.abnormal).toBeUndefined();
    });

    it("returns appropriate labs for SVT", () => {
      const result = getOrderResultTemplate("labs", "teen_svt_complex_v1", "svt_onset");

      expect(result.summary).toContain("CBC normal");
      expect(result.summary).toContain("electrolytes normal");
      expect(result.summary).toContain("troponin negative");
    });

    it("returns normal imaging for SVT", () => {
      const result = getOrderResultTemplate("imaging", "teen_svt_complex_v1", "svt_onset");

      expect(result.summary).toContain("CXR normal");
      expect(result.summary).toContain("structurally normal heart");
      expect(result.abnormal).toBeUndefined();
    });
  });

  describe("peds_myocarditis_silent_crash_v1", () => {
    it("returns worsened vitals during decompensation", () => {
      const result = getOrderResultTemplate("vitals", "peds_myocarditis_silent_crash_v1", "crash_stage");

      expect(result.hr).toBe(155);
      expect(result.bp).toBe("78/50");
      expect(result.spo2).toBe(91);
    });

    it("returns baseline myocarditis vitals in early stage", () => {
      const result = getOrderResultTemplate("vitals", "peds_myocarditis_silent_crash_v1", "presentation");

      expect(result.hr).toBe(128);
      expect(result.bp).toBe("94/58");
    });

    it("returns decompensation EKG during crash", () => {
      const result = getOrderResultTemplate("ekg", "peds_myocarditis_silent_crash_v1", "decomp_stage");

      expect(result.summary).toContain("150 bpm");
      expect(result.summary).toContain("PVCs");
      expect(result.summary).toContain("ST depression");
    });

    it("returns elevated labs during decompensation", () => {
      const result = getOrderResultTemplate("labs", "peds_myocarditis_silent_crash_v1", "crash_stage");

      expect(result.summary).toContain("Troponin markedly elevated");
      expect(result.summary).toContain("BNP high");
      expect(result.summary).toContain("lactate");
      expect(result.abnormal).toContain("Troponin/BNP markedly elevated");
    });

    it("returns severe imaging findings during decompensation", () => {
      const result = getOrderResultTemplate("imaging", "peds_myocarditis_silent_crash_v1", "decomp_stage");

      expect(result.summary).toContain("cardiomegaly with pulmonary edema");
      expect(result.summary).toContain("EF 25-30%");
      expect(result.abnormal).toContain("Severe cardiomegaly");
    });
  });

  describe("palpitations_svt (simple scenario)", () => {
    it("shares templates with complex SVT scenario", () => {
      const complexVitals = getOrderResultTemplate("vitals", "teen_svt_complex_v1", "svt_onset");
      const simpleVitals = getOrderResultTemplate("vitals", "palpitations_svt", "svt_onset");

      expect(complexVitals.hr).toBe(simpleVitals.hr);
      expect(complexVitals.bp).toBe(simpleVitals.bp);
    });
  });

  describe("myocarditis (simple scenario)", () => {
    it("shares templates with complex myocarditis scenario", () => {
      const complexVitals = getOrderResultTemplate("vitals", "peds_myocarditis_silent_crash_v1", "presentation");
      const simpleVitals = getOrderResultTemplate("vitals", "myocarditis", "presentation");

      expect(complexVitals.hr).toBe(simpleVitals.hr);
      expect(complexVitals.bp).toBe(simpleVitals.bp);
    });
  });

  describe("stage-aware template selection", () => {
    it("detects decomp stages for myocarditis", () => {
      const decomp1 = getOrderResultTemplate("vitals", "myocarditis", "decomp_worsening");
      const decomp2 = getOrderResultTemplate("vitals", "peds_myocarditis_silent_crash_v1", "crash_imminent");

      // Both should return decompensation vitals
      expect(decomp1.hr).toBe(155);
      expect(decomp2.hr).toBe(155);
    });

    it("detects converted stages for SVT", () => {
      const converted1 = getOrderResultTemplate("ekg", "teen_svt_complex_v1", "sinus_restored");
      const converted2 = getOrderResultTemplate("ekg", "palpitations_svt", "converted_stable");

      // Both should return post-conversion EKG
      expect(converted1.summary).toContain("Sinus rhythm");
      expect(converted2.summary).toContain("Sinus rhythm");
    });
  });

  describe("fallback to generic", () => {
    it("returns generic results for unrecognized scenario", () => {
      const result = getOrderResultTemplate("vitals", "syncope" as any);

      expect(result.type).toBe("vitals");
      expect(result.hr).toBe(102); // Generic baseline
    });

    it("returns generic EKG for unrecognized scenario", () => {
      const result = getOrderResultTemplate("ekg", "syncope" as any);

      expect(result.summary).toContain("Sinus rhythm");
      expect(result.summary).toContain("borderline QTc");
    });
  });
});
