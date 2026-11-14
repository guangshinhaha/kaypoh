import type { Action } from "./schema.js";
import type { TraceEvent } from "./schema.js";

export interface StepInput {
  goal: string;
  step: number;
  url: string;
  screenshotPng: Buffer;
  history: readonly TraceEvent[];
}

export interface StepDecision {
  /** What the persona expects to happen, written before acting. */
  expectation: string;
  /** What the persona sees on the current page. */
  observation: string;
  action: Action;
  usage: { in: number; out: number };
}

/** The runner's only dependency on a model: swap in the Anthropic adapter, or a script in tests. */
export interface ComputerUseModel {
  decide(input: StepInput): Promise<StepDecision>;
}
