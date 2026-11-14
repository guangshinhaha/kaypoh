---
name: schedule
description: Orders scheduler. Reads .noodle/mise.json, writes .noodle/orders-next.json. Schedules work orders from the GitHub Issues backlog, respecting milestone order and "Depends on" lines. Triggers when orders are empty, after backlog changes, when the loop re-evaluates, or when /schedule is invoked.
schedule: "When orders are empty, after backlog changes, or when session history suggests re-evaluation"
---

# Schedule

Read `.noodle/mise.json`, write `.noodle/orders-next.json`.
The loop atomically promotes `orders-next.json` into `orders.json` — never write `orders.json` directly.
Use `shinfactory schema mise` and `shinfactory schema orders` as the schema source of truth.

Operate fully autonomously. Never ask the user to choose or pause for confirmation.

## kaypoh backlog rules

The backlog is this repo's GitHub issues, synced via the GitHub adapter. Issue titles are
`<key>. <title>` where key is `N1`..`N5` (non-code) or `C1`..`C6` (code). #1 is the R1 parent.
Before scheduling an issue:

- **Code only.** Schedule only issues labelled `code`. Issues labelled `non-code` (site terms,
  flow shortlist, volunteers, decision date, scoring spec) need a person: never schedule them.
- **Depends on.** The first line of each issue body reads `Size: X, needs A, B`. Every issue it
  names (by key, e.g. `N1`, `C1`) must be closed. If one isn't, leave the issue out of this
  cycle's orders and reconsider it next cycle. Don't comment, don't send it back.
- **Order.** Prefer the lowest key number first (C1 before C2). Run them one at a time: at most
  one `code` issue may have an order at a time, since each builds on the last.
- **#1 itself** is the R1 parent, not a build issue. Never schedule it.
- **Live runs.** C1 onwards drives a real browser against government sites. Never schedule it
  unless N1 (site terms and access policy) is closed.
- **One GitHub call for issue states.** Fetch every issue's state once:
  `gh issue list --state all --limit 300 --json number,title,state,labels`. Don't run
  `gh issue view` per issue: dozens of calls in a few seconds trip GitHub's secondary rate
  limit. The backlog `description` field already holds each issue body (first 2,000
  characters); view a single issue only when that is cut off before its Done when.

## One Plan at a Time

This is the cardinal scheduling rule. Pick the highest-priority plan with remaining phases and schedule all of them. Do not spread work across multiple plans — finishing one plan end-to-end produces shippable results; advancing many plans one phase each produces nothing usable. If the current plan is blocked, idle (empty orders) rather than context-switching to a different plan. Exception: shared infra orders can run alongside a plan's phases.

## Orders Model

Output is `{orders: [...]}` where each order is a **pipeline of stages** executed sequentially. Group related work into stages within one order rather than separate orders.

### Stages

Each stage has a `do` field (task key, must match a registered task type) and runs one at a time within the order. The loop advances to the next stage when the current one completes.

A typical order pipeline: execute, then quality, then debrief — all as stages of one order.

### Tier and the review gate

Set `"tier"` on every order that builds a backlog item: `none` (docs or inert config), `low`, `medium`, or `high`. Take it from the item's `risk:` label (`risk:low`, `risk:medium`, `risk:high`); if the tier is unclear, take the higher one. A missing tier counts as `medium`. `risk:high` issues are the security boundary (sandbox, bridge, gateway, consent, upload, review, release) — always give these a `verify` stage even if the label alone would suggest otherwise. The loop refuses to ship an order whose stages don't fit its tier:

- `none`: any stages.
- `low`, `medium`: `execute`, then `quality` (after the last `execute`).
- `high`: `execute`, then `quality`, then `verify` (a fresh verifier that writes a verdict at the branch head).

Nothing merges before the order's last stage. Findings from `quality` or a `FAIL` from `verify` send the order back to `execute` on the same branch, at most 2 times, then the order stops and lands in `action_needed`. Don't add stages to answer a rejection yourself.

### Work type

Set `"work_type"` on every order that builds a backlog item: `bug`, `feature` or `refactor`. Take it from the item's labels first (`bug`, `feature`, `refactor`), then from its title and description. Leave it off if you can't tell; don't guess.

## Task Types

Read `task_types` from mise to discover every schedulable task type and its `schedule` hint. Any registered task type can be a stage within an order. Use `do` on each stage to bind it to a task type.

### Execute Tasks

Schedule execute tasks from the `backlog` array in mise. Use the backlog item ID (the GitHub issue number, as a string) as the order `id`.

The GitHub adapter provides `status`, `tags` (labels), `plan`, `url`, and `description` (the issue body, cut at 2,000 characters) — use the description as the task brief. For a long issue, the full "Goal" / "Done when" / "Out of scope" may be cut off; if the 2,000-character description ends mid-section, tell the execute stage to read the full body with `gh issue view <id> --json body` first.

**No Done when, no build.** Before scheduling any backlog item, check that the item states something observable that a person or test can check when the work is done. Exact headings aren't required: "Running `kaypoh run` with a deliberately low cost cap stops the run and logs why" passes under any wording. A goal with nothing to check fails. If the `description` has no Done when and is 2,000 characters long, read the full issue first, because it may have been cut off.

An item that fails gets no order. Listing it in `action_needed` isn't enough, because only the loop reads that. Send it back yourself in this session, naming what's missing, so the person sees why:

Run the backlog `stop` script (`adapters/backlog-stop`) from the project root, with the issue number as the argument and what's missing on stdin:

```sh
printf '%s' "<what's missing>. Fix the issue, then add the ${NOODLE_GH_LABEL:-ready} label again." | adapters/backlog-stop <id>
```

It comments once ("shinfactory: stopped. ..."), removes `ready` and adds `needs-shin`. Never remove `ready` with `gh issue edit` yourself: the issue would show no `needs-shin`.

**Never restate an order that already exists.** Read `.noodle/orders.json` first. If an item already has an order there (any status but done/failed), leave it out of `orders-next.json` entirely. The loop merges `orders-next.json` into the existing orders, so writing the same order again appends its stages a second time and re-runs work that is already done. If every schedulable item already has an order, write `{"orders":[]}`.

**One order, one ready issue.** Every order's `id` is the ID of an item in `backlog`, which holds only issues a person marked ready. The loop drops any other order and logs its ID, so an invented ID (`chore-...`, `fix-...`, `infra-...`) builds nothing. Shared infrastructure, a cleanup you noticed, or a follow-up from a quality note are all new work nobody marked ready: file each as a new GitHub issue (Goal, observable Done when, Out of scope; never the `ready` label) and leave it out of `orders-next.json`. A person decides whether it gets built.

**Items with plans:** When a backlog item has a `plan` field, read the plan overview and phase files. Schedule one order with a stage per remaining unfinished phase. Populate `order.plan` with the plan path(s).

**Items without plans:** Assess complexity. Straightforward items (single concern, clear scope) schedule as a simple execute task using the issue's title and description as the prompt. Complex items (multi-file, cross-cutting, ambiguous scope) get a plan-first order instead: a `prompt`-only stage (no `do`) that invokes `/plan`, followed by an `adversarial-review` stage. No quality or debrief stages for plan-first orders. **Do NOT use `"do": "execute"` for plan-first stages.**

**Nothing to schedule:** When no backlog items are actionable, still write `orders-next.json` with an empty orders array (`{"orders":[]}`). This signals that scheduling ran but found nothing — preventing hot-loop re-spawns.

### Follow-Up Stages

Each task type's `schedule` field describes when and how to schedule it — as a follow-up stage within an order. A hint that asks for a standalone order cannot run: the order would name no ready issue. Read these hints from `task_types` in mise and compose orders accordingly.

## Recent Events

The mise brief includes a `recent_events` array — lifecycle events emitted by the loop since the last schedule run. Events are context, not commands:

- After `stage.failed` or `order.failed` — consider whether the item should be retried. A failure that needs separate work (a bug in the loop, a broken merge) becomes a new issue without the `ready` label, not an order. If the reason starts with `Unbuildable:`, don't retry and don't comment: the loop has already told a person and swapped its `ready` label for `needs-shin`. The same holds after two failed rounds on one item.
- After `order.completed` — consider follow-up work (debrief, related items that were blocked and can now be scheduled because their dependency closed).
- After `merge.conflict` — the affected order may need manual attention; avoid re-scheduling it immediately.
- After `registry.rebuilt` — new task types may be available; check `task_types` for scheduling opportunities.

Don't react mechanically to every event. A single stage failure in a long pipeline is normal; three consecutive failures of the same order suggests a deeper problem.

## Scheduling Heuristics

- **Explicit rationale**: Every order must cite which milestone/dependency rule drove its placement.
- **Timebox failures**: If an item has failed 2+ times in `recent_history`, deschedule or split it.

## Model Routing

Do not choose models. Leave `with` and `model` off your stages: the loop fills them from `[routing.roles]` in `.noodle.toml`, using each stage's role. In this repo, `builder`/`explorer` route to `zcode` (Z.ai GLM) and the orchestration/review roles (`scheduler`, `planner`, `reviewer`, `adversary`, `verifier`, `debrief`) stay on `claude` — deliberately a different provider from the one writing the code.

## Runtime Routing

Leave `runtime` off your stages. The loop picks it from `[runtime] default` in `.noodle.toml` (`orca` here — both providers in this repo only run through Orca).

## Output

Write valid JSON to `.noodle/orders-next.json`. `shinfactory schema orders` currently errors, so use this shape. Stages take `do`, not `task_key` — `task_key` is the loop's internal `orders.json` field, and the loop rejects an `orders-next.json` that uses it:

```json
{"orders": [{
  "id": "7",
  "title": "C1. Runner: one persona, one flow",
  "tier": "medium",
  "work_type": "feature",
  "rationale": "M1-01's dependency #6 closed; lowest milestone with work.",
  "stages": [
    {"do": "execute", "prompt": "<issue goal, done when, out of scope>"},
    {"do": "quality"}
  ]
}]}
```
