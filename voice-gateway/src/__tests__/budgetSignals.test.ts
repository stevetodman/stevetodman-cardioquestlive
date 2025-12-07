import { CostController } from "../sim/costController";

describe("budget signals", () => {
  test("soft limit triggers throttle flag", () => {
    const cc = new CostController({ usdPerToken: 0.001, softUsd: 0.5, hardUsd: 999, onSoftLimit: jest.fn(), onHardLimit: jest.fn() });
    cc.addUsage({ inputTokens: 400, outputTokens: 200 });
    const state = cc.getState();
    expect(state.throttled).toBe(true);
  });

  test("hard limit sets fallback flag", () => {
    const cc = new CostController({ usdPerToken: 0.001, softUsd: 0.5, hardUsd: 0.5, onSoftLimit: jest.fn(), onHardLimit: jest.fn() });
    cc.addUsage({ inputTokens: 600, outputTokens: 600 });
    const state = cc.getState();
    expect(state.fallback).toBe(true);
  });
});
