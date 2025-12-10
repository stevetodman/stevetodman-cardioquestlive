/**
 * Voice command types, interfaces, and constants.
 * Extracted from usePresenterVoiceCommands for reuse and token efficiency.
 */

import type { VoiceCommandType } from "../../types";
import type { CharacterId } from "./voiceGateway";

// ============================================================================
// Core Types
// ============================================================================

/** Voice command definition with trigger phrases and action details */
export interface VoiceCommandMapping {
  /** Phrases that trigger this command (lowercase, matched via includes) */
  triggers: string[];
  /** The command type to dispatch */
  commandType: VoiceCommandType;
  /** Optional payload for the command */
  payload?: Record<string, unknown>;
  /** Target character for the command */
  character?: CharacterId;
  /** Human-readable label for UI feedback */
  label: string;
  /** Risk level - high risk commands may require confirmation */
  risk: "low" | "medium" | "high";
}

/** Result of smart routing natural language to a character */
export interface SmartRouteResult {
  /** The detected character to route to */
  character: CharacterId;
  /** The extracted question/utterance to pass */
  utterance: string;
  /** Human-readable label for feedback */
  label: string;
}

/** Voice listening states */
export type ListeningState = "idle" | "listening" | "processing" | "error" | "unsupported" | "wake_listening" | "activated";

/** Result of voice command recognition */
export interface VoiceCommandResult {
  /** The transcript that was recognized */
  transcript: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Matched command, if any */
  matchedCommand: VoiceCommandMapping | null;
  /** Whether the command was executed */
  executed: boolean;
  /** Timestamp */
  timestamp: number;
}

/** Wake word configuration for hands-free activation */
export interface WakeWordConfig {
  /** The wake word phrase (e.g., "hey cardio", "okay quest") */
  phrase: string;
  /** How long after wake word activation before it times out (ms, default 10000) */
  timeoutMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Character keywords for smart routing detection */
export const CHARACTER_KEYWORDS: Record<string, CharacterId> = {
  patient: "patient",
  mom: "parent",
  mother: "parent",
  dad: "parent",
  father: "parent",
  parent: "parent",
  nurse: "nurse",
  tech: "tech",
  technician: "tech",
  imaging: "imaging",
  radiology: "imaging",
  consultant: "consultant",
  cardiology: "consultant",
  cardiologist: "consultant",
};

/** Patterns for detecting questions/requests to characters */
export const SMART_ROUTE_PATTERNS: RegExp[] = [
  // "ask the patient about X" / "ask patient X"
  /ask\s+(?:the\s+)?(\w+)\s+(?:about\s+)?(.+)/i,
  // "tell the nurse to X" / "have the nurse X"
  /(?:tell|have)\s+(?:the\s+)?(\w+)\s+(?:to\s+)?(.+)/i,
  // "patient, X" (direct address)
  /^(\w+),\s*(.+)/i,
  // "what does the patient say about X"
  /what\s+(?:does|did)\s+(?:the\s+)?(\w+)\s+(?:say|think)\s+(?:about\s+)?(.+)/i,
  // "can the nurse X" / "could the tech X"
  /(?:can|could|would)\s+(?:the\s+)?(\w+)\s+(.+)/i,
];

/**
 * Default command mappings - spoken phrases to system commands.
 * Ordered by specificity (more specific phrases first).
 */
export const DEFAULT_VOICE_COMMANDS: VoiceCommandMapping[] = [
  // AI control
  { triggers: ["pause", "pause ai", "stop ai", "hold on"], commandType: "pause_ai", label: "Pause AI", risk: "low" },
  { triggers: ["resume", "resume ai", "continue", "go ahead"], commandType: "resume_ai", label: "Resume AI", risk: "low" },
  { triggers: ["end turn", "stop turn", "cut off"], commandType: "end_turn", label: "End Turn", risk: "medium" },

  // Force reply variants
  { triggers: ["force reply", "reply now", "respond", "patient respond", "answer that"], commandType: "force_reply", label: "Force Reply", risk: "low" },

  // Nurse commands
  { triggers: ["get vitals", "check vitals", "vitals please", "grab vitals"], commandType: "force_reply", payload: { doctorUtterance: "Please grab a fresh set of vitals." }, character: "nurse", label: "Nurse: Vitals", risk: "low" },
  { triggers: ["order labs", "get labs", "labs please", "draw labs"], commandType: "order", payload: { orderType: "labs" }, character: "nurse", label: "Order Labs", risk: "low" },
  { triggers: ["give oxygen", "start oxygen", "o2", "oxygen please"], commandType: "treatment", payload: { treatmentType: "oxygen" }, character: "nurse", label: "Give Oxygen", risk: "low" },
  { triggers: ["fluids", "bolus", "give fluids", "fluid bolus"], commandType: "treatment", payload: { treatmentType: "fluids" }, character: "nurse", label: "Fluids Bolus", risk: "low" },
  { triggers: ["knee chest", "knee-chest", "position knee chest"], commandType: "treatment", payload: { treatmentType: "knee-chest" }, character: "nurse", label: "Knee-Chest Position", risk: "low" },
  { triggers: ["rate control", "give rate control", "slow the rate"], commandType: "treatment", payload: { treatmentType: "rate-control" }, character: "nurse", label: "Rate Control", risk: "medium" },
  { triggers: ["bedside exam", "do exam", "examine patient", "physical exam"], commandType: "exam", character: "nurse", label: "Bedside Exam", risk: "low" },

  // Tech commands
  { triggers: ["get ekg", "order ekg", "ekg please", "12 lead", "twelve lead"], commandType: "order", payload: { orderType: "ekg" }, character: "tech", label: "Order EKG", risk: "low" },
  { triggers: ["show ekg", "display ekg", "pull up ekg"], commandType: "show_ekg", character: "tech", label: "Show EKG", risk: "low" },
  { triggers: ["start telemetry", "telemetry on", "put on monitor"], commandType: "toggle_telemetry", payload: { enabled: true }, character: "tech", label: "Start Telemetry", risk: "low" },
  { triggers: ["order imaging", "get imaging", "x-ray", "chest x-ray", "imaging please"], commandType: "order", payload: { orderType: "imaging" }, character: "tech", label: "Order Imaging", risk: "low" },

  // Consultant
  { triggers: ["call cardiology", "page cardiology", "consult cardiology", "call consultant", "get consultant"], commandType: "force_reply", payload: { doctorUtterance: "Please join at bedside for cardiology consult." }, character: "consultant", label: "Call Consultant", risk: "low" },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Try to extract a smart route from natural language.
 * Returns null if no pattern matches.
 */
export function extractSmartRoute(transcript: string): SmartRouteResult | null {
  const lower = transcript.toLowerCase().trim();

  for (const pattern of SMART_ROUTE_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const [, characterWord, content] = match;
      const character = CHARACTER_KEYWORDS[characterWord.toLowerCase()];

      if (character && content && content.length > 2) {
        // Clean up the content
        const utterance = content
          .replace(/\?$/, "") // Remove trailing question mark
          .trim();

        return {
          character,
          utterance,
          label: `Ask ${character}: "${utterance.slice(0, 30)}${utterance.length > 30 ? "..." : ""}"`,
        };
      }
    }
  }

  return null;
}

/**
 * Find the best matching command for a transcript.
 * Returns the first matching command or null.
 */
export function matchVoiceCommand(
  transcript: string,
  commands: VoiceCommandMapping[] = DEFAULT_VOICE_COMMANDS
): VoiceCommandMapping | null {
  const lower = transcript.toLowerCase().trim();

  for (const cmd of commands) {
    for (const trigger of cmd.triggers) {
      if (lower.includes(trigger)) {
        return cmd;
      }
    }
  }

  return null;
}
