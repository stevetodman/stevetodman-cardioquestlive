import { ScenarioEngine } from "../scenarioEngine";
import { ToolGate } from "../toolGate";
import { ToolIntent } from "../types";

describe("ScenarioEngine automatic transitions", () => {
  it("advances stage on time_elapsed transition", () => {
    const engine = new ScenarioEngine("sim-1", "syncope");
    // Force stageEnteredAt in the past to satisfy time_elapsed >= 180s
    (engine as any).state.stageEnteredAt = Date.now() - 200 * 1000;
    const result = engine.evaluateAutomaticTransitions();
    expect(result?.nextState.stageId).toBe("stage_2_worse");
    expect(result?.events?.[0]?.type).toBe("scenario.transition");
  });

  it("honors action-based transitions", () => {
    const engine = new ScenarioEngine("sim-2", "syncope");
    const result = engine.evaluateAutomaticTransitions(["asked_about_exertion"], Date.now());
    expect(result?.nextState.stageId).toBe("stage_2_worse");
  });
});

describe("ToolGate validation", () => {
  const gate = new ToolGate();

  it("rejects vitals deltas with unknown keys", () => {
    const decision = gate.validate(
      "sim-1",
      undefined,
      { type: "intent_updateVitals", delta: { unknown: 10 } as any },
      Date.now()
    );
    expect(decision.allowed).toBe(false);
    expect((decision as any).reason).toBe("invalid_vitals_delta");
  });

  it("rejects unknown intent type", () => {
    const decision = gate.validate("sim-1", undefined, { type: "intent_unknown" } as any, Date.now());
    expect(decision.allowed).toBe(false);
  });

  it("rejects revealFinding without an id", () => {
    const decision = gate.validate(
      "sim-1",
      undefined,
      { type: "intent_revealFinding", findingId: "" } as any,
      Date.now()
    );
    expect(decision.allowed).toBe(false);
    expect((decision as any).reason).toBe("invalid_finding");
  });

  it("rejects setEmotion without emotion string", () => {
    const decision = gate.validate(
      "sim-1",
      undefined,
      { type: "intent_setEmotion", emotion: "" } as any,
      Date.now()
    );
    expect(decision.allowed).toBe(false);
    expect((decision as any).reason).toBe("invalid_emotion");
  });
});
