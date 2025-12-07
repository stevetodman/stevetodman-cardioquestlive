import { ScenarioEngine } from "../sim/scenarioEngine";

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
