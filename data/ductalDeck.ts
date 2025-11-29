import { SessionData, Slide, Question } from "../types";

// Helper to wrap content in standard slide styles
const slideWrapper = (content: string) => `
  <div class="w-full h-full text-slate-50 bg-slate-900 rounded-2xl p-8 shadow-xl overflow-y-auto">
    ${content}
  </div>
`;

const slides: Slide[] = [
  {
    id: "title",
    index: 0,
    type: "content",
    html: slideWrapper(`
        <h1 class="text-3xl font-bold mb-4">
          Ductal-Dependent Lesions
        </h1>
        <h2 class="text-xl text-slate-300 mb-6">
          Blue vs Gray Infants – ABP Exam Focus
        </h2>
        <ul class="list-disc list-inside space-y-2 text-slate-100">
          <li>Recognize ductal-dependent <span class="font-semibold">systemic</span> vs <span class="font-semibold">pulmonary</span> lesions</li>
          <li>Use the “blue vs gray infant” schema under exam pressure</li>
          <li>Know when to start prostaglandin E1 (PGE1) immediately</li>
        </ul>
    `),
  },
  {
    id: "schema",
    index: 1,
    type: "content",
    html: slideWrapper(`
        <h2 class="text-2xl font-semibold mb-4">
          Schema: Blue vs Gray Infant
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div class="border border-slate-700 rounded-xl p-4">
            <h3 class="text-lg font-semibold text-sky-300 mb-2">Gray Infant</h3>
            <ul class="list-disc list-inside space-y-1">
              <li>Ashen, poor perfusion, prolonged capillary refill</li>
              <li>Weak / absent femoral pulses</li>
              <li>BP low; may have normal-ish SpO₂</li>
              <li><span class="font-semibold">Think: ductal-dependent systemic lesion</span></li>
            </ul>
          </div>
          <div class="border border-slate-700 rounded-xl p-4">
            <h3 class="text-lg font-semibold text-cyan-300 mb-2">Blue Infant</h3>
            <ul class="list-disc list-inside space-y-1">
              <li>Cyanosis, but warm and well perfused</li>
              <li>Good pulses, BP reasonable</li>
              <li>Low SpO₂, often 60–80%</li>
              <li><span class="font-semibold">Think: ductal-dependent pulmonary lesion</span></li>
            </ul>
          </div>
        </div>
    `),
  },
  {
    id: "case1",
    index: 2,
    type: "content",
    html: slideWrapper(`
        <h2 class="text-2xl font-semibold mb-4">
          Case 1 – Gray Infant in Shock
        </h2>
        <p class="mb-3 text-sm">
          A 30-hour-old term infant presents with poor feeding and lethargy.
        </p>
        <ul class="list-disc list-inside text-sm space-y-1 mb-3">
          <li>HR 180/min, RR 70/min, BP 55/35 mmHg</li>
          <li>Cool, mottled extremities, capillary refill 5–6 seconds</li>
          <li>Brachial pulses present, femoral pulses weak</li>
          <li>SpO₂ 96% in room air</li>
        </ul>
        <p class="text-sm text-slate-300 mb-1">
          Pattern: <span class="font-semibold">Gray infant</span> + weak femorals + 2–3 days old
        </p>
        <p class="text-sm text-sky-300">
          → Suspect ductal-dependent <span class="font-semibold">systemic</span> lesion (e.g., critical coarctation).
        </p>
    `),
  },
  {
    id: "case1_question",
    index: 3,
    type: "question",
    html: slideWrapper(`
        <h2 class="text-2xl font-semibold mb-4">
          Case 1 – What Is Your First Step?
        </h2>
        <p class="text-sm mb-3">
          Answer on your phone as if this were an ABP exam question.
        </p>
        <p class="text-xs text-slate-400">
          Watch the live results panel as responses come in.
        </p>
    `),
    questionId: "q_pge_gray_infant",
  },
  {
    id: "case2",
    index: 4,
    type: "content",
    html: slideWrapper(`
        <h2 class="text-2xl font-semibold mb-4">
          Case 2 – Blue but Well-Perfused Infant
        </h2>
        <p class="mb-3 text-sm">
          A 3-day-old term infant has central cyanosis but is feeding well.
        </p>
        <ul class="list-disc list-inside text-sm space-y-1 mb-3">
          <li>HR 150/min, RR 60/min, BP 70/40 mmHg</li>
          <li>Warm extremities, brisk capillary refill</li>
          <li>Good femoral and brachial pulses</li>
          <li>SpO₂ 78% in room air, minimal work of breathing</li>
        </ul>
        <p class="text-sm text-sky-300">
          → Pattern: <span class="font-semibold">Blue infant</span> with good perfusion → suspect ductal-dependent <span class="font-semibold">pulmonary</span> lesion.
        </p>
    `),
  },
  {
    id: "case2_question",
    index: 5,
    type: "question",
    html: slideWrapper(`
        <h2 class="text-2xl font-semibold mb-4">
          Case 2 – Underlying Lesion Pattern
        </h2>
        <p class="text-sm mb-3">
          Answer on your phone. Focus on the pattern rather than exact anatomy.
        </p>
    `),
    questionId: "q_blue_pulmonary",
  },
];

const questions: Question[] = [
  {
    id: "q_pge_gray_infant",
    stem: `A 30-hour-old term infant presents with poor feeding, mottling, and lethargy.
Vitals: HR 180/min, RR 70/min, BP 55/35 mmHg. Extremities are cool with capillary refill 5–6 seconds.
Brachial pulses are present but femoral pulses are weak. Oxygen saturation is 96% in room air.
You suspect a ductal-dependent systemic lesion (e.g., critical coarctation of the aorta).

Which of the following is the most appropriate initial pharmacologic intervention?`,
    options: [
      "Start prostaglandin E1 at 0.05 mcg/kg/min IV infusion",
      "Give a 20 mL/kg normal saline bolus over 20 minutes",
      "Start dopamine at 10 mcg/kg/min IV infusion",
      "Intubate and provide 100% oxygen without other therapy",
    ],
    correctIndex: 0,
    explanation:
      "This is a classic gray infant with shock, weak femoral pulses, and near-normal oxygen saturation, suggesting a ductal-dependent systemic lesion such as critical coarctation. The life-saving step is to reopen the ductus with prostaglandin E1. Fluids, inotropes, and intubation may be needed, but PGE1 is the board-correct first pharmacologic intervention.",
  },
  {
    id: "q_blue_pulmonary",
    stem: `A 3-day-old term infant has central cyanosis but remains well perfused with warm extremities and brisk capillary refill.
Femoral and brachial pulses are strong. Oxygen saturation is 78% in room air, and there is minimal work of breathing.

Which of the following patterns best describes this presentation?`,
    options: [
      "Ductal-dependent systemic lesion causing cardiogenic shock",
      "Ductal-dependent pulmonary lesion due to right-sided outflow obstruction",
      "Primary persistent pulmonary hypertension with right-to-left shunt at the patent foramen ovale",
      "Septic shock with distributive physiology",
    ],
    correctIndex: 1,
    explanation:
      "A cyanotic but well-perfused infant with good pulses and low saturation suggests a ductal-dependent pulmonary lesion (right-sided obstructive lesion) rather than systemic shock. Sepsis and PPHN can also cause hypoxemia, but the warm, well-perfused extremities and stable blood pressure favor a structural right-sided outflow obstruction pattern for exam purposes.",
  },
];

export function createInitialSessionData(): SessionData {
  const now = new Date().toISOString();
  const joinCode = Math.random().toString(36).substring(2, 6).toUpperCase();

  return {
    title: "Ductal-Dependent Lesions – Demo Session",
    joinCode,
    currentSlideIndex: 0,
    currentQuestionId: null,
    showResults: false,
    slides,
    questions,
    createdAt: now,
  };
}