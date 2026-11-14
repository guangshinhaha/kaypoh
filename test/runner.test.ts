import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Budget } from "../src/budget.js";
import type { ComputerUseModel, StepDecision } from "../src/model.js";
import { runOnce, type RunOptions } from "../src/runner.js";
import { TraceEvent, type Action } from "../src/schema.js";
import { startSite } from "./site.js";

let site: Awaited<ReturnType<typeof startSite>>;
beforeAll(async () => void (site = await startSite()));
afterAll(() => site.close());

const script = (actions: Action[], usage = { in: 1000, out: 100 }): ComputerUseModel => {
  let i = 0;
  return {
    async decide() {
      const action = actions[Math.min(i++, actions.length - 1)]!;
      return { expectation: `expect ${i}`, observation: `saw ${i}`, action, usage } satisfies StepDecision;
    },
  };
};

const opts = async (over: Partial<RunOptions> & Pick<RunOptions, "model">): Promise<RunOptions> => ({
  runId: "run-test",
  startUrl: site.url,
  goal: "Find out if I qualify",
  pricing: { inPerMTok: 3, outPerMTok: 15 },
  runCapUsd: 1,
  flowBudget: new Budget(10),
  rootDir: await mkdtemp(path.join(os.tmpdir(), "kaypoh-")),
  pace: { minMs: 0, maxMs: 0 },
  ...over,
});

const readTrace = async (p: string) =>
  (await readFile(p, "utf8")).trim().split("\n").map((l) => TraceEvent.parse(JSON.parse(l)));

describe("one run on the local flow", () => {
  it("walks the flow, writes trace and screenshots, and stops before submit", async () => {
    const o = await opts({
      model: script([
        { type: "click", target: "#start" },
        { type: "type", target: "#income", value: "3200" },
        { type: "select", target: "#household", value: "2" },
        { type: "click", target: "#check" }, // the submit button
      ]),
    });
    const r = await runOnce(o);
    expect(r.status).toBe("stopped_before_submit");
    const trace = await readTrace(r.tracePath);
    expect(trace.map((e) => e.action.type)).toEqual(["click", "type", "select", "submit"]);
    expect(trace.at(-1)?.reason).toMatch(/submit_blocked/);
    expect(trace[1]?.url).toMatch(/form\.html$/);
    for (const e of trace) {
      expect(e.cost_usd).toBeCloseTo((1000 * 3 + 100 * 15) / 1e6);
      await stat(path.join(o.rootDir, e.screenshot!));
    }
    expect(site.posts).toEqual([]); // nothing was submitted
  });

  it("completes when the model stops by itself", async () => {
    const r = await runOnce(await opts({ model: script([{ type: "stop", value: "goal reached" }]) }));
    expect(r.status).toBe("completed");
    expect((await readTrace(r.tracePath))[0]?.reason).toBe("goal reached");
  });

  it("treats an explicit submit action as a stop too", async () => {
    const r = await runOnce(await opts({ model: script([{ type: "submit" }]) }));
    expect(r.status).toBe("stopped_before_submit");
  });
});

describe("cost kill-switch", () => {
  it("a deliberately low run cap stops the run before the next action", async () => {
    // each step costs $0.0045; cap of $0.006 allows one step, stops on the second
    const r = await runOnce(
      await opts({ runCapUsd: 0.006, model: script([{ type: "click", target: "#start" }, { type: "click", target: "#nope" }]) }),
    );
    expect(r.status).toBe("cost_cap_run");
    const trace = await readTrace(r.tracePath);
    expect(trace).toHaveLength(2);
    expect(trace[1]?.action.type).toBe("stop");
    expect(trace[1]?.reason).toMatch(/run cost cap/);
    expect(r.costUsd).toBeCloseTo(0.009);
  });

  it("the flow budget is shared across runs and stops the later one", async () => {
    const flowBudget = new Budget(0.006); // one stop-step costs $0.0045
    const first = await runOnce(await opts({ runId: "r1", flowBudget, model: script([{ type: "stop" }]) }));
    expect(first.status).toBe("completed");
    const second = await runOnce(await opts({ runId: "r2", flowBudget, model: script([{ type: "stop" }]) }));
    expect(second.status).toBe("cost_cap_flow");
  });
});

describe("crashes and blocks are logged", () => {
  it("logs a crash when an action fails", async () => {
    const r = await runOnce(await opts({ model: script([{ type: "click", target: "#does-not-exist" }]) }));
    expect(r.status).toBe("crashed");
    const last = (await readTrace(r.tracePath)).at(-1)!;
    expect(last.action.type).toBe("stop");
    expect(last.reason).toMatch(/^crash:/);
  });

  it("logs a crash when the model throws", async () => {
    const model: ComputerUseModel = { decide: async () => { throw new Error("model unavailable"); } };
    const r = await runOnce(await opts({ model }));
    expect(r.status).toBe("crashed");
    expect((await readTrace(r.tracePath)).at(-1)?.reason).toBe("crash: model unavailable");
  });

  it("logs an HTTP 403 as blocked and does not work around it", async () => {
    const r = await runOnce(await opts({ startUrl: `${site.url}/blocked`, model: script([{ type: "stop" }]) }));
    expect(r.status).toBe("blocked");
    const trace = await readTrace(r.tracePath);
    expect(trace).toHaveLength(1);
    expect(trace[0]?.reason).toBe("blocked: HTTP 403");
  });

  it("logs a bot-check page as blocked", async () => {
    const r = await runOnce(await opts({ startUrl: `${site.url}/captcha.html`, model: script([{ type: "stop" }]) }));
    expect(r.status).toBe("blocked");
  });
});

describe("guards", () => {
  it("refuses a live government URL without approval, before launching a browser", async () => {
    await expect(
      runOnce(await opts({ startUrl: "https://www.gov.sg/", model: script([{ type: "stop" }]) })),
    ).rejects.toThrow(/refusing live run/);
  });

  it("serialises runs on the same site", async () => {
    const order: string[] = [];
    const slow = (tag: string): ComputerUseModel => ({
      async decide() {
        order.push(`${tag}:start`);
        await new Promise((r) => setTimeout(r, 150));
        order.push(`${tag}:end`);
        return { expectation: "", observation: "", action: { type: "stop" }, usage: { in: 0, out: 0 } };
      },
    });
    await Promise.all([
      runOnce(await opts({ runId: "a", model: slow("a") })),
      runOnce(await opts({ runId: "b", model: slow("b") })),
    ]);
    expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });
});
