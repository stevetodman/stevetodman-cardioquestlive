import { sanitizePersistedState } from "../persistence";

describe("sanitizePersistedState", () => {
  test("drops invalid shape and returns timestamp only", () => {
    const bad = { stageId: 123, vitals: "oops" };
    const ts = Date.now();
    const result = sanitizePersistedState(bad as any, ts);
    expect(result.updatedAtMs).toBe(ts);
    expect((result as any).stageId).toBeUndefined();
  });

  test("keeps valid fields", () => {
    const raw = {
      stageId: "stage_1",
      scenarioId: "syncope",
      vitals: { hr: 90, bp: "100/60" },
      telemetry: true,
    };
    const ts = Date.now();
    const result = sanitizePersistedState(raw, ts);
    expect(result.stageId).toBe("stage_1");
    expect(result.telemetry).toBe(true);
    expect(result.vitals?.bp).toBe("100/60");
  });
});
