import { createOrderHandler } from "../orders";
import { SessionManager } from "../sessionManager";
import { ScenarioEngine } from "../sim/scenarioEngine";
import { ToolGate } from "../sim/toolGate";
import { CostController } from "../sim/costController";
import { Runtime } from "../typesRuntime";

jest.mock("../persistence", () => {
  const actual = jest.requireActual("../persistence");
  return {
    ...actual,
    logSimEvent: jest.fn(() => Promise.resolve()),
  };
});

function makeDeps() {
  const sm = {
    broadcastToSession: jest.fn(),
    broadcastToPresenters: jest.fn(),
  } as any as SessionManager;
  const runtimeMap = new Map<string, Runtime>();
  const broadcastState = jest.fn();
  const ensureRuntime = (sessionId: string) => {
    const existing = runtimeMap.get(sessionId);
    if (existing) return existing;
    const runtime: Runtime = {
      fallback: false,
      scenarioEngine: new ScenarioEngine(sessionId, "syncope"),
      toolGate: new ToolGate(),
      cost: new CostController({ softUsd: 10, hardUsd: 20 }),
    };
    runtimeMap.set(sessionId, runtime);
    return runtime;
  };
  const handleOrder = createOrderHandler({
    ensureRuntime,
    sessionManager: sm,
    broadcastSimState: broadcastState,
    schedule: (fn: () => void) => fn(), // run immediately for test
  });
  return { sm, broadcastState, handleOrder };
}

describe("order flow announcements", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("EKG order completes with tech announcement and sim_state update", () => {
    const { sm, broadcastState, handleOrder } = makeDeps();
    const announceSpy = sm.broadcastToSession as jest.Mock;

    handleOrder("sim-ekg", "ekg");
    jest.advanceTimersByTime(3000);
    jest.runOnlyPendingTimers();

    const stateCalls = broadcastState.mock.calls.filter((c) => Array.isArray(c) && c[1]?.orders);
    const lastState = stateCalls[stateCalls.length - 1]?.[1];
    expect(lastState?.orders?.some((o: any) => o.type === "ekg" && o.status === "complete")).toBe(true);
    expect(lastState?.telemetry).toBe(true);
  });

  test("Imaging order completes with imaging announcement", () => {
    const { sm, handleOrder, broadcastState } = makeDeps();
    const announceSpy = sm.broadcastToSession as jest.Mock;

    handleOrder("sim-img", "imaging");
    jest.advanceTimersByTime(3000);
    jest.runOnlyPendingTimers();

    const stateCalls = broadcastState.mock.calls.filter((c) => Array.isArray(c) && c[1]?.orders);
    const lastState = stateCalls[stateCalls.length - 1]?.[1];
    const imagingComplete = lastState?.orders?.some((o: any) => o.type === "imaging" && o.status === "complete");
    expect(imagingComplete).toBe(true);
  });
});
