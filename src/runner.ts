import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { Budget, costUsd, type Pricing } from "./budget.js";
import { assertRunnable, isLocalUrl, withSiteLock } from "./guard.js";
import type { ComputerUseModel, PageElement } from "./model.js";
import { TraceEvent, type Action } from "./schema.js";

export type RunStatus =
  | "completed" // the model stopped on its own
  | "stopped_before_submit"
  | "cost_cap_run"
  | "cost_cap_flow"
  | "blocked"
  | "crashed"
  | "max_steps";

export interface RunOptions {
  /** Run id: flow, persona and repeat number, e.g. "run-2026-11-20-p3-r2". */
  runId: string;
  startUrl: string;
  goal: string;
  model: ComputerUseModel;
  pricing: Pricing;
  /** Hard cap for this run, USD. */
  runCapUsd: number;
  /** Shared by all runs in the flow, USD. */
  flowBudget: Budget;
  /** Output root. Trace and screenshots go to `<rootDir>/runs/<runId>/`. */
  rootDir: string;
  maxSteps?: number;
  viewport?: { width: number; height: number };
  /** Human-pace delay before each action. Tests set both to 0. */
  pace?: { minMs: number; maxMs: number };
  sleep?: (ms: number) => Promise<void>;
  /** Only with N1 (#2) closed and a person's explicit approval. Local pages never need it. */
  liveApproved?: boolean;
}

export interface RunResult {
  status: RunStatus;
  reason: string;
  steps: number;
  costUsd: number;
  tracePath: string;
}

const BLOCK_STATUSES = new Set([401, 403, 429, 503]);
const BLOCK_TEXT = /captcha|access denied|unusual traffic|are you a robot|verify you are human/i;

const singaporeTs = (d = new Date()) => {
  const s = new Date(d.getTime() + 8 * 3600_000).toISOString().replace("Z", "");
  return `${s.slice(0, 19)}+08:00`;
};

async function isSubmitControl(page: Page, target: string): Promise<boolean> {
  const check = (el: Element | null) => {
    const c = el?.closest("button, input");
    if (!c) return false;
    const t = (c.getAttribute("type") ?? (c.tagName === "BUTTON" ? "submit" : "")).toLowerCase();
    return (t === "submit" || t === "image") && !!(c as HTMLButtonElement).form;
  };
  const xy = /^(\d+),(\d+)$/.exec(target);
  if (xy) {
    return page.evaluate(([x, y]) => {
      const c = document.elementFromPoint(x!, y!)?.closest("button, input");
      if (!c) return false;
      const t = (c.getAttribute("type") ?? (c.tagName === "BUTTON" ? "submit" : "")).toLowerCase();
      return (t === "submit" || t === "image") && !!(c as HTMLButtonElement).form;
    }, [Number(xy[1]), Number(xy[2])] as [number, number]);
  }
  return page.locator(target).first().evaluate(check, undefined, { timeout: 5000 });
}

async function perform(page: Page, a: Action): Promise<void> {
  const timeout = 5000;
  const xy = a.target ? /^(\d+),(\d+)$/.exec(a.target) : null;
  switch (a.type) {
    case "click":
      if (xy) await page.mouse.click(Number(xy[1]), Number(xy[2]));
      else await page.locator(need(a)).first().click({ timeout });
      break;
    case "type":
      // Coordinates: click the field, then type like a person. No target: type into the focused field.
      if (xy) {
        await page.mouse.click(Number(xy[1]), Number(xy[2]));
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.type(a.value ?? "");
      } else if (a.target) await page.locator(a.target).first().fill(a.value ?? "", { timeout });
      else await page.keyboard.type(a.value ?? "");
      break;
    case "select":
      if (xy) {
        const h = await page.evaluateHandle(([x, y]) => document.elementFromPoint(x!, y!), [Number(xy[1]), Number(xy[2])] as [number, number]);
        await h.asElement()?.selectOption(a.value ?? "", { timeout });
      } else await page.locator(need(a)).first().selectOption(a.value ?? "", { timeout });
      break;
    case "back":
      await page.goBack({ timeout: 10_000 });
      break;
    case "scroll":
      await page.mouse.wheel(0, Number(a.value ?? 400));
      break;
    default:
      throw new Error(`action ${a.type} is not executable`);
  }
  await page.waitForLoadState("domcontentloaded");
}

async function listElements(page: Page): Promise<PageElement[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("a, button, input, select, textarea, [role=button]")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const forLabel = el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent;
        const label = (forLabel || el.getAttribute("aria-label") || (el as HTMLInputElement).placeholder || el.textContent || (el as HTMLInputElement).name || "").trim().slice(0, 80);
        return { tag: el.tagName.toLowerCase(), label, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width, h: r.height };
      })
      .filter((e) => e.w > 0 && e.h > 0 && e.x >= 0 && e.y >= 0)
      .map(({ tag, label, x, y }) => ({ tag, label, x, y })),
  );
}

function need(a: Action): string {
  if (!a.target) throw new Error(`${a.type} action has no target`);
  return a.target;
}

export async function runOnce(opts: RunOptions): Promise<RunResult> {
  assertRunnable(opts.startUrl, opts.liveApproved ?? false);
  // One session per site: queue behind any run already on this host.
  return await withSiteLock(opts.startUrl, () => execute(opts));
}

async function execute(opts: RunOptions): Promise<RunResult> {
  const dir = path.join(opts.rootDir, "runs", opts.runId);
  const tracePath = path.join(dir, "trace.jsonl");
  await mkdir(dir, { recursive: true });
  const rel = (f: string) => `runs/${opts.runId}/${f}`;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pace = opts.pace ?? { minMs: 1500, maxMs: 4000 };
  const maxSteps = opts.maxSteps ?? 40;
  const history: TraceEvent[] = [];
  let runSpent = 0;
  let step = 0;
  let lastShot: string | null = null;
  let lastUrl = opts.startUrl;

  const write = async (e: Omit<TraceEvent, "run" | "ts" | "stuck" | "retries_used">) => {
    const event = TraceEvent.parse({ run: opts.runId, ts: singaporeTs(), stuck: null, retries_used: 0, ...e });
    await appendFile(tracePath, `${JSON.stringify(event)}\n`);
    history.push(event);
  };
  const finish = async (status: RunStatus, reason: string, extra?: Partial<TraceEvent>): Promise<RunResult> => {
    await write({
      step: ++step,
      url: lastUrl,
      expectation: "",
      observation: "",
      action: { type: "stop" },
      screenshot: lastShot,
      tokens: { in: 0, out: 0 },
      cost_usd: 0,
      reason,
      ...extra,
    });
    return { status, reason, steps: step, costUsd: runSpent, tracePath };
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: opts.viewport ?? { width: 390, height: 844 } });
    // Network-layer submit guard: any writing request (non-GET/HEAD) is aborted and ends the run,
    // whatever UI pattern fired it (form post, fetch from a button handler, onchange submit).
    let blockedWrite: string | null = null;
    await context.route("**/*", (route) => {
      const req = route.request();
      if (req.method() !== "GET" && req.method() !== "HEAD") {
        blockedWrite ??= `${req.method()} ${req.url()}`;
        return route.abort();
      }
      // Local-only runs must not reach any other host.
      return !opts.liveApproved && !isLocalUrl(req.url()) ? route.abort() : route.continue();
    });
    const page = await context.newPage();
    let docStatus = 200;
    page.on("response", (r) => {
      if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) docStatus = r.status();
    });

    const blockedReason = async (): Promise<string | null> => {
      if (BLOCK_STATUSES.has(docStatus)) return `blocked: HTTP ${docStatus}`;
      const text = await page.locator("body").innerText({ timeout: 2000 }).catch(() => "");
      return BLOCK_TEXT.test(text) ? "blocked: bot-check or access-denied page" : null;
    };

    try {
      await page.goto(opts.startUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
      lastUrl = page.url();

      while (step < maxSteps) {
        step++;
        lastUrl = page.url();
        const png = await page.screenshot();
        lastShot = rel(`step-${String(step).padStart(2, "0")}.png`);
        await writeFile(path.join(opts.rootDir, lastShot), png);

        const block = await blockedReason();
        if (block) {
          step--; // finish() numbers the stop event; the screenshot above belongs to it
          return await finish("blocked", block);
        }

        const d = await opts.model.decide({ goal: opts.goal, step, url: lastUrl, screenshotPng: png, elements: await listElements(page), history });
        const cost = costUsd(d.usage, opts.pricing);
        runSpent += cost;
        opts.flowBudget.add(cost);
        const base = {
          step,
          url: lastUrl,
          expectation: d.expectation,
          observation: d.observation,
          screenshot: lastShot,
          tokens: d.usage,
          cost_usd: cost,
        };

        // Hard kill-switch: the step was paid for, but the action is not taken.
        const capHit =
          runSpent > opts.runCapUsd ? ["cost_cap_run", `run cost cap $${opts.runCapUsd} exceeded ($${runSpent.toFixed(4)})`] as const
          : opts.flowBudget.exceeded ? ["cost_cap_flow", `flow cost cap $${opts.flowBudget.capUsd} exceeded ($${opts.flowBudget.spentUsd.toFixed(4)})`] as const
          : null;
        if (capHit) {
          await write({ ...base, action: { type: "stop" }, reason: capHit[1] });
          return { status: capHit[0], reason: capHit[1], steps: step, costUsd: runSpent, tracePath };
        }

        if (d.action.type === "stop") {
          const reason = d.action.value ?? "model stopped";
          await write({ ...base, action: d.action, reason });
          return { status: "completed", reason, steps: step, costUsd: runSpent, tracePath };
        }

        const wantsSubmit =
          d.action.type === "submit" ||
          (d.action.type === "click" && d.action.target !== undefined && (await isSubmitControl(page, d.action.target)));
        if (wantsSubmit) {
          const reason = "submit_blocked: runs stop before any submit";
          await write({ ...base, action: { ...d.action, type: "submit" }, reason });
          return { status: "stopped_before_submit", reason, steps: step, costUsd: runSpent, tracePath };
        }

        await write({ ...base, action: d.action });
        await sleep(pace.minMs + Math.random() * (pace.maxMs - pace.minMs));
        await perform(page, d.action);
        await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => undefined);
        if (blockedWrite) {
          lastUrl = page.url();
          return await finish("stopped_before_submit", `submit_blocked: write request aborted (${blockedWrite})`);
        }
      }
      return await finish("max_steps", `reached max steps (${maxSteps})`);
    } catch (err) {
      const reason = `crash: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`;
      return await finish("crashed", reason);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}
