import { Buffer } from "buffer";
import { getOpenAIClient } from "./openaiClient";
import { log, logError } from "./logger";

const STT_MODEL = process.env.OPENAI_STT_MODEL || "whisper-1";

export async function transcribeDoctorAudio(
  audioBuffer: Buffer,
  contentType: string
): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) {
    log("STT skipped: OPENAI_API_KEY not set");
    return null;
  }
  if (!STT_MODEL) {
    log("STT skipped: OPENAI_STT_MODEL not configured");
    return null;
  }

  try {
    const file = {
      data: audioBuffer,
      name: `doctor-audio.${contentType.split("/")[1] || "webm"}`,
      type: contentType,
    };
    const result = await client.audio.transcriptions.create({
      file,
      model: STT_MODEL,
    } as any);
    const text: string | undefined = (result as any)?.text;
    if (!text) {
      log("STT returned empty text");
      return null;
    }
    return text;
  } catch (err) {
    logError("STT transcription failed", err);
    return null;
  }
}
