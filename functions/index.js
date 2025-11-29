const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

function getGeminiClient() {
  const key =
    process.env.GEMINI_API_KEY ||
    functions.config()?.gemini?.api_key;
  if (!key) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Gemini API key is not configured. Set process.env.GEMINI_API_KEY or firebase functions:config:set gemini.api_key=YOUR_KEY"
    );
  }
  return new GoogleGenerativeAI(key);
}

exports.generateGeminiContent = functions
  .region("us-central1")
  .runWith({ memory: "512MB", timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign-in required before calling Gemini."
      );
    }

    const prompt = typeof data?.prompt === "string" ? data.prompt.trim() : "";
    const modelId =
      typeof data?.model === "string" && data.model.length > 0
        ? data.model
        : "gemini-2.0-flash";

    if (!prompt) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "prompt must be a non-empty string"
      );
    }

    try {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: modelId });
      const result = await model.generateContent(prompt);
      const candidates = result?.response?.candidates ?? [];
      const text = result?.response?.text?.() ?? "";

      return {
        text,
        candidates,
        model: modelId,
      };
    } catch (error) {
      console.error("Gemini call failed", error);
      throw new functions.https.HttpsError(
        "internal",
        "Gemini request failed"
      );
    }
  });
