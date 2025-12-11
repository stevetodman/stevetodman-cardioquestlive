import { PatientScenarioId } from "./patientCase";
import { OrderResult, OrderType } from "./messageTypes";

export function getOrderResultTemplate(type: OrderType, scenario: PatientScenarioId, stageId?: string): OrderResult {
  if (type === "vitals") {
    if (scenario === "myocarditis" || scenario === "peds_myocarditis_silent_crash_v1") {
      // Complex myocarditis: vitals worsen with stage progression
      const isDecomp = stageId?.includes("decomp") || stageId?.includes("crash");
      if (isDecomp) {
        return { type: "vitals", hr: 155, bp: "78/50", rr: 36, spo2: 91, temp: 38.4 };
      }
      return { type: "vitals", hr: 128, bp: "94/58", rr: 24, spo2: 95, temp: 38.2 };
    }
    if (scenario === "teen_svt_complex_v1" || scenario === "palpitations_svt") {
      // SVT: rapid narrow complex tachycardia ~200-220 bpm
      const isConverted = stageId?.includes("converted") || stageId?.includes("sinus");
      if (isConverted) {
        return { type: "vitals", hr: 92, bp: "108/68", rr: 16, spo2: 99, temp: 98.4 };
      }
      return { type: "vitals", hr: 218, bp: "98/62", rr: 22, spo2: 98, temp: 98.6 };
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
    // SVT scenarios (simple and complex)
    const isSVT = scenario === "palpitations_svt" || scenario === "teen_svt_complex_v1";
    const isConverted = stageId?.includes("converted") || stageId?.includes("sinus");
    // Myocarditis scenarios (simple and complex)
    const isMyocarditis = scenario === "myocarditis" || scenario === "peds_myocarditis_silent_crash_v1";
    const isDecomp = stageId?.includes("decomp") || stageId?.includes("crash");

    return {
      type: "ekg",
      summary:
        isSVT
          ? isConverted
            ? "Sinus rhythm ~90 bpm; normal intervals; no ectopy post-conversion."
            : "Narrow regular tachycardia ~220 bpm, no discernible P waves; RP<PR pattern."
          : scenario === "syncope"
          ? "Sinus rhythm ~96 bpm, borderline QTc."
          : isMyocarditis
          ? isDecomp
            ? "Sinus tachycardia ~150 bpm; low voltage; ST depression; frequent PVCs."
            : "Sinus tachycardia ~125 bpm, diffuse low voltage; nonspecific ST-T changes."
          : scenario === "exertional_syncope_hcm"
          ? "Sinus rhythm ~105 bpm; LVH with deep narrow Q waves in inferolateral leads, repolarization changes."
          : scenario === "ductal_shock"
          ? "Sinus tachycardia; possible RV strain pattern."
          : scenario === "cyanotic_spell"
          ? "Right axis, RVH; no acute ischemic changes."
          : "Sinus rhythm, occasional PACs, nonspecific ST/T changes.",
      imageUrl:
        isSVT
          ? isConverted ? "/images/ekg/ekg-baseline.png" : "/images/ekg/ekg-svt.png"
          : isMyocarditis
          ? "/images/ekg/ekg-myocarditis.png"
          : scenario === "exertional_syncope_hcm"
          ? "/images/ekg/ekg-hcm.png"
          : scenario === "ductal_shock"
          ? "/images/ekg/ekg-ductal.png"
          : scenario === "cyanotic_spell"
          ? "/images/ekg/ekg-cyanotic.png"
          : "/images/ekg/ekg-baseline.png",
      meta:
        isSVT
          ? isConverted
            ? { rate: "~90 bpm sinus", intervals: "Normal", axis: "Normal" }
            : { rate: "~220 bpm narrow regular", intervals: "RP<PR pattern", axis: "Normal" }
          : scenario === "exertional_syncope_hcm"
          ? { rate: "~105 bpm", intervals: "Normal", axis: "Left; LVH with Qs" }
          : isMyocarditis
          ? isDecomp
            ? { rate: "~150 bpm", intervals: "PR normal; PVCs", axis: "Low voltage; ST changes" }
            : { rate: "~125 bpm", intervals: "PR/QRS normal", axis: "Low voltage diffuse" }
          : scenario === "ductal_shock"
          ? { rate: "~180 bpm", intervals: "Normal", axis: "Rightward" }
          : scenario === "cyanotic_spell"
          ? { rate: "~150 bpm", intervals: "Normal", axis: "Right axis; RVH" }
          : { rate: "~95 bpm", intervals: "Normal", axis: "Normal" },
      abnormal: isSVT && !isConverted ? "Narrow complex tachycardia ~220" : isMyocarditis ? "Low voltage; possible PVCs" : undefined,
      nextAction:
        isSVT
          ? isConverted
            ? "Monitor for recurrence; consider cardiology follow-up."
            : "Consider vagal maneuvers first; adenosine if persistent; sync cardioversion if unstable."
          : isMyocarditis
          ? isDecomp
            ? "Urgent ICU; inotropes/diuretics; consider ECMO evaluation."
            : "Monitor rhythm; consider troponin/echo if not already."
          : scenario === "ductal_shock"
          ? "Support perfusion; ensure prostaglandin/ICU consult."
          : scenario === "cyanotic_spell"
          ? "Treat spell (knee-chest/O2); monitor RV strain."
          : undefined,
    };
  }
  if (type === "labs") {
    const isDecomp = stageId?.includes("decomp") || stageId?.includes("crash");
    const isShock = stageId?.includes("shock");
    const isImproving = stageId?.includes("improving") || stageId?.includes("support");
    const isSVT = scenario === "palpitations_svt" || scenario === "teen_svt_complex_v1";
    const isMyocarditis = scenario === "myocarditis" || scenario === "peds_myocarditis_silent_crash_v1";

    return {
      type: "labs",
      summary:
        scenario === "syncope"
          ? "CBC normal; electrolytes normal; troponin negative; glucose normal."
        : isSVT
          ? "CBC normal; electrolytes normal; TSH pending; troponin negative."
        : isMyocarditis
          ? isDecomp
            ? "Troponin markedly elevated; BNP high (>2000); CRP/ESR elevated; lactate 3.2; electrolytes normal."
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
      abnormal:
        scenario === "kawasaki"
          ? "Inflammatory markers high"
          : isMyocarditis
          ? isDecomp ? "Troponin/BNP markedly elevated; lactate elevated" : "Troponin/BNP elevated"
          : scenario === "ductal_shock"
          ? "Lactate elevated"
          : scenario === "cyanotic_spell"
          ? "Polycythemia"
          : undefined,
      nextAction:
        scenario === "kawasaki"
          ? "Start IVIG/ASA if criteria met; echo follow-up."
          : isMyocarditis
          ? isDecomp
            ? "Urgent ICU; inotropes/diuretics; consider ECMO evaluation."
            : "Consider ICU support; diuresis/inotrope per status; repeat troponin."
          : scenario === "ductal_shock"
          ? "Bolus if needed; maintain ductal patency; correct glucose."
          : scenario === "cyanotic_spell"
          ? "Treat spell (knee-chest/O2); plan for definitive repair."
          : isSVT
          ? "Check electrolytes/TSH; cardiology follow-up."
          : undefined,
    };
  }
  // Imaging fallback (CXR/echo)
  const isSVT = scenario === "palpitations_svt" || scenario === "teen_svt_complex_v1";
  const isMyocarditis = scenario === "myocarditis" || scenario === "peds_myocarditis_silent_crash_v1";
  const isDecomp = stageId?.includes("decomp") || stageId?.includes("crash");

  return {
    type: "imaging",
    summary:
      isSVT
        ? "CXR normal silhouette; no cardiomegaly; clear lungs. Echo: structurally normal heart."
        : scenario === "syncope"
          ? "CXR clear; normal heart size; no effusion."
        : isMyocarditis
          ? isDecomp
            ? "CXR cardiomegaly with pulmonary edema; echo: severely depressed LV function (EF 25-30%)."
            : "CXR mild cardiomegaly with pulmonary vascular congestion; echo: LV function mildly reduced (EF 40-45%)."
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
    abnormal:
      isMyocarditis
        ? isDecomp ? "Severe cardiomegaly/pulmonary edema; EF 25-30%" : "Cardiomegaly/pulmonary congestion"
        : scenario === "kawasaki"
        ? "Coronary ectasia/effusion possible"
        : scenario === "ductal_shock"
        ? "Cardiomegaly with edema"
        : scenario === "coarctation_shock"
        ? "Poor distal flow; coarct gradient"
        : scenario === "cyanotic_spell"
        ? "Boot-shaped heart"
        : undefined,
    nextAction:
      isMyocarditis
        ? isDecomp
          ? "Urgent ICU; inotropes/diuretics; consider ECMO evaluation."
          : "Consider ICU, inotrope/diuresis; cardiology consult."
        : scenario === "kawasaki"
        ? "Start/continue IVIG/ASA; cardiology follow-up."
        : scenario === "ductal_shock"
        ? "Maintain PGE; surgical/cardiology consult."
        : scenario === "coarctation_shock"
        ? "Stabilize perfusion; surgical consult for repair."
        : scenario === "cyanotic_spell"
        ? "Treat spell; plan for cath/surgery."
        : isSVT
        ? "Cardiology follow-up; consider EP study for recurrent SVT."
        : undefined,
  };
}
