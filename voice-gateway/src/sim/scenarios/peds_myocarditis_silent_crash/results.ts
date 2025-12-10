/**
 * Lab and Imaging Results for "The Silent Crash" Scenario
 *
 * Results are returned only when ordered. Values are phase-dependent.
 */

import type { MyocarditisPhase, ShockStage } from "../../scenarioTypes";

export type ResultType = "ecg" | "troponin" | "bnp" | "cbc" | "bmp" | "lactate" | "cxr" | "echo" | "abg";

export type LabResult = {
  type: ResultType;
  resultText: string;
  interpretation: string;
  criticalValues?: string[];
  delaySeconds: number;
};

/**
 * Get result based on phase and shock stage
 */
export function getResult(
  type: ResultType,
  phase: MyocarditisPhase,
  shockStage: ShockStage
): LabResult {
  switch (type) {
    case "ecg":
      return getECGResult(phase, shockStage);
    case "troponin":
      return getTroponinResult(phase, shockStage);
    case "bnp":
      return getBNPResult(phase, shockStage);
    case "cbc":
      return getCBCResult(phase);
    case "bmp":
      return getBMPResult(phase, shockStage);
    case "lactate":
      return getLactateResult(phase, shockStage);
    case "cxr":
      return getCXRResult(phase, shockStage);
    case "echo":
      return getEchoResult(phase, shockStage);
    case "abg":
      return getABGResult(phase, shockStage);
    default:
      return {
        type,
        resultText: "Test not available",
        interpretation: "Unknown test type",
        delaySeconds: 60,
      };
  }
}

// ============================================================================
// ECG
// ============================================================================

function getECGResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const base = {
    type: "ecg" as ResultType,
    delaySeconds: 120, // 2 minutes for ECG
  };

  if (phase === "scene_set" || phase === "recognition") {
    return {
      ...base,
      resultText: `12-lead ECG:
Rate: Sinus tachycardia 115-125 bpm
Rhythm: Regular sinus rhythm
Axis: Normal
Intervals: PR 0.14s, QRS 0.08s, QTc 0.44s
ST-T changes: Diffuse ST-T wave abnormalities, low voltage QRS in limb leads
No evidence of pre-excitation or ischemic ST elevation`,
      interpretation: "Sinus tachycardia with low voltage and diffuse ST-T changes - concerning for myocarditis. Consider troponin/BNP.",
      criticalValues: ["Low voltage QRS", "Diffuse ST-T changes"],
    };
  }

  if (phase === "decompensation" || phase === "intubation_trap") {
    return {
      ...base,
      resultText: `12-lead ECG:
Rate: Sinus tachycardia 140-155 bpm
Rhythm: Sinus with frequent PVCs
Axis: Normal
Intervals: PR 0.14s, QRS 0.10s (widening), QTc 0.48s (prolonged)
ST-T changes: ST depression V4-V6, low voltage, T-wave inversions
PVCs: Frequent, unifocal, some in couplets`,
      interpretation: "Sinus tachycardia with frequent PVCs and ischemic changes. QTc prolongation. Suggestive of severe myocarditis with arrhythmogenic potential.",
      criticalValues: ["Frequent PVCs", "QTc prolongation", "ST depression"],
    };
  }

  // Late phases
  return {
    ...base,
    resultText: `12-lead ECG:
Rate: Sinus tachycardia 130-140 bpm (on inotropes)
Rhythm: Regular sinus, decreased PVC burden
Axis: Normal
Intervals: PR 0.14s, QRS 0.09s, QTc 0.46s
ST-T changes: Persistent low voltage, ST-T changes improving`,
    interpretation: "Improving ECG with decreased ectopy on inotropic support. Persistent myocarditic changes.",
  };
}

// ============================================================================
// Troponin
// ============================================================================

function getTroponinResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const base = {
    type: "troponin" as ResultType,
    delaySeconds: 600, // 10 minutes
  };

  const troponinValue = shockStage <= 2 ? "2.8" : shockStage === 3 ? "4.2" : "5.1";

  return {
    ...base,
    resultText: `Troponin I: ${troponinValue} ng/mL
Reference: <0.04 ng/mL

CRITICAL VALUE - Provider notified`,
    interpretation: `Markedly elevated troponin (${troponinValue} ng/mL) consistent with significant myocardial injury. In context of viral prodrome and cardiogenic shock, highly suggestive of acute myocarditis.`,
    criticalValues: [`Troponin ${troponinValue} ng/mL`],
  };
}

// ============================================================================
// BNP
// ============================================================================

function getBNPResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const base = {
    type: "bnp" as ResultType,
    delaySeconds: 600, // 10 minutes
  };

  const bnpValue = shockStage <= 2 ? "1850" : shockStage === 3 ? "2800" : "3200";

  return {
    ...base,
    resultText: `BNP: ${bnpValue} pg/mL
Reference: <100 pg/mL

CRITICAL VALUE - Provider notified`,
    interpretation: `Severely elevated BNP (${bnpValue} pg/mL) indicating significant myocardial wall stress and heart failure. Consistent with acute decompensated heart failure from myocarditis.`,
    criticalValues: [`BNP ${bnpValue} pg/mL`],
  };
}

// ============================================================================
// CBC
// ============================================================================

function getCBCResult(phase: MyocarditisPhase): LabResult {
  return {
    type: "cbc",
    resultText: `WBC: 14.2 x10^9/L (H)
  - Neutrophils: 68%
  - Lymphocytes: 22%
  - Monocytes: 8%
Hemoglobin: 12.8 g/dL
Hematocrit: 38%
Platelets: 245 x10^9/L`,
    interpretation: "Mild leukocytosis consistent with recent viral infection or inflammatory response. No anemia or thrombocytopenia.",
    delaySeconds: 900, // 15 minutes
  };
}

// ============================================================================
// BMP
// ============================================================================

function getBMPResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const creatinine = shockStage <= 2 ? "0.8" : shockStage === 3 ? "1.2" : "1.5";
  const bicarb = shockStage <= 2 ? "20" : shockStage === 3 ? "16" : "14";
  const glucose = shockStage <= 2 ? "118" : "145";

  return {
    type: "bmp",
    resultText: `Sodium: 138 mEq/L
Potassium: 4.2 mEq/L
Chloride: 102 mEq/L
CO2: ${bicarb} mEq/L ${Number(bicarb) < 18 ? "(L)" : ""}
BUN: 18 mg/dL
Creatinine: ${creatinine} mg/dL ${Number(creatinine) > 1.0 ? "(H)" : ""}
Glucose: ${glucose} mg/dL ${Number(glucose) > 125 ? "(H)" : ""}`,
    interpretation: shockStage >= 3
      ? `Metabolic acidosis (bicarb ${bicarb}) and rising creatinine (${creatinine}) indicating poor tissue perfusion and early AKI. Stress hyperglycemia present.`
      : "Mild metabolic acidosis beginning. Renal function preserved. Watch closely for worsening perfusion.",
    criticalValues: shockStage >= 3 ? [`CO2 ${bicarb}`, `Creatinine ${creatinine}`] : undefined,
    delaySeconds: 900, // 15 minutes
  };
}

// ============================================================================
// Lactate
// ============================================================================

function getLactateResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const lactate = shockStage === 1 ? "2.8" : shockStage === 2 ? "4.5" : shockStage === 3 ? "6.8" : "8.2";

  return {
    type: "lactate",
    resultText: `Lactate: ${lactate} mmol/L
Reference: 0.5-2.0 mmol/L

${Number(lactate) >= 4 ? "CRITICAL VALUE - Provider notified" : ""}`,
    interpretation: Number(lactate) >= 4
      ? `Severely elevated lactate (${lactate}) indicating significant tissue hypoperfusion and anaerobic metabolism. Urgent intervention needed.`
      : `Elevated lactate (${lactate}) suggesting early tissue hypoperfusion. Trend closely.`,
    criticalValues: Number(lactate) >= 4 ? [`Lactate ${lactate}`] : undefined,
    delaySeconds: 300, // 5 minutes (POC)
  };
}

// ============================================================================
// Chest X-Ray
// ============================================================================

function getCXRResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const base = {
    type: "cxr" as ResultType,
    delaySeconds: 900, // 15 minutes
  };

  if (shockStage <= 2) {
    return {
      ...base,
      resultText: `Portable CXR:
Heart: Cardiomegaly, CTR 0.62 (normal <0.5)
Lungs: Bilateral interstitial edema, perihilar haziness
Pleural: Small bilateral effusions
Lines/tubes: None
Bones: No acute osseous abnormality`,
      interpretation: "Cardiomegaly with pulmonary vascular congestion and early pulmonary edema. Consistent with heart failure. Small effusions noted.",
      criticalValues: ["Cardiomegaly", "Pulmonary edema"],
    };
  }

  return {
    ...base,
    resultText: `Portable CXR:
Heart: Significant cardiomegaly, CTR 0.68
Lungs: Diffuse bilateral airspace disease, alveolar edema pattern
Pleural: Moderate bilateral pleural effusions
Lines/tubes: ${phase === "end" || phase === "confirmation_disposition" ? "ETT in good position, tip 2cm above carina" : "None"}
Bones: No acute osseous abnormality`,
    interpretation: "Worsening cardiomegaly with florid pulmonary edema and bilateral effusions. Findings consistent with decompensated heart failure. Consider limiting fluids.",
    criticalValues: ["Severe cardiomegaly", "Pulmonary edema", "Bilateral effusions"],
  };
}

// ============================================================================
// Echocardiogram
// ============================================================================

function getEchoResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const ef = shockStage === 1 ? "30" : shockStage === 2 ? "25" : shockStage === 3 ? "20" : "18";

  return {
    type: "echo",
    resultText: `Bedside Echocardiogram:

LV Function:
- EF: ${ef}% (severely reduced, normal >55%)
- Global hypokinesis, no regional wall motion abnormalities
- LV mildly dilated

RV Function:
- RV function moderately reduced
- No significant TR

Valves: Trivial MR, no other significant valve disease
Pericardium: Small pericardial effusion, no tamponade physiology
Cardiac Output: Low cardiac output state evident

CRITICAL FINDING: Severely reduced biventricular function consistent with acute myocarditis.`,
    interpretation: `Echocardiogram shows EF ${ef}% with global hypokinesis consistent with acute myocarditis. Biventricular dysfunction present. Small pericardial effusion without tamponade. Recommend cardiology consultation and consideration of mechanical support.`,
    criticalValues: [`EF ${ef}%`, "Global hypokinesis", "Biventricular dysfunction"],
    delaySeconds: 1200, // 20 minutes
  };
}

// ============================================================================
// ABG
// ============================================================================

function getABGResult(phase: MyocarditisPhase, shockStage: ShockStage): LabResult {
  const pCO2 = shockStage <= 2 ? "32" : "28";
  const bicarb = shockStage <= 2 ? "18" : shockStage === 3 ? "14" : "12";
  const pO2 = shockStage <= 2 ? "72" : "58";
  const lactate = shockStage === 1 ? "2.8" : shockStage === 2 ? "4.5" : shockStage === 3 ? "6.8" : "8.2";

  return {
    type: "abg",
    resultText: `ABG (on ${shockStage <= 2 ? "room air" : "15L NRB"}):
pH: ${shockStage <= 2 ? "7.32" : shockStage === 3 ? "7.24" : "7.18"}
pCO2: ${pCO2} mmHg
pO2: ${pO2} mmHg
HCO3: ${bicarb} mEq/L
Base Deficit: ${shockStage <= 2 ? "-6" : shockStage === 3 ? "-12" : "-16"}
Lactate: ${lactate} mmol/L`,
    interpretation: `Metabolic acidosis with respiratory compensation. ${shockStage >= 3 ? "Severe metabolic acidosis with high lactate indicating tissue hypoperfusion. May need airway support." : "Moderate metabolic acidosis. Trend lactate and perfusion."} ${Number(pO2) < 60 ? "Hypoxemia requiring increased support." : ""}`,
    criticalValues: shockStage >= 3 ? [`pH ${shockStage === 3 ? "7.24" : "7.18"}`, `Lactate ${lactate}`, `HCO3 ${bicarb}`] : undefined,
    delaySeconds: 600, // 10 minutes
  };
}

/**
 * Get all available result types
 */
export const AVAILABLE_RESULTS: ResultType[] = [
  "ecg",
  "troponin",
  "bnp",
  "cbc",
  "bmp",
  "lactate",
  "cxr",
  "echo",
  "abg",
];

/**
 * Get nurse announcement for ordering a test
 */
export function getNurseOrderAcknowledgment(type: ResultType): string {
  switch (type) {
    case "ecg":
      return "I'll get the ECG machine. Should have it in a couple minutes.";
    case "troponin":
    case "bnp":
      return "Sending troponin and BNP to the lab now. Results in about 10 minutes.";
    case "cbc":
    case "bmp":
      return "Labs are drawn and sent. Basic labs should be back in 15 minutes.";
    case "lactate":
      return "I'll run a point-of-care lactate. Be right back.";
    case "cxr":
      return "Portable chest x-ray is on the way. Should be here in a few minutes.";
    case "echo":
      return "I'll page the echo tech. They should be here in about 15-20 minutes.";
    case "abg":
      return "Drawing the ABG now. I'll run it myself - results in a few minutes.";
    default:
      return "I'll get that ordered right away.";
  }
}
