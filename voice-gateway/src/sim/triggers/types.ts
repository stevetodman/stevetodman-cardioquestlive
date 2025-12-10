/**
 * Shared trigger types for scenario-based NPC interjections.
 *
 * These types define the structure for deterministic character lines
 * that fire based on scenario state conditions. The lines are NOT AI-generated -
 * they are safety-critical clinical information.
 *
 * @template TState - The extended state type for the specific scenario
 */

// ============================================================================
// Priority & History
// ============================================================================

export type TriggerPriority = "critical" | "high" | "normal";

export type TriggerHistory = Record<string, { lastFired: number; fireCount: number }>;

// ============================================================================
// Generic Trigger Types
// ============================================================================

export type BaseTrigger<TState> = {
  id: string;
  condition: (state: TState, elapsedMs: number) => boolean;
  line: string;
  cooldownMs: number;
  maxFires?: number;
};

export type NurseTrigger<TState> = BaseTrigger<TState> & {
  priority: TriggerPriority;
};

export type ParentTrigger<TState> = BaseTrigger<TState>;

export type PatientTrigger<TState> = BaseTrigger<TState>;

// ============================================================================
// Fired Trigger Result
// ============================================================================

export type FiredTrigger = {
  triggerId: string;
  character: "nurse" | "parent" | "patient";
  line: string;
  priority: TriggerPriority;
};

// ============================================================================
// Trigger Evaluation Utilities
// ============================================================================

/**
 * Check if a trigger should fire based on cooldown and fire count.
 */
export function shouldFireTrigger<TState>(
  trigger: BaseTrigger<TState>,
  history: TriggerHistory,
  now: number
): boolean {
  const record = history[trigger.id];
  if (!record) return true;

  // Check max fires
  if (trigger.maxFires !== undefined && record.fireCount >= trigger.maxFires) {
    return false;
  }

  // Check cooldown
  if (now - record.lastFired < trigger.cooldownMs) {
    return false;
  }

  return true;
}

/**
 * Record that a trigger has fired.
 */
export function recordTriggerFire(
  history: TriggerHistory,
  triggerId: string,
  now: number
): TriggerHistory {
  const existing = history[triggerId];
  return {
    ...history,
    [triggerId]: {
      lastFired: now,
      fireCount: (existing?.fireCount ?? 0) + 1,
    },
  };
}
