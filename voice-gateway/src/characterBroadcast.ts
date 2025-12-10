/**
 * Character broadcast utilities for the voice gateway.
 * Centralizes the pattern of announcing character speech to clients.
 */

import type { SessionManager } from "./sessionManager";
import type { CharacterId } from "./messageTypes";
import { synthesizePatientAudio } from "./ttsClient";
import { log, logError } from "./logger";

// Voice mapping for TTS
export const CHARACTER_VOICE_MAP: Record<CharacterId, string | undefined> = {
  patient: "alloy",
  parent: "nova",
  nurse: "echo",
  tech: "fable",
  consultant: "onyx",
  imaging: "shimmer",
};

export interface CharacterBroadcastDeps {
  sessionManager: SessionManager;
  sessionId: string;
}

/**
 * Broadcast a character speaking with state transitions.
 * Handles: speaking state -> transcript delta -> idle state.
 * Optionally generates TTS audio for presenter-only playback.
 */
export async function broadcastCharacterSpeak(
  deps: CharacterBroadcastDeps,
  character: CharacterId,
  text: string,
  options: { withTts?: boolean } = {}
): Promise<void> {
  const { sessionManager, sessionId } = deps;
  const { withTts = false } = options;

  // Announce speaking state
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_state",
    sessionId,
    state: "speaking",
    character,
  });

  // Send transcript delta
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_transcript_delta",
    sessionId,
    text,
    character,
  });

  // Generate TTS for presenter if requested
  if (withTts) {
    const voice = CHARACTER_VOICE_MAP[character];
    log("TTS for character", character, "voice:", voice, "text:", text.slice(0, 50));
    try {
      const audioBuffer = await synthesizePatientAudio(text, voice);
      if (audioBuffer) {
        log("TTS audio generated", character, "bytes:", audioBuffer.length);
        sessionManager.broadcastToPresenters(sessionId, {
          type: "patient_audio",
          sessionId,
          audioBase64: audioBuffer.toString("base64"),
          character,
        });
      } else {
        log("TTS returned null for", character);
      }
    } catch (err) {
      logError("TTS failed for character", err);
    }
  }

  // Announce idle state
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_state",
    sessionId,
    state: "idle",
    character,
  });
}

/**
 * Broadcast a simple transcript message without state transitions.
 * Use for nurse/tech acknowledgments that don't need full speech flow.
 */
export function broadcastTranscript(
  deps: CharacterBroadcastDeps,
  character: CharacterId,
  text: string
): void {
  const { sessionManager, sessionId } = deps;
  sessionManager.broadcastToSession(sessionId, {
    type: "patient_transcript_delta",
    sessionId,
    text,
    character,
  });
}
