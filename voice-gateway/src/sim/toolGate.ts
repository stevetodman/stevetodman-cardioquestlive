import { ToolIntent } from "./types";
import { StageDef } from "./scenarioTypes";

export type ToolGateDecision =
  | { allowed: true; reason?: string }
  | { allowed: false; reason: string };

const VITAL_LIMITS = {
  hr: { min: 20, max: 240 },
  rr: { min: 5, max: 80 },
  spo2: { min: 50, max: 100 },
  temp: { min: 90, max: 110 },
};

export class ToolGate {
  private lastVitalsUpdate: Map<string, number> = new Map(); // simId -> timestamp ms

  validate(simId: string, stage: StageDef | undefined, intent: ToolIntent, nowMs = Date.now()): ToolGateDecision {
    // Stage-level allowlist
    if (stage?.allowedIntents && !stage.allowedIntents.includes(intent.type)) {
      return { allowed: false, reason: "intent_not_allowed_in_stage" };
    }

    switch (intent.type) {
      case "intent_updateVitals": {
        const last = this.lastVitalsUpdate.get(simId) ?? 0;
        if (nowMs - last < 10_000) {
          return { allowed: false, reason: "vitals_rate_limited" };
        }
        if (!this.validateVitalsDelta(intent.delta)) {
          return { allowed: false, reason: "invalid_vitals_delta" };
        }
        this.lastVitalsUpdate.set(simId, nowMs);
        return { allowed: true };
      }
      case "intent_advanceStage": {
        if (!intent.stageId) return { allowed: false, reason: "missing_stage" };
        return { allowed: true };
      }
      case "intent_revealFinding":
      case "intent_setEmotion":
        return { allowed: true };
      default:
        return { allowed: false, reason: "unknown_intent" };
    }
  }

  private validateVitalsDelta(delta: Record<string, unknown>): boolean {
    for (const key of Object.keys(delta)) {
      const value = (delta as any)[key];
      if (typeof value !== "number") continue;
      const limits = (VITAL_LIMITS as any)[key];
      if (limits && (value < limits.min - 50 || value > limits.max + 50)) {
        return false;
      }
    }
    return true;
  }
}
