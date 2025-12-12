import { ScenarioEngine } from "../sim/scenarioEngine";
import { createInitialSVTState } from "../sim/scenarios/teen_svt_complex/definition";

describe("ScenarioEngine hydrate", () => {
  test("uses persisted stageEnteredAt to drive time-based transitions after hydrate", () => {
    const engine = new ScenarioEngine("sim-1", "syncope");
    const now = Date.now();
    const past = now - 200_000; // > 180s transition threshold

    engine.hydrate({
      stageId: "stage_1_baseline",
      scenarioId: "syncope",
      vitals: { hr: 90, bp: "110/70", spo2: 99 },
      stageEnteredAt: past,
      updatedAtMs: past,
    });

    const result = engine.tick(now);

    expect(result?.nextState.stageId).toBe("stage_2_worse");
    expect(result?.nextState.stageEnteredAt).toBe(now);
  });

  test("restores telemetry flag and history on hydrate", () => {
    const engine = new ScenarioEngine("sim-2", "syncope");
    const past = Date.now() - 5_000;

    engine.hydrate({
      stageId: "stage_1_baseline",
      scenarioId: "syncope",
      telemetry: true,
      telemetryHistory: [{ ts: past, rhythm: "Sinus 90s" }],
      updatedAtMs: past,
    });

    expect(engine.getState().telemetry).toBe(true);
    expect(engine.getState().telemetryHistory?.length).toBe(1);
    expect(engine.getState().telemetryHistory?.[0].rhythm).toBe("Sinus 90s");
  });
});

describe("ScenarioEngine hydrate with SVT extended state", () => {
  test("preserves extended state when hydrating SVT scenario", () => {
    const engine = new ScenarioEngine("sim-svt-1", "teen_svt_complex_v1");
    const past = Date.now() - 60_000; // 1 minute ago
    const svtExtended = createInitialSVTState(past);

    engine.hydrate({
      stageId: "presentation",
      scenarioId: "teen_svt_complex_v1",
      vitals: { hr: 90, bp: "115/72", spo2: 99, rr: 16 },
      extended: svtExtended,
      updatedAtMs: past,
    });

    const state = engine.getState();
    expect(state.extended).toBeDefined();
    expect(state.extended?.phase).toBe("presentation");
    expect(state.extended?.phaseEnteredAt).toBe(past);
  });

  test("calculates correct elapsed time from persisted phaseEnteredAt", () => {
    const engine = new ScenarioEngine("sim-svt-2", "teen_svt_complex_v1");
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    const svtExtended = createInitialSVTState(threeMinutesAgo);

    engine.hydrate({
      stageId: "presentation",
      scenarioId: "teen_svt_complex_v1",
      vitals: { hr: 90, bp: "115/72", spo2: 99, rr: 16 },
      extended: svtExtended,
      updatedAtMs: threeMinutesAgo,
    });

    const state = engine.getState();
    const now = Date.now();
    const phaseElapsedMs = now - state.extended!.phaseEnteredAt;
    const phaseElapsedMin = phaseElapsedMs / 60000;

    // Should have elapsed > 2 minutes, meaning transition should fire
    expect(phaseElapsedMin).toBeGreaterThanOrEqual(2);
  });

  test("preserves SVT phase when already transitioned", () => {
    const engine = new ScenarioEngine("sim-svt-3", "teen_svt_complex_v1");
    const past = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    const svtExtended = createInitialSVTState(past);
    // Simulate already being in svt_onset phase
    svtExtended.phase = "svt_onset";
    svtExtended.currentRhythm = "svt";

    engine.hydrate({
      stageId: "presentation", // stageId doesn't change phase
      scenarioId: "teen_svt_complex_v1",
      vitals: { hr: 220, bp: "105/68", spo2: 98, rr: 20 },
      extended: svtExtended,
      updatedAtMs: past,
    });

    const state = engine.getState();
    expect(state.extended?.phase).toBe("svt_onset");
    // Type guard for SVT extended state
    if (state.extended && "currentRhythm" in state.extended) {
      expect(state.extended.currentRhythm).toBe("svt");
    }
  });
});
