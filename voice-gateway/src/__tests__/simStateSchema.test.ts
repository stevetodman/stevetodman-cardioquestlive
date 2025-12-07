import { validateSimStateMessage } from "../validators";

describe("validateSimStateMessage", () => {
  it("accepts a valid sim_state payload", () => {
    const msg = validateSimStateMessage({
      stageId: "stage_1_baseline",
      stageIds: ["stage_1_baseline", "stage_2_episode"],
      scenarioId: "palpitations_svt",
      vitals: { hr: 120, bp: "110/70", spo2: 99 },
      findings: ["finding_1"],
      fallback: false,
      budget: { usdEstimate: 1.23, throttled: true, voiceSeconds: 42 },
    });
    expect(msg).toBeTruthy();
    expect(msg?.stageId).toBe("stage_1_baseline");
    expect(msg?.scenarioId).toBe("palpitations_svt");
  });

  it("rejects missing required fields", () => {
    const msg = validateSimStateMessage({
      // stageId missing
      vitals: {},
      fallback: false,
    });
    expect(msg).toBeNull();
  });

  it("rejects invalid vitals types or scenario values", () => {
    const msg = validateSimStateMessage({
      stageId: "stage_1",
      vitals: { hr: "fast" },
      fallback: false,
      scenarioId: "unknown-scenario",
    });
    expect(msg).toBeNull();
  });
});
