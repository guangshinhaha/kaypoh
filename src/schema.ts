// Trace event schema: docs/spec.md section 2.2. One source of truth for the trace shape.
import { z } from "zod";

export const ActionType = z.enum(["click", "type", "select", "back", "scroll", "submit", "stop"]);

export const Action = z.object({
  type: ActionType,
  /** "x,y" viewport coordinates (all a screenshot-only model has) or a CSS selector. */
  target: z.string().optional(),
  value: z.string().optional(),
});
export type Action = z.infer<typeof Action>;

/** Stuck types are logged by the detector (C3). The runner always writes null. */
export const StuckType = z.enum(["give_up", "backtrack", "misread_term", "wrong_path", "over_budget"]);

export const TraceEvent = z.object({
  run: z.string(),
  step: z.number().int().nonnegative(),
  ts: z.string(),
  url: z.string(),
  expectation: z.string(),
  observation: z.string(),
  action: Action,
  stuck: StuckType.nullable(),
  /** Null only on a stop event written before any screenshot could be taken. */
  screenshot: z.string().nullable(),
  tokens: z.object({ in: z.number().int().nonnegative(), out: z.number().int().nonnegative() }),
  cost_usd: z.number().nonnegative(),
  retries_used: z.number().int().nonnegative(),
  /** Set on the final stop event: why the run ended (spec section 2.2, failed runs). */
  reason: z.string().optional(),
});
export type TraceEvent = z.infer<typeof TraceEvent>;
