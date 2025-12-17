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
  myocarditis: {
    chiefComplaint: "Chest discomfort after viral illness",
    hpi: [
      "Fever and myalgias followed by chest discomfort and fatigue.",
      "Shortness of breath with minimal exertion.",
      "No prior heart disease; tachycardia out of proportion to fever.",
    ],
    exam: [
      "Tired appearance; possible tachycardia and gallop.",
      "Mild hepatomegaly; possible rub.",
      "Lungs clear or mild crackles if decompensating.",
    ],
    labs: [
      { name: "Troponin", status: "result", summary: "Elevated in myocarditis." },
      { name: "BNP/NT-proBNP", status: "result", summary: "Elevated with ventricular dysfunction." },
      { name: "CRP/ESR", status: "pending", summary: "Inflammatory markers may be elevated." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Sinus tachycardia; diffuse ST-T changes possible." },
      { name: "CXR", status: "result", summary: "May show cardiomegaly or pulmonary edema." },
      { name: "Echo", status: "result", summary: "Can show depressed function." },
    ],
  },
  exertional_syncope_hcm: {
    chiefComplaint: "Presyncope with intense exercise",
    hpi: [
      "Dizziness and chest tightness during sprints; no full LOC yet.",
      "Occasional palpitations.",
      "Family history of sudden death in a young relative.",
    ],
    exam: [
      "Possible harsh systolic murmur at LSB increasing with Valsalva/standing.",
      "Strong pulses; no hepatomegaly.",
      "May be orthostatic.",
    ],
    labs: [
      { name: "Electrolytes", status: "pending", summary: "Screen if arrhythmia risk." },
      { name: "Troponin", status: "pending", summary: "Usually normal; order if chest pain." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Possible LVH, deep Q waves, repolarization changes." },
      { name: "Echo", status: "pending", summary: "Assess LVH, gradients, SAM." },
      { name: "CXR", status: "pending", summary: "Often normal; may show mild cardiomegaly." },
    ],
  },
  ductal_shock: {
    chiefComplaint: "Infant in shock",
    hpi: [
      "Poor feeding, lethargy, cool extremities.",
      "Oliguria and tachypnea over hours.",
      "Possible duct-dependent congenital heart lesion.",
    ],
    exam: [
      "Tachycardia, weak pulses, delayed cap refill.",
      "Possible differential cyanosis; hepatomegaly.",
      "Cool extremities, mottling.",
    ],
    labs: [
      { name: "Blood gas/lactate", status: "result", summary: "Metabolic acidosis, elevated lactate." },
      { name: "Electrolytes", status: "result", summary: "Check glucose/electrolytes before interventions." },
      { name: "Hemoglobin", status: "pending", summary: "Assess anemia." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Sinus tachycardia; possible RV strain." },
      { name: "CXR", status: "result", summary: "May show cardiomegaly or pulmonary edema." },
      { name: "Echo", status: "pending", summary: "Needed to define anatomy; assume limited at bedside." },
    ],
  },
  cyanotic_spell: {
    chiefComplaint: "Cyanotic spells",
    hpi: [
      "Turns blue during crying/playing, sometimes squats.",
      "Episodes improve when squatting or being held.",
      "Known congenital heart disease with poor follow-up.",
    ],
    exam: [
      "Cyanosis, clubbing possible.",
      "Harsh systolic murmur LUSB; increased with agitation.",
      "Tachypnea during spells; otherwise playful toddler.",
    ],
    labs: [
      { name: "Blood gas", status: "result", summary: "Hypoxemia; may have respiratory alkalosis during spell." },
      { name: "Hemoglobin", status: "pending", summary: "Assess polycythemia." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "RVH pattern possible." },
      { name: "CXR", status: "result", summary: "Boot-shaped heart possible." },
      { name: "Echo", status: "pending", summary: "Definitive anatomy; assumed known history." },
    ],
  },
  kawasaki: {
    chiefComplaint: "Fever and rash for 5 days",
    hpi: [
      "Persistent fever >5 days with rash and red eyes.",
      "Cracked lips, strawberry tongue, swollen hands/feet.",
      "Irritable, poor intake.",
    ],
    exam: [
      "Febrile, irritable preschooler.",
      "Conjunctivitis, oral changes; no murmur.",
      "Swollen hands/feet; cervical node enlarged.",
    ],
    labs: [
      { name: "CBC/CRP/ESR", status: "result", summary: "Inflammatory markers elevated." },
      { name: "CMP", status: "pending", summary: "Assess liver enzymes, albumin." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Sinus tachycardia expected." },
      { name: "Echo", status: "pending", summary: "Coronary assessment; may be normal early." },
    ],
  },
  coarctation_shock: {
    chiefComplaint: "Infant in shock",
    hpi: [
      "Poor feeding, lethargy, cool legs.",
      "Tachypnea and decreased urine over hours.",
      "No known congenital heart disease diagnosed.",
    ],
    exam: [
      "Ill-appearing infant, cool lower extremities.",
      "Weak femoral pulses, stronger upper pulses.",
      "Delayed cap refill legs; possible gallop.",
    ],
    labs: [
      { name: "Blood gas/lactate", status: "result", summary: "Metabolic acidosis likely." },
      { name: "Electrolytes/glucose", status: "result", summary: "Check before interventions." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Sinus tachycardia." },
      { name: "CXR", status: "result", summary: "May show cardiomegaly/pulmonary edema." },
      { name: "Echo", status: "pending", summary: "Assess arch and gradients." },
    ],
  },
  arrhythmogenic_syncope: {
    chiefComplaint: "Collapse during sports",
    hpi: [
      "Brief loss of consciousness during practice.",
      "Palpitations beforehand; rapid recovery.",
      "Family history of sudden death in a young relative.",
    ],
    exam: [
      "Alert now, anxious.",
      "Occasional irregular beats; no loud murmur.",
      "Good pulses; perfusion intact.",
    ],
    labs: [
      { name: "Electrolytes", status: "pending", summary: "Screen for arrhythmia contributors." },
      { name: "Troponin", status: "pending", summary: "Usually normal; order if chest pain." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Baseline sinus; watch for PVCs/runs." },
      { name: "Echo", status: "pending", summary: "Rule out structural disease." },
    ],
  },
  teen_svt_complex_v1: {
    chiefComplaint: "Rapid palpitations - currently in SVT",
    hpi: [
      "14-year-old with recurrent episodes of sudden-onset rapid heartbeat.",
      "Current episode started 15 minutes ago during volleyball practice.",
      "Mother had WPW ablated in her 20s.",
      "One prior ER visit - spontaneously converted before workup.",
    ],
    exam: [
      "Anxious teen, visibly uncomfortable, clutching chest.",
      "Very rapid regular pulse ~220 bpm; no murmurs audible.",
      "Warm, slightly diaphoretic, cap refill 2 seconds.",
      "Alert, oriented, mild dizziness reported.",
    ],
    labs: [
      { name: "Electrolytes", status: "pending", summary: "Obtain before medications." },
      { name: "Troponin", status: "pending", summary: "Usually normal in SVT; order if prolonged." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Narrow complex tachycardia 220 bpm, regular, no visible P waves." },
      { name: "Post-conversion ECG", status: "pending", summary: "Look for delta wave (WPW) after conversion." },
    ],
  },
  peds_myocarditis_silent_crash_v1: {
    chiefComplaint: "Fatigue and respiratory distress after viral illness",
    hpi: [
      "10-year-old with 5-day history of fatigue and poor appetite after URI.",
      "Increasing shortness of breath over past 24 hours.",
      "Vomited twice today; parents note she looks pale.",
      "No prior cardiac history; previously healthy and active.",
    ],
    exam: [
      "Tired, pale child; tachypneic at rest.",
      "Tachycardia with gallop rhythm; weak pulses.",
      "Cool extremities, delayed cap refill 4 seconds.",
      "Hepatomegaly; mild crackles at lung bases.",
    ],
    labs: [
      { name: "Troponin", status: "result", summary: "Elevated, consistent with myocardial injury." },
      { name: "BNP/NT-proBNP", status: "result", summary: "Markedly elevated indicating heart failure." },
      { name: "Lactate", status: "result", summary: "Elevated indicating poor perfusion." },
    ],
    imaging: [
      { name: "ECG", status: "result", summary: "Sinus tachycardia, low voltage, ST-T changes." },
      { name: "CXR", status: "result", summary: "Cardiomegaly with pulmonary edema." },
      { name: "Echo", status: "pending", summary: "Severely depressed LV function expected." },
    ],
  },
};

export function getScenarioSnapshot(scenarioId: PatientScenarioId | null | undefined): ScenarioSnapshot | null {
  if (!scenarioId) return null;
  return summaries[scenarioId] ?? null;
}
