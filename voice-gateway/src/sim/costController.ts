import { CostSnapshot } from "./types";

export class CostController {
  private inputTokens = 0;
  private outputTokens = 0;
  private readonly usdPerToken: number;

  constructor(usdPerToken = 0.0000003) {
    this.usdPerToken = usdPerToken;
  }

  addUsage(input: number, output: number) {
    this.inputTokens += input;
    this.outputTokens += output;
  }

  snapshot(): CostSnapshot {
    const totalTokens = this.inputTokens + this.outputTokens;
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      usdEstimate: totalTokens * this.usdPerToken,
    };
  }
}
