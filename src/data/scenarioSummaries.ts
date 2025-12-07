import { PatientScenarioId } from "../types/voiceGateway";

type ScenarioSnapshot = {
  chiefComplaint: string;
  hpi: string[];
  exam: string[];
  labs: { name: string; status: "pending" | "result"; summary: string }[];
  imaging: { name: string; status: "pending" | "result"; summary: string }[];
};

const summaries: Record<PatientScenarioId, ScenarioSnapshot> = {
  exertional_chest_pain: {
    chiefComplaint: "Chest pain and palpitations with exertion",
    hpi: [
      "Intermittent pressure with running; sometimes feels heart racing.",
      "No syncope; lasts a few minutes and resolves with rest.",
      "More frequent over the past month; no recent fevers or URI.",
    ],
    exam: [
      "Alert, comfortable at rest.",
      "Regular rhythm; possible soft systolic murmur LUSB.",
      "No hepatomegaly; good peripheral pulses.",
    ],
    labs: [
      { name: "Troponin", status: "pending", summary: "Order if concern for myocarditis/ischemia." },
      { name: "BNP/NT-proBNP", status: "pending", summary: "Consider if heart failure symptoms emerge." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Sinus rhythm; possible nonspecific ST/T changes." },
      { name: "CXR", status: "pending", summary: "Order if respiratory symptoms; expect no cardiomegaly." },
      { name: "Echo", status: "pending", summary: "Consider if persistent pain or abnormal ECG." },
    ],
  },
  syncope: {
    chiefComplaint: "Exertional near-syncope",
    hpi: [
      "Lightheaded and almost passed out during practice; improved with sitting.",
      "No chest pain; rare brief palpitations.",
      "No known family history of sudden death but unsure.",
    ],
    exam: [
      "Well-appearing; orthostatic vitals may reveal drop.",
      "Regular rhythm; no loud murmurs.",
      "Good perfusion; no hepatomegaly.",
    ],
    labs: [
      { name: "Troponin", status: "pending", summary: "Consider if chest pain or myocarditis suspicion." },
      { name: "Electrolytes", status: "pending", summary: "Check if arrhythmia risk or dehydration suspected." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Baseline sinus rhythm; assess QT, pre-excitation." },
      { name: "CXR", status: "pending", summary: "Only if respiratory findings; likely normal." },
      { name: "Echo", status: "pending", summary: "Consider if red flags or abnormal ECG." },
    ],
  },
  palpitations_svt: {
    chiefComplaint: "Recurrent palpitations",
    hpi: [
      "Sudden-onset rapid heartbeat episodes lasting 5–15 minutes.",
      "Often triggered by activity or stress; sometimes mild dizziness.",
      "No true syncope; resolves spontaneously.",
    ],
    exam: [
      "Comfortable between episodes; normal heart sounds.",
      "During episodes: rapid regular pulse; no gallop.",
      "No edema; lungs clear.",
    ],
    labs: [
      { name: "Electrolytes", status: "pending", summary: "Useful if arrhythmia persists or on meds." },
      { name: "TSH", status: "pending", summary: "Optional if long-standing palpitations." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Sinus rhythm baseline; captures SVT if timed." },
      { name: "Holter/event monitor", status: "pending", summary: "Order to document rhythm if episodes frequent." },
      { name: "Echo", status: "pending", summary: "Consider to rule out structural disease." },
    ],
  },
};

export function getScenarioSnapshot(scenarioId: PatientScenarioId | null | undefined): ScenarioSnapshot | null {
  if (!scenarioId) return null;
  return summaries[scenarioId] ?? null;
}
