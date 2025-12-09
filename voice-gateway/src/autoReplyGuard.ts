import { CharacterId } from "./messageTypes";
import { isUnsafeUtterance } from "./speechHelpers";

type GuardMaps = {
  lastAutoReplyAt: Map<string, number>;
  lastAutoReplyByUser: Map<string, number>;
  lastDoctorUtterance: Map<string, { text: string; ts: number }>;
};

/**
 * Auto-reply configuration for autonomous simulation mode.
 * These defaults enable fast, natural conversation flow.
 */
const AUTO_REPLY_CONFIG = {
  /** Minimum words required (lowered for short questions like "how are you?") */
  minWords: 2,
  /** Minimum characters required */
  minChars: 6,
  /** Default cooldown between replies (can be overridden by env) */
  defaultCooldownMs: 1000,
  /** Duplicate detection window */
  duplicateWindowMs: 1000,
};

export function shouldAutoReply(opts: {
  sessionId: string;
  userId?: string;
  text: string;
  explicitCharacter?: CharacterId;
  floorHolder?: string | null;
  commandCooldownMs: number;
  maps: GuardMaps;
}): boolean {
  const { sessionId, userId, text, floorHolder, commandCooldownMs, maps } = opts;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Safety guard: block profanity/PII-like patterns
  if (isUnsafeUtterance(trimmed)) return false;

  // Relaxed length guard for natural conversation
  const words = trimmed.split(/\s+/).length;
  if (words < AUTO_REPLY_CONFIG.minWords || trimmed.length < AUTO_REPLY_CONFIG.minChars) {
    return false;
  }

  const now = Date.now();

  // Use faster cooldown for autonomous mode (min 1s to prevent spam)
  const effectiveCooldown = Math.max(commandCooldownMs, AUTO_REPLY_CONFIG.defaultCooldownMs);
  const last = maps.lastAutoReplyAt.get(sessionId) || 0;
  if (now - last < effectiveCooldown) return false;

  // Per-user cooldown (prevents single student from dominating)
  if (userId) {
    const key = `${sessionId}:${userId}`;
    const lastUser = maps.lastAutoReplyByUser.get(key) || 0;
    if (now - lastUser < effectiveCooldown) return false;
    maps.lastAutoReplyByUser.set(key, now);
  }

  // Duplicate detection (shorter window for faster conversation)
  const lastUtter = maps.lastDoctorUtterance.get(sessionId);
  if (lastUtter && lastUtter.text === trimmed && now - lastUtter.ts < AUTO_REPLY_CONFIG.duplicateWindowMs) {
    return false;
  }
  maps.lastDoctorUtterance.set(sessionId, { text: trimmed, ts: now });

  // Floor holder check - but allow if no floor system active
  // This enables multiple students to interact naturally
  if (floorHolder && userId && floorHolder !== userId) {
    // In autonomous mode, we're more permissive - only block if actively speaking
    // The floor holder check is mainly for push-to-talk scenarios
    return false;
  }

  maps.lastAutoReplyAt.set(sessionId, now);
  return true;
}
