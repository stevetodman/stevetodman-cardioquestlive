import { PatientCase, createDefaultPatientCase } from "./patientCase";
import { buildPatientSystemPrompt } from "./patientPersona";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type EngineState = {
  caseData: PatientCase;
  history: ChatMessage[];
};

const engines = new Map<string, EngineState>();
const MAX_HISTORY = 12;

function trimHistory(history: ChatMessage[]): ChatMessage[] {
  // Keep system + last N turns
  if (history.length <= MAX_HISTORY) return history;
  const system = history.find((m) => m.role === "system");
  const rest = history.filter((m) => m.role !== "system");
  const trimmed = rest.slice(-MAX_HISTORY);
  return system ? [system, ...trimmed] : trimmed;
}

export function getOrCreatePatientEngine(sessionId: string) {
  if (!engines.has(sessionId)) {
    const caseData = createDefaultPatientCase(sessionId);
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

export type { ChatMessage };
