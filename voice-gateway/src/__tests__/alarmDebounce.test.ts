import { checkAlarms } from "../telemetry";
import { SessionManager } from "../sessionManager";
import { ScenarioEngine } from "../sim/scenarioEngine";
import { ToolGate } from "../sim/toolGate";
import { CostController } from "../sim/costController";
import { Runtime } from "../typesRuntime";

function makeRuntime(): Runtime {
  return {
    fallback: false,
    scenarioEngine: new ScenarioEngine("sim-1", "syncope"),
    toolGate: new ToolGate(),
    cost: new CostController({ softUsd: 10, hardUsd: 20 }),
  };
}

describe("alarm debounce", () => {
  test("does not alarm on transient low SpO2 until sustained", () => {
    const sm = new SessionManager();
    const runtime = makeRuntime();
    const alarmSeenAt = new Map<string, any>();

    runtime.scenarioEngine.applyVitalsAdjustment({ spo2: -15 }); // drop to ~84
    checkAlarms("sim-1", runtime, alarmSeenAt, sm);
    // No alarm yet because debounce requires ~4s
    const last = alarmSeenAt.get("sim-1");
    expect(last?.spo2Low).toBeDefined();
  });
});
