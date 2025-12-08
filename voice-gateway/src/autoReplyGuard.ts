import { CharacterId } from "./messageTypes";
import { isUnsafeUtterance } from "./speechHelpers";

type GuardMaps = {
  lastAutoReplyAt: Map<string, number>;
  lastAutoReplyByUser: Map<string, number>;
  lastDoctorUtterance: Map<string, { text: string; ts: number }>;
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

  // Zero-latency local safety guard: block known profanity/PII-like patterns.
  if (isUnsafeUtterance(trimmed)) return false;

  // Minimal length guard
  const words = trimmed.split(/\s+/).length;
  if (words < 3 || trimmed.length < 12) return false;

  const now = Date.now();
  const last = maps.lastAutoReplyAt.get(sessionId) || 0;
  if (now - last < commandCooldownMs) return false;

  if (userId) {
    const key = `${sessionId}:${userId}`;
    const lastUser = maps.lastAutoReplyByUser.get(key) || 0;
    if (now - lastUser < commandCooldownMs) return false;
    maps.lastAutoReplyByUser.set(key, now);
  }

  const lastUtter = maps.lastDoctorUtterance.get(sessionId);
  if (lastUtter && lastUtter.text === trimmed && now - lastUtter.ts < 1500) {
    return false;
  }
  maps.lastDoctorUtterance.set(sessionId, { text: trimmed, ts: now });

  if (floorHolder && userId && floorHolder !== userId) {
    return false;
  }

  maps.lastAutoReplyAt.set(sessionId, now);
  return true;
}
