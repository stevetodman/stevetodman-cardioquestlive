import { httpsCallable } from "firebase/functions";
import { ensureSignedIn, functions, isConfigured } from "../firebase";

type GeminiPayload = {
  text: string;
  candidates?: unknown;
  model: string;
};

export async function generateGeminiContent(
  prompt: string,
  model = "gemini-2.0-flash"
): Promise<GeminiPayload> {
  if (!isConfigured || !functions) {
    throw new Error("Gemini requests require Firebase configuration.");
  }

  if (!prompt?.trim()) {
    throw new Error("Prompt must be a non-empty string.");
  }

  await ensureSignedIn();
  const callable = httpsCallable(functions, "generateGeminiContent");
  const response = await callable({ prompt, model });
  return response.data as GeminiPayload;
}
