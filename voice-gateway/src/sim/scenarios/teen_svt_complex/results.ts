/**
 * SVT Scenario Results
 *
 * Phase-dependent lab and ECG results.
 */

import type { SVTPhase } from "../../scenarioTypes";

// ============================================================================
// Types
// ============================================================================

export type ResultType = "ecg" | "cbc" | "bmp" | "troponin" | "cxr" | "echo";

export type LabResult = {
  type: ResultType;
  resultText: string;
  interpretation: string;
  criticalValues?: string[];
  delaySeconds: number;
};

export const AVAILABLE_RESULTS: ResultType[] = ["ecg", "cbc", "bmp", "troponin", "cxr", "echo"];

// ============================================================================
// Result Functions
// ============================================================================

function getECGResult(phase: SVTPhase, currentRhythm: "sinus" | "svt"): LabResult {
  const base = {
    type: "ecg" as ResultType,
    delaySeconds: 90, // 1.5 minutes
  };

  if (phase === "presentation" || currentRhythm === "sinus") {
    return {
      ...base,
      resultText: `12-lead ECG:
Rate: 92 bpm
Rhythm: Normal sinus rhythm
PR Interval: 0.14 seconds (normal)
QRS Duration: 0.08 seconds (narrow)
QTc: 0.42 seconds (normal)
Axis: Normal
ST-T waves: No acute changes
Delta wave: None
Interpretation: Normal sinus rhythm. No evidence of pre-excitation (WPW). Normal intervals.`,
      interpretation:
        "Normal sinus rhythm with no pre-excitation. No evidence of accessory pathway at baseline. If recurrent SVT, consider EP study for definitive diagnosis.",
    };
  }

  if (phase === "svt_onset" || phase === "treatment_window") {
    return {
      ...base,
      resultText: `12-lead ECG:
Rate: 220 bpm
Rhythm: Narrow complex tachycardia, regular
P waves: Not clearly visible (likely buried in T waves)
QRS Duration: 0.08 seconds (narrow)
RP Interval: Short (<70ms)
ST-T waves: Rate-related ST depression V4-V6
Axis: Normal
Interpretation: Supraventricular tachycardia - likely AVNRT (atrioventricular nodal reentrant tachycardia) given short RP interval.`,
      interpretation:
        "SVT at 220 bpm. Narrow complex, regular rhythm. Most consistent with AVNRT. First-line: vagal maneuvers, then adenosine. Family history of WPW warrants EP evaluation after conversion.",
      criticalValues: ["Rate 220 bpm", "SVT"],
    };
  }

  if (phase === "cardioversion_decision" || phase === "decompensating") {
    return {
      ...base,
      resultText: `12-lead ECG:
Rate: 240 bpm
Rhythm: Narrow complex tachycardia, regular
P waves: Not visible
QRS Duration: 0.08 seconds (narrow)
ST-T waves: More pronounced ST depression
Interpretation: Persistent SVT with hemodynamic compromise. Consider synchronized cardioversion.`,
      interpretation:
        "Ongoing SVT at 240 bpm with patient showing signs of hemodynamic instability. Adenosine has failed or not yet attempted. Synchronized cardioversion indicated.",
      criticalValues: ["Rate 240 bpm", "Hemodynamically unstable SVT"],
    };
  }

  // Converted phase
  return {
    ...base,
    resultText: `12-lead ECG:
Rate: 95 bpm
Rhythm: Normal sinus rhythm
PR Interval: 0.14 seconds
QRS Duration: 0.08 seconds
QTc: 0.41 seconds
Delta wave: None
Interpretation: Normal sinus rhythm post-conversion. No residual pre-excitation. Recommend cardiology follow-up.`,
    interpretation:
      "Post-conversion ECG showing normal sinus rhythm. No evidence of pre-excitation at baseline. Cardiology referral for EP evaluation recommended given family history.",
  };
}

function getCBCResult(): LabResult {
  return {
    type: "cbc",
    resultText: `Complete Blood Count:
WBC: 7.2 x10^9/L (normal: 4.5-13.5)
Hemoglobin: 13.8 g/dL (normal: 12.0-16.0)
Hematocrit: 41% (normal: 36-46)
Platelets: 245 x10^9/L (normal: 150-400)
MCV: 86 fL (normal: 80-100)

Differential:
Neutrophils: 58%
Lymphocytes: 32%
Monocytes: 7%
Eosinophils: 2%
Basophils: 1%`,
    interpretation: "Normal CBC. No evidence of infection or anemia that might contribute to tachycardia.",
    delaySeconds: 300, // 5 minutes
  };
}

function getBMPResult(): LabResult {
  return {
    type: "bmp",
    resultText: `Basic Metabolic Panel:
Sodium: 140 mEq/L (normal: 136-145)
Potassium: 4.2 mEq/L (normal: 3.5-5.0)
Chloride: 102 mEq/L (normal: 98-106)
CO2: 24 mEq/L (normal: 22-29)
BUN: 12 mg/dL (normal: 7-20)
Creatinine: 0.8 mg/dL (normal: 0.6-1.2)
Glucose: 98 mg/dL (normal: 70-100)
Calcium: 9.4 mg/dL (normal: 8.5-10.5)`,
    interpretation:
      "Normal electrolytes. No hypokalemia, hypomagnesemia, or other metabolic derangement that might trigger or sustain arrhythmia.",
    delaySeconds: 300, // 5 minutes
  };
}

function getTroponinResult(): LabResult {
  return {
    type: "troponin",
    resultText: `Troponin I: <0.01 ng/mL
Reference: <0.04 ng/mL
Result: NORMAL`,
    interpretation:
      "Normal troponin. No evidence of myocardial injury. SVT can cause mild troponin elevation from rate-related demand ischemia, but this patient shows no elevation.",
    delaySeconds: 600, // 10 minutes
  };
}

function getCXRResult(): LabResult {
  return {
    type: "cxr",
    resultText: `Chest X-ray (PA and Lateral):
Heart size: Normal cardiothoracic ratio
Mediastinum: Normal width, no masses
Lungs: Clear bilaterally, no infiltrates or effusions
Pleura: No pneumothorax
Bones: No acute abnormalities
Impression: Normal chest radiograph.`,
    interpretation: "Normal chest X-ray. No cardiomegaly or pulmonary edema. Heart appears structurally normal on radiograph.",
    delaySeconds: 180, // 3 minutes
  };
}

function getEchoResult(phase: SVTPhase): LabResult {
  const base = {
    type: "echo" as ResultType,
    delaySeconds: 900, // 15 minutes (bedside echo)
  };

  if (phase === "converted") {
    return {
      ...base,
      resultText: `Bedside Echocardiogram:
LV Function: Normal systolic function, EF 60-65%
LV Size: Normal
RV Function: Normal
Valves: No significant regurgitation or stenosis
Pericardium: No effusion
Conclusion: Structurally normal heart.`,
      interpretation:
        "Normal echocardiogram. No structural heart disease identified. Supports diagnosis of primary electrical disorder (SVT/AVNRT). EP study recommended for definitive diagnosis and possible ablation.",
    };
  }

  // During SVT
  return {
    ...base,
    resultText: `Bedside Echocardiogram (limited, during tachycardia):
LV Function: Hyperdynamic, difficult to assess accurately at this rate
LV Size: Appears normal
RV Function: Difficult to assess
Valves: Cannot exclude regurgitation at this rate
Recommendation: Repeat after rate control for accurate assessment.`,
    interpretation:
      "Limited study due to tachycardia. Gross LV function appears preserved. Recommend repeat echo after conversion to sinus rhythm.",
  };
}

// ============================================================================
// Main Result Function
// ============================================================================

export function getResult(
  type: ResultType,
  phase: SVTPhase,
  currentRhythm: "sinus" | "svt" = "svt"
): LabResult {
  switch (type) {
    case "ecg":
      return getECGResult(phase, currentRhythm);
    case "cbc":
      return getCBCResult();
    case "bmp":
      return getBMPResult();
    case "troponin":
      return getTroponinResult();
    case "cxr":
      return getCXRResult();
    case "echo":
      return getEchoResult(phase);
    default:
      return {
        type,
        resultText: "Result not available for this test type.",
        interpretation: "Please order a specific test.",
        delaySeconds: 60,
      };
  }
}

// ============================================================================
// Nurse Order Acknowledgments
// ============================================================================

export function getNurseOrderAcknowledgment(orderType: string): string {
  const acknowledgments: Record<string, string> = {
    ecg: "Getting the 12-lead now. Should have it in about a minute.",
    cbc: "CBC sent. Results in about 5 minutes.",
    bmp: "BMP sent. Results in about 5 minutes.",
    troponin: "Troponin sent. Takes about 10 minutes.",
    cxr: "Portable chest x-ray ordered. Tech is on the way.",
    echo: "Calling for bedside echo. Tech should be here in a few minutes.",
    iv: "I'll get a line in. 20 gauge in the AC should work.",
    monitor: "Getting her on the monitor now.",
    adenosine: "Adenosine is ready. I'll push it rapid with a flush.",
    vagal: "I'll try the vagal maneuver. Which one - ice or Valsalva?",
    cardioversion: "Setting up for cardioversion. Getting the pads on.",
    sedation: "Drawing up sedation now. What agent and dose?",
  };

  return acknowledgments[orderType.toLowerCase()] || `${orderType} - got it, working on it.`;
}
