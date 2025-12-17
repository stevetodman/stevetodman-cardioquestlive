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

  describe("soft limit reset", () => {
    test("resetSoftLimit clears throttle flag", () => {
      const onSoftReset = jest.fn();
      const cc = new CostController({
        usdPerToken: 0.001,
        softUsd: 0.5,
        hardUsd: 999,
        onSoftLimit: jest.fn(),
        onHardLimit: jest.fn(),
        onSoftReset,
      });
      cc.addUsage({ inputTokens: 600, outputTokens: 0 }); // Triggers soft limit
      expect(cc.getState().throttled).toBe(true);
      expect(cc.canResetSoftLimit()).toBe(true);

      cc.resetSoftLimit();
      expect(cc.getState().throttled).toBe(false);
      expect(onSoftReset).toHaveBeenCalled();
    });

    test("resetSoftLimit does nothing if hard limit is hit", () => {
      const cc = new CostController({
        usdPerToken: 0.001,
        softUsd: 0.5,
        hardUsd: 0.7,
        onSoftLimit: jest.fn(),
        onHardLimit: jest.fn(),
      });
      cc.addUsage({ inputTokens: 800, outputTokens: 0 }); // Triggers both limits
      expect(cc.getState().throttled).toBe(true);
      expect(cc.getState().fallback).toBe(true);
      expect(cc.canResetSoftLimit()).toBe(false);

      cc.resetSoftLimit();
      // Should still be throttled because hard limit was hit
      expect(cc.getState().throttled).toBe(true);
    });

    test("reset() clears token count and soft limit but not hard limit", () => {
      const cc = new CostController({
        usdPerToken: 0.001,
        softUsd: 0.5,
        hardUsd: 999,
        onSoftLimit: jest.fn(),
        onHardLimit: jest.fn(),
      });
      cc.addUsage({ inputTokens: 600, outputTokens: 0 });
      expect(cc.getState().throttled).toBe(true);
      expect(cc.getState().usdEstimate).toBeGreaterThan(0);

      cc.reset();
      expect(cc.getState().throttled).toBe(false);
      expect(cc.getState().usdEstimate).toBe(0);
    });

    test("isHardLimitHit() returns correct status", () => {
      const cc = new CostController({
        usdPerToken: 0.001,
        softUsd: 0.5,
        hardUsd: 0.7,
        onSoftLimit: jest.fn(),
        onHardLimit: jest.fn(),
      });

      expect(cc.isHardLimitHit()).toBe(false);
      cc.addUsage({ inputTokens: 800, outputTokens: 0 });
      expect(cc.isHardLimitHit()).toBe(true);
    });
  });
});
