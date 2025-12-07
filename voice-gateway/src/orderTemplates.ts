import { PatientScenarioId } from "./patientCase";
import { OrderResult, OrderType } from "./messageTypes";

export function getOrderResultTemplate(type: OrderType, scenario: PatientScenarioId): OrderResult {
  if (type === "vitals") {
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
          : "Sinus rhythm, occasional PACs, nonspecific ST/T changes.",
    };
  }
  if (type === "labs") {
    return {
      type: "labs",
      summary:
        scenario === "syncope"
          ? "CBC normal; electrolytes normal; troponin negative; glucose normal."
          : scenario === "palpitations_svt"
          ? "CBC normal; electrolytes normal; TSH pending."
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
        : "CXR normal; no acute process; no cardiomegaly.",
  };
}
