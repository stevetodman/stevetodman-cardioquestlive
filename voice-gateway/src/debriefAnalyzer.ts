import { getOpenAIClient, MODEL } from "./openaiClient";
import { DebriefTurn } from "./messageTypes";
import { log, logError } from "./logger";
import type { MyocarditisExtendedState } from "./sim/types";
import { calculateScore, type ScoreResult } from "./sim/scenarios/peds_myocarditis_silent_crash/scoring";

const DEBRIEF_MODEL = process.env.OPENAI_DEBRIEF_MODEL || MODEL;

type DebriefResult = {
  summary: string;
  strengths: string[];
  opportunities: string[];
  teachingPoints: string[];
};

// Extended debrief result for complex scenarios
export type ComplexDebriefResult = DebriefResult & {
  passed: boolean;
  grade: "A" | "B" | "C" | "D" | "F";
  checklistScore: string;
  checklistResults: {
    description: string;
    achieved: boolean;
    explanation: string;
  }[];
  bonuses: { description: string; points: number }[];
  penalties: { description: string; points: number }[];
  totalPoints: number;
  timeline: TimelineEvent[];
  scenarioSpecificFeedback: string[];
};

export type TimelineEvent = {
  timeMs: number;
  timeFormatted: string;
  type: string;
  description: string;
  isGood?: boolean;
  isBad?: boolean;
};

export async function analyzeTranscript(turns: DebriefTurn[]): Promise<DebriefResult> {
  const client = getOpenAIClient();
  if (!client) {
    log("Debrief skipped: OPENAI_API_KEY not set");
    return fallbackResult("Debrief unavailable (no OpenAI API key).");
  }

  const transcriptText = turns
    .map((t) => `${t.role === "doctor" ? "Doctor" : "Patient"}: ${t.text}`)
    .join("\n");

  const system = `
You are a pediatric cardiology attending evaluating a resident’s clinical interview with a standardized patient.
Given the transcript, produce concise JSON feedback:
- summary: 2–3 sentences describing the encounter.
- strengths: 3–6 bullets of what went well (content and communication).
- opportunities: 3–6 bullets of missing or weak areas (key history domains, clarity, organization).
- teachingPoints: 3–6 short, high-yield teaching reminders (e.g., exertional vs non-exertional chest pain, syncope characterization, family history red flags).
Focus on clinical content and structure, not grammar. Keep bullets specific and relevant.
Return only JSON with keys: summary, strengths, opportunities, teachingPoints.
  `.trim();

  const user = `Transcript:\n${transcriptText}`;

  try {
    const completion = await client.chat.completions.create({
      model: DEBRIEF_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" } as any,
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary ?? "",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      teachingPoints: Array.isArray(parsed.teachingPoints) ? parsed.teachingPoints : [],
    };
  } catch (err) {
    logError("Debrief analysis failed", err);
    return fallbackResult("Debrief unavailable due to an error.");
  }
}

function fallbackResult(summary: string): DebriefResult {
  return {
    summary,
    strengths: [],
    opportunities: [],
    teachingPoints: [],
  };
}

// ============================================================================
// Complex Scenario Debrief (Myocarditis)
// ============================================================================

/**
 * Analyze a complex scenario session with timeline, scoring, and AI feedback
 */
export async function analyzeComplexScenario(
  turns: DebriefTurn[],
  extendedState: MyocarditisExtendedState,
  scenarioStartTime: number
): Promise<ComplexDebriefResult> {
  // Calculate deterministic score
  const elapsedMs = Date.now() - scenarioStartTime;
  const scoreResult = calculateScore(extendedState, elapsedMs);

  // Build timeline from extended state
  const timeline = buildTimeline(extendedState, scenarioStartTime);

  // Get AI-generated feedback
  const aiResult = await analyzeMyocarditisTranscript(turns, extendedState, scoreResult);

  return {
    // AI-generated parts
    summary: aiResult.summary,
    strengths: aiResult.strengths,
    opportunities: aiResult.opportunities,
    teachingPoints: aiResult.teachingPoints,

    // Deterministic parts
    passed: scoreResult.passed,
    grade: scoreResult.grade,
    checklistScore: scoreResult.checklistScore,
    checklistResults: scoreResult.checklistResults.map((r) => ({
      description: r.item.description,
      achieved: r.achieved,
      explanation: r.item.explanation,
    })),
    bonuses: scoreResult.bonusesEarned.map((b) => ({
      description: b.item.description,
      points: b.points,
    })),
    penalties: scoreResult.penaltiesIncurred.map((p) => ({
      description: p.item.description,
      points: p.points,
    })),
    totalPoints: scoreResult.totalPoints,
    timeline,
    scenarioSpecificFeedback: scoreResult.feedback,
  };
}

/**
 * Build a formatted timeline from extended state events
 */
function buildTimeline(
  state: MyocarditisExtendedState,
  scenarioStartTime: number
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const event of state.timelineEvents) {
    const relativeMs = event.ts - scenarioStartTime;
    events.push({
      timeMs: relativeMs,
      timeFormatted: formatTime(relativeMs),
      type: event.type,
      description: event.description,
      isGood: isPositiveEvent(event.type, event.description),
      isBad: isNegativeEvent(event.type, event.description),
    });
  }

  // Sort by time
  events.sort((a, b) => a.timeMs - b.timeMs);

  return events;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isPositiveEvent(type: string, description: string): boolean {
  const positivePatterns = [
    /consult.*called/i,
    /ecg.*ordered/i,
    /troponin.*ordered/i,
    /bnp.*ordered/i,
    /epi.*started/i,
    /stabiliz/i,
    /hfnc.*started/i,
    /ketamine/i,
  ];
  return positivePatterns.some((p) => p.test(description));
}

function isNegativeEvent(type: string, description: string): boolean {
  const negativePatterns = [
    /fluid.*overload/i,
    /propofol/i,
    /collapse/i,
    /code.*blue/i,
    /deteriorat/i,
    /crash/i,
    /hypotension/i,
  ];
  return negativePatterns.some((p) => p.test(description));
}

/**
 * AI analysis tailored for myocarditis scenario
 */
async function analyzeMyocarditisTranscript(
  turns: DebriefTurn[],
  state: MyocarditisExtendedState,
  scoreResult: ScoreResult
): Promise<DebriefResult> {
  const client = getOpenAIClient();
  if (!client) {
    log("Debrief skipped: OPENAI_API_KEY not set");
    return fallbackResult("Debrief unavailable (no OpenAI API key).");
  }

  const transcriptText = turns
    .map((t) => `${t.role === "doctor" ? "Resident" : capitalize(t.role)}: ${t.text}`)
    .join("\n");

  // Build context about what happened
  const contextSummary = buildContextSummary(state, scoreResult);

  const system = `
You are a pediatric emergency medicine attending evaluating a resident's management of acute fulminant myocarditis in a 10-year-old.

SCENARIO CONTEXT:
${contextSummary}

Given the transcript and scenario data, produce concise JSON feedback:
- summary: 2–3 sentences describing the encounter and outcome.
- strengths: 3–6 bullets of what went well (clinical decisions, team communication, crisis management).
- opportunities: 3–6 bullets of missed opportunities or errors (fluid management, airway decisions, timing of consults).
- teachingPoints: 3–6 high-yield teaching points specific to pediatric myocarditis and cardiogenic shock (e.g., why ketamine over propofol, fluid restriction in cardiogenic shock, early inotropes).

Focus on clinical decision-making, team communication, and crisis management. Keep bullets specific.
Return only JSON with keys: summary, strengths, opportunities, teachingPoints.
  `.trim();

  const user = `Transcript:\n${transcriptText}`;

  try {
    const completion = await client.chat.completions.create({
      model: DEBRIEF_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" } as any,
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary ?? "",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      teachingPoints: Array.isArray(parsed.teachingPoints) ? parsed.teachingPoints : [],
    };
  } catch (err) {
    logError("Myocarditis debrief analysis failed", err);
    return fallbackResult("Debrief analysis error.");
  }
}

function buildContextSummary(state: MyocarditisExtendedState, scoreResult: ScoreResult): string {
  const parts: string[] = [];

  parts.push(`Patient: Jordan, 10-year-old, 32kg, post-viral fulminant myocarditis`);
  parts.push(`Outcome: ${scoreResult.passed ? "PASSED" : "DID NOT PASS"} (${scoreResult.checklistScore})`);
  parts.push(`Final shock stage: ${state.shockStage}/5`);
  parts.push(`Total fluids given: ${state.totalFluidsMlKg.toFixed(0)} mL/kg`);

  if (state.activeInotropes.length > 0) {
    const inotropeList = state.activeInotropes.map((i) => `${i.drug} ${i.doseMcgKgMin} mcg/kg/min`);
    parts.push(`Inotropes: ${inotropeList.join(", ")}`);
  } else {
    parts.push(`No inotropes started`);
  }

  if (state.airway) {
    if (state.airway.type === "intubation") {
      const agent = state.airway.details?.inductionAgent || "unknown";
      parts.push(`Intubated with ${agent}`);
      if (state.flags.intubationCollapse) {
        parts.push(`POST-INTUBATION HEMODYNAMIC COLLAPSE OCCURRED`);
      }
    } else {
      parts.push(`On HFNC`);
    }
  }

  parts.push(`Consults called: ${state.consultsCalled.join(", ") || "none"}`);

  if (state.flags.pulmonaryEdema) {
    parts.push(`DEVELOPED PULMONARY EDEMA from fluid overload`);
  }

  if (state.flags.codeBlueActive) {
    parts.push(`CARDIAC ARREST OCCURRED`);
  }

  return parts.join("\n");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export type { DebriefResult };
