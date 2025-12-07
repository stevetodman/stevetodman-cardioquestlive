import { CostSnapshot } from "./types";

export class CostController {
  private inputTokens = 0;
  private outputTokens = 0;
  private readonly usdPerToken: number;
  private readonly softUsd: number;
  private readonly hardUsd: number;
  private throttled = false;
  private fallback = false;
  private softTriggered = false;
  private hardTriggered = false;
  private readonly onSoft?: () => void;
  private readonly onHard?: () => void;

  constructor(opts?: { usdPerToken?: number; softUsd?: number; hardUsd?: number; onSoftLimit?: () => void; onHardLimit?: () => void }) {
    this.usdPerToken = opts?.usdPerToken ?? 0.0000003;
    this.softUsd = opts?.softUsd ?? 3.5;
    this.hardUsd = opts?.hardUsd ?? 4.5;
    this.onSoft = opts?.onSoftLimit;
    this.onHard = opts?.onHardLimit;
  }

  addUsage(usage: { inputTokens?: number; outputTokens?: number }) {
    this.inputTokens += usage.inputTokens ?? 0;
    this.outputTokens += usage.outputTokens ?? 0;
    const cost = this.estimateUsd();
    if (!this.softTriggered && cost >= this.softUsd) {
      this.softTriggered = true;
      this.throttled = true;
      this.onSoft?.();
    }
    if (!this.hardTriggered && cost >= this.hardUsd) {
      this.hardTriggered = true;
      this.fallback = true;
      this.onHard?.();
    }
  }

  getState(): CostSnapshot & { throttled: boolean; fallback: boolean } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      usdEstimate: this.estimateUsd(),
      throttled: this.throttled,
      fallback: this.fallback,
    };
  }

  private estimateUsd(): number {
    const totalTokens = this.inputTokens + this.outputTokens;
    return totalTokens * this.usdPerToken;
  }
}
