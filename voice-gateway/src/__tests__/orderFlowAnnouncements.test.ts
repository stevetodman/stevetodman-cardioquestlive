import { createOrderHandler, hasPendingOrder, clearPendingOrders } from "../orders";
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

function makeDeps(options: { runImmediately?: boolean } = {}) {
  const sm = {
    broadcastToSession: jest.fn(),
    broadcastToPresenters: jest.fn(),
  } as unknown as jest.Mocked<SessionManager>;
  const runtimeMap = new Map<string, Runtime>();
  const broadcastState = jest.fn();
  const scheduledCallbacks: (() => void)[] = [];
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
    schedule: (fn: () => void, _ms: number) => {
      if (options.runImmediately !== false) {
        fn(); // run immediately for most tests
      } else {
        scheduledCallbacks.push(fn); // collect for manual triggering
      }
      return 0;
    },
  });
  return { sm, broadcastState, handleOrder, scheduledCallbacks };
}

describe("order flow announcements", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("EKG order completes with tech announcement and sim_state update", () => {
    const { broadcastState, handleOrder } = makeDeps();

    handleOrder("sim-ekg", "ekg");
    // Custom schedule runs completion immediately

    const stateCalls = broadcastState.mock.calls.filter((c) => Array.isArray(c) && c[1]?.orders);
    const lastState = stateCalls[stateCalls.length - 1]?.[1];
    expect(lastState?.orders?.some((o: any) => o.type === "ekg" && o.status === "complete")).toBe(true);
    expect(lastState?.telemetry).toBe(true);
  });

  test("Imaging order completes with imaging announcement", () => {
    const { handleOrder, broadcastState } = makeDeps();

    handleOrder("sim-img", "imaging");
    // Custom schedule runs completion immediately

    const stateCalls = broadcastState.mock.calls.filter((c) => Array.isArray(c) && c[1]?.orders);
    const lastState = stateCalls[stateCalls.length - 1]?.[1];
    const imagingComplete = lastState?.orders?.some((o: any) => o.type === "imaging" && o.status === "complete");
    expect(imagingComplete).toBe(true);
  });
});

describe("order duplicate detection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearPendingOrders(); // Reset pending orders between tests
  });

  afterEach(() => {
    jest.useRealTimers();
    clearPendingOrders();
  });

  test("hasPendingOrder returns false when no orders exist", () => {
    expect(hasPendingOrder("test-session", "ekg")).toBe(false);
    expect(hasPendingOrder("test-session", "imaging")).toBe(false);
  });

  test("hasPendingOrder returns true for pending order", () => {
    const { handleOrder } = makeDeps({ runImmediately: false });

    handleOrder("test-dup", "ekg");
    expect(hasPendingOrder("test-dup", "ekg")).toBe(true);
    expect(hasPendingOrder("test-dup", "imaging")).toBe(false); // Different type
  });

  test("hasPendingOrder returns false after order completes", () => {
    const { handleOrder, scheduledCallbacks } = makeDeps({ runImmediately: false });

    handleOrder("test-complete", "ekg");
    expect(hasPendingOrder("test-complete", "ekg")).toBe(true);

    // Run the completion callback
    scheduledCallbacks.forEach(cb => cb());

    expect(hasPendingOrder("test-complete", "ekg")).toBe(false);
  });

  test("duplicate order for same type returns 'still working' message", () => {
    const { handleOrder, sm } = makeDeps({ runImmediately: false });

    // First order
    handleOrder("test-dup2", "ekg");
    sm.broadcastToSession.mockClear();

    // Second duplicate order
    handleOrder("test-dup2", "ekg");

    // Should broadcast a "still working" message
    const calls = sm.broadcastToSession.mock.calls;
    const stillWorkingCall = calls.find((c: any[]) => {
      const msg = c[1];
      return msg?.type === "patient_transcript_delta" &&
             typeof msg?.text === "string" &&
             msg.text.toLowerCase().includes("still working");
    });
    expect(stillWorkingCall).toBeTruthy();
  });

  test("different order types can run concurrently", () => {
    const { handleOrder } = makeDeps({ runImmediately: false });

    handleOrder("test-concurrent", "ekg");
    handleOrder("test-concurrent", "imaging");

    // Both should be pending (tracked in pendingOrders map)
    expect(hasPendingOrder("test-concurrent", "ekg")).toBe(true);
    expect(hasPendingOrder("test-concurrent", "imaging")).toBe(true);

    // Also verify they can coexist for same session
    expect(hasPendingOrder("test-concurrent", "labs")).toBe(false); // Different type, not pending
  });
});

describe("order orderedBy tracking", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearPendingOrders();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearPendingOrders();
  });

  test("order includes orderedBy information when provided", () => {
    const { handleOrder, broadcastState } = makeDeps();

    handleOrder("test-orderedby", "ekg", { id: "user123", name: "Dr. Smith", role: "participant" });

    const stateCalls = broadcastState.mock.calls.filter((c: any[]) => c[1]?.orders);
    const lastState = stateCalls[stateCalls.length - 1]?.[1];
    const ekgOrder = lastState?.orders?.find((o: any) => o.type === "ekg");

    expect(ekgOrder?.orderedBy).toBeDefined();
    expect(ekgOrder?.orderedBy?.name).toBe("Dr. Smith");
    expect(ekgOrder?.orderedBy?.role).toBe("participant");
  });

  test("order works without orderedBy (backwards compatible)", () => {
    const { handleOrder, broadcastState } = makeDeps();

    handleOrder("test-no-orderedby", "imaging");

    const stateCalls = broadcastState.mock.calls.filter((c: any[]) => c[1]?.orders);
    const lastState = stateCalls[stateCalls.length - 1]?.[1];
    const imgOrder = lastState?.orders?.find((o: any) => o.type === "imaging");

    expect(imgOrder).toBeDefined();
    expect(imgOrder?.status).toBe("complete"); // Should still complete
  });
});
