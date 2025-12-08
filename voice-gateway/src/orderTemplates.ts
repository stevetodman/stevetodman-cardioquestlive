import { PatientScenarioId } from "./patientCase";
import { OrderResult, OrderType } from "./messageTypes";

export function getOrderResultTemplate(type: OrderType, scenario: PatientScenarioId, stageId?: string): OrderResult {
  if (type === "vitals") {
    if (scenario === "myocarditis") {
      return { type: "vitals", hr: 128, bp: "94/58", rr: 24, spo2: 95, temp: 38.2 };
    }
    if (scenario === "exertional_syncope_hcm") {
      return { type: "vitals", hr: 118, bp: "104/62", rr: 18, spo2: 99, temp: 98.6 };
    }
    if (scenario === "ductal_shock") {
      return { type: "vitals", hr: 182, bp: "64/40", rr: 40, spo2: 86, temp: 97.5 };
    }
    if (scenario === "cyanotic_spell") {
      return { type: "vitals", hr: 145, bp: "90/56", rr: 32, spo2: 78, temp: 98.2 };
    }
    return { type: "vitals", hr: 102, bp: "112/68", rr: 18, spo2: 99, temp: 98.4 };
  }
  if (type === "ekg") {
    return {
      type: "ekg",
      summary:
        scenario === "palpitations_svt"
          ? "Narrow regular tachycardia ~180 bpm, possible RP>PR."
          : scenario === "syncope"
          ? "Sinus rhythm ~96 bpm, borderline QTc."
          : scenario === "myocarditis"
          ? "Sinus tachycardia ~125 bpm, diffuse low voltage; nonspecific ST-T changes."
          : scenario === "exertional_syncope_hcm"
          ? "Sinus rhythm ~105 bpm; LVH with deep narrow Q waves in inferolateral leads, repolarization changes."
          : scenario === "ductal_shock"
          ? "Sinus tachycardia; possible RV strain pattern."
          : scenario === "cyanotic_spell"
          ? "Right axis, RVH; no acute ischemic changes."
          : "Sinus rhythm, occasional PACs, nonspecific ST/T changes.",
      imageUrl:
        scenario === "palpitations_svt"
          ? "/images/ekg/ekg-svt.png"
          : scenario === "myocarditis"
          ? "/images/ekg/ekg-myocarditis.png"
          : scenario === "exertional_syncope_hcm"
          ? "/images/ekg/ekg-hcm.png"
          : scenario === "ductal_shock"
          ? "/images/ekg/ekg-ductal.png"
          : scenario === "cyanotic_spell"
          ? "/images/ekg/ekg-cyanotic.png"
          : "/images/ekg/ekg-baseline.png",
      meta:
        scenario === "palpitations_svt"
          ? { rate: "~180 bpm narrow regular", intervals: "RP>PR possible", axis: "Normal" }
          : scenario === "exertional_syncope_hcm"
          ? { rate: "~105 bpm", intervals: "Normal", axis: "Left; LVH with Qs" }
          : scenario === "myocarditis"
          ? { rate: "~125 bpm", intervals: "PR/QRS normal", axis: "Low voltage diffuse" }
          : scenario === "ductal_shock"
          ? { rate: "~180 bpm", intervals: "Normal", axis: "Rightward" }
          : scenario === "cyanotic_spell"
          ? { rate: "~150 bpm", intervals: "Normal", axis: "Right axis; RVH" }
          : { rate: "~95 bpm", intervals: "Normal", axis: "Normal" },
    };
  }
  if (type === "labs") {
    const isDecomp = stageId?.includes("decomp");
    const isShock = stageId?.includes("shock");
    const isImproving = stageId?.includes("improving") || stageId?.includes("support");
    return {
      type: "labs",
      summary:
        scenario === "syncope"
          ? "CBC normal; electrolytes normal; troponin negative; glucose normal."
        : scenario === "palpitations_svt"
          ? "CBC normal; electrolytes normal; TSH pending."
        : scenario === "myocarditis"
          ? isDecomp
            ? "Troponin markedly elevated; BNP high; CRP/ESR elevated; lactate mild; electrolytes normal."
            : isImproving
            ? "Troponin trending down; BNP improving; CRP/ESR elevated."
            : "Troponin elevated; BNP elevated; CRP/ESR elevated; electrolytes normal; lactate normal."
        : scenario === "kawasaki"
          ? "CRP/ESR elevated; mild anemia; platelets upper normal early; transaminases mild; UA sterile pyuria possible."
        : scenario === "coarctation_shock"
          ? isShock
            ? "Metabolic acidosis; lactate 5.5; glucose 65; creatinine slightly elevated; CBC hemoconcentrated."
            : "Improving gas: lactate 2.8; glucose 82; creatinine normalizing."
        : scenario === "arrhythmogenic_syncope"
          ? "Electrolytes normal; Mg/K normal; troponin negative; tox screen negative."
        : scenario === "exertional_syncope_hcm"
          ? "CBC normal; electrolytes normal; troponin normal; glucose normal."
        : scenario === "ductal_shock"
          ? isImproving
            ? "Blood gas improving: lactate 2.4; glucose 82; electrolytes stable."
            : "Blood gas: metabolic acidosis with lactate 5.2; glucose 68; electrolytes pending."
        : scenario === "cyanotic_spell"
          ? "CBC: Hgb 17.5, Hct 52; electrolytes normal; blood gas shows hypoxemia."
        : "CBC normal; BMP normal; troponin pending; BNP pending.",
    };
  }
  return {
    type: "imaging",
      summary:
        scenario === "palpitations_svt"
          ? "CXR normal silhouette; no cardiomegaly; clear lungs."
        : scenario === "syncope"
          ? "CXR clear; normal heart size; no effusion."
        : scenario === "myocarditis"
          ? stageId?.includes("decomp")
            ? "CXR cardiomegaly with pulmonary edema; echo: depressed function."
            : "CXR mild cardiomegaly with pulmonary vascular congestion; echo: LV function mildly reduced."
      : scenario === "kawasaki"
        ? "CXR clear; echo: possible coronary ectasia; small pericardial effusion in some cases."
      : scenario === "exertional_syncope_hcm"
        ? "CXR normal size silhouette; echo: asymmetric septal hypertrophy, dynamic LVOT gradient."
      : scenario === "arrhythmogenic_syncope"
        ? "CXR normal; echo: structurally normal; consider Holter/CMR for RV changes."
      : scenario === "ductal_shock"
        ? stageId?.includes("improving")
          ? "CXR cardiomegaly with less pulmonary edema; echo: ductal-dependent systemic flow improving."
          : "CXR cardiomegaly with pulmonary edema; echo: ductal-dependent systemic flow."
      : scenario === "cyanotic_spell"
        ? "CXR boot-shaped heart; decreased pulmonary vascularity; echo: RV outflow obstruction."
      : scenario === "coarctation_shock"
        ? "CXR cardiomegaly; possible rib notching unlikely in infant; echo: severe coarctation with gradient, poor distal flow."
      : "CXR normal; no acute process; no cardiomegaly.",
  };
}
