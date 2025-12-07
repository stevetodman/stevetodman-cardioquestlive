import { ToolIntent } from "./types";
import { StageDef } from "./scenarioTypes";

export type ToolGateDecision =
  | { allowed: true; reason?: string }
  | { allowed: false; reason: string };

const VITAL_LIMITS = {
  hr: { min: 30, max: 250 },
  rr: { min: 4, max: 80 },
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
        if (stage?.allowedStages && stage.allowedStages.length > 0 && !stage.allowedStages.includes(intent.stageId)) {
          return { allowed: false, reason: "stage_not_allowed" };
        }
        return { allowed: true };
      }
      case "intent_revealFinding":
        if (!intent.findingId || typeof intent.findingId !== "string") {
          return { allowed: false, reason: "invalid_finding" };
        }
        return { allowed: true };
      case "intent_setEmotion":
        if (!intent.emotion || typeof intent.emotion !== "string") {
          return { allowed: false, reason: "invalid_emotion" };
        }
        return { allowed: true };
      default:
        return { allowed: false, reason: "unknown_intent" };
    }
  }

  private validateVitalsDelta(delta: Record<string, unknown>): boolean {
    const keys = Object.keys(delta);
    for (const key of keys) {
      const value = (delta as any)[key];
      if (value === undefined) return false;
      if (typeof value !== "number") continue;
      const limits = (VITAL_LIMITS as any)[key];
      if (!limits) {
        return false;
      }
      if (value < limits.min - 50 || value > limits.max + 50) {
        return false;
      }
    }
    // disallow empty delta
    if (keys.length === 0) return false;
    return true;
  }
}
