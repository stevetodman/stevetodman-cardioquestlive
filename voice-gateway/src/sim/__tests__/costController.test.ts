import { CostController } from "../costController";

describe("CostController", () => {
  test("fires soft then hard limits once", () => {
    let soft = 0;
    let hard = 0;
    const cc = new CostController({
      usdPerToken: 1, // 1 token = $1 for easy math
      softUsd: 3,
      hardUsd: 5,
      onSoftLimit: () => soft++,
      onHardLimit: () => hard++,
    });

    cc.addUsage({ inputTokens: 2, outputTokens: 0 }); // $2
    expect(cc.getState().usdEstimate).toBe(2);
    expect(cc.getState().throttled).toBe(false);
    expect(cc.getState().fallback).toBe(false);
    expect(soft).toBe(0);
    expect(hard).toBe(0);

    cc.addUsage({ inputTokens: 1 }); // $3
    expect(cc.getState().throttled).toBe(true);
    expect(soft).toBe(1);
    cc.addUsage({ outputTokens: 1 }); // $4
    expect(cc.getState().fallback).toBe(false);
    expect(hard).toBe(0);

    cc.addUsage({ outputTokens: 1 }); // $5
    expect(cc.getState().fallback).toBe(true);
    expect(hard).toBe(1);

    // further usage should not double-trigger
    cc.addUsage({ inputTokens: 1 });
    expect(soft).toBe(1);
    expect(hard).toBe(1);
  });
});
