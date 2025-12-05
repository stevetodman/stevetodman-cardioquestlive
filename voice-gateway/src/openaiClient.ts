import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
let warned = false;
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (!warned) {
      console.warn("[voice-gateway] OPENAI_API_KEY is not set. Falling back to stub patient behavior.");
      warned = true;
    }
    return null;
  }
  client = new OpenAI({ apiKey });
  return client;
}

export { MODEL };
