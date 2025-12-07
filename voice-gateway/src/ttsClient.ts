import { Buffer } from "buffer";
import { getOpenAIClient } from "./openaiClient";
import { log, logError } from "./logger";

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";

export async function synthesizePatientAudio(text: string, voiceOverride?: string): Promise<Buffer | null> {
  const client = getOpenAIClient();
  if (!client) {
    log("TTS skipped: OPENAI_API_KEY not set");
    return null;
  }

  try {
    const response = await client.audio.speech.create({
      model: TTS_MODEL,
      voice: voiceOverride || TTS_VOICE,
      input: text,
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    logError("TTS synthesis failed", err);
    return null;
  }
}
