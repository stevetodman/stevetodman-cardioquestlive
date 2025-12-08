import { PatientCase, PatientScenarioId, createDefaultPatientCase } from "./patientCase";
import { buildPatientSystemPrompt, buildNursePrompt, buildTechPrompt, buildConsultantPrompt, buildParentPrompt } from "./patientPersona";
import { CharacterId } from "./messageTypes";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type EngineState = {
  caseData: PatientCase;
  history: ChatMessage[];
};

const engines = new Map<string, EngineState>();
const sessionScenarios = new Map<string, PatientScenarioId>();
const MAX_HISTORY = 12;
const CHARACTER_PROMPTS: Record<CharacterId, string> = {
  patient: "",
  parent: buildParentPrompt(),
  nurse: buildNursePrompt(),
  tech: buildTechPrompt(),
  consultant: buildConsultantPrompt(),
  imaging: "You are an imaging tech providing succinct study updates and summaries.",
};

function trimHistory(history: ChatMessage[]): ChatMessage[] {
  // Keep system + last N turns
  if (history.length <= MAX_HISTORY) return history;
  const system = history.find((m) => m.role === "system");
  const rest = history.filter((m) => m.role !== "system");
  const trimmed = rest.slice(-MAX_HISTORY);
  return system ? [system, ...trimmed] : trimmed;
}

export function setScenarioForSession(sessionId: string, scenarioId: PatientScenarioId) {
  sessionScenarios.set(sessionId, scenarioId);
  engines.delete(sessionId);
}

export function getScenarioForSession(sessionId: string): PatientScenarioId {
  return sessionScenarios.get(sessionId) ?? "exertional_chest_pain";
}

export function getOrCreatePatientEngine(sessionId: string) {
  if (!engines.has(sessionId)) {
    const scenario = getScenarioForSession(sessionId);
    const caseData = createDefaultPatientCase(sessionId, scenario);
    const systemPrompt = buildPatientSystemPrompt(caseData);
    engines.set(sessionId, {
      caseData,
      history: [{ role: "system", content: systemPrompt }],
    });
  }
  return {
    getCase(): PatientCase {
      return engines.get(sessionId)!.caseData;
    },
    getHistory(): ChatMessage[] {
      return engines.get(sessionId)!.history;
    },
    appendDoctorTurn(text: string) {
      const state = engines.get(sessionId);
      if (!state) return;
      state.history.push({ role: "user", content: text });
      state.history = trimHistory(state.history);
    },
    appendPatientTurn(text: string) {
      const state = engines.get(sessionId);
      if (!state) return;
      state.history.push({ role: "assistant", content: text });
      state.history = trimHistory(state.history);
    },
    reset() {
      engines.delete(sessionId);
    },
  };
}

export function getPersonaPrompt(character: CharacterId, caseData?: PatientCase): ChatMessage {
  if (character === "patient" && caseData) {
    return { role: "system", content: buildPatientSystemPrompt(caseData) };
  };
  const prompt = CHARACTER_PROMPTS[character] || "Respond briefly and helpfully.";
  return { role: "system", content: prompt };
}

export type { ChatMessage };
