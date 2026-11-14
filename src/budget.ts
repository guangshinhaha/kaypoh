/** Spend tracker shared by every run in a flow. The flow cap is the hard ceiling across runs. */
export class Budget {
  spentUsd = 0;
  constructor(readonly capUsd: number) {
    if (!(capUsd > 0)) throw new Error(`budget cap must be positive, got ${capUsd}`);
  }
  add(usd: number): void {
    this.spentUsd += usd;
  }
  get exceeded(): boolean {
    return this.spentUsd > this.capUsd;
  }
}

export interface Pricing {
  /** USD per million input tokens. */
  inPerMTok: number;
  /** USD per million output tokens. */
  outPerMTok: number;
}

export function costUsd(tokens: { in: number; out: number }, p: Pricing): number {
  return (tokens.in * p.inPerMTok + tokens.out * p.outPerMTok) / 1_000_000;
}
