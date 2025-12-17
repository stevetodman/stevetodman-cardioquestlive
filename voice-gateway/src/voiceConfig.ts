/**
 * Voice Configuration - Single Source of Truth
 *
 * OpenAI TTS Voices Available:
 * - Standard: alloy, echo, fable, onyx, nova, shimmer
 * - Natural: coral, sage, verse, ballad (newer, more expressive)
 *
 * Character voice defaults chosen for distinctiveness and role appropriateness:
 * - patient: coral (warm, approachable)
 * - parent: nova (concerned, nurturing)
 * - nurse: sage (calm, professional)
 * - tech: verse (neutral, informative)
 * - consultant: ballad (authoritative, thoughtful)
 * - imaging: shimmer (clear, technical)
 */

import type { CharacterId } from "./messageTypes";

/**
 * Default voice assignments for each character.
 * Can be overridden via environment variables.
 */
const DEFAULT_VOICES: Record<CharacterId, string> = {
  patient: "coral",
  parent: "nova",
  nurse: "sage",
  tech: "verse",
  consultant: "ballad",
  imaging: "shimmer",
};

/**
 * Character voice map with environment variable overrides.
 * Use OPENAI_TTS_VOICE_<CHARACTER> to override defaults.
 */
export const CHARACTER_VOICES: Record<CharacterId, string> = {
  patient: process.env.OPENAI_TTS_VOICE_PATIENT || DEFAULT_VOICES.patient,
  parent: process.env.OPENAI_TTS_VOICE_PARENT || DEFAULT_VOICES.parent,
  nurse: process.env.OPENAI_TTS_VOICE_NURSE || DEFAULT_VOICES.nurse,
  tech: process.env.OPENAI_TTS_VOICE_TECH || DEFAULT_VOICES.tech,
  consultant: process.env.OPENAI_TTS_VOICE_CONSULTANT || DEFAULT_VOICES.consultant,
  imaging: process.env.OPENAI_TTS_VOICE_IMAGING || DEFAULT_VOICES.imaging,
};

/**
 * Get the voice for a character, with optional override.
 */
export function getVoiceForCharacter(character: CharacterId, override?: string): string {
  return override ?? CHARACTER_VOICES[character] ?? DEFAULT_VOICES.patient;
}

/**
 * List of all valid OpenAI TTS voices for validation.
 */
export const VALID_TTS_VOICES = [
  "alloy", "echo", "fable", "onyx", "nova", "shimmer", // Standard
  "coral", "sage", "verse", "ballad", // Natural
] as const;

export type TTSVoice = typeof VALID_TTS_VOICES[number];
