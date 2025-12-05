import { getOpenAIClient, MODEL } from "./openaiClient";
import { DebriefTurn } from "./messageTypes";
import { log, logError } from "./logger";

const DEBRIEF_MODEL = process.env.OPENAI_DEBRIEF_MODEL || MODEL;

type DebriefResult = {
  summary: string;
  strengths: string[];
  opportunities: string[];
  teachingPoints: string[];
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

export type { DebriefResult };
