# Kaypoh finding taxonomy and schema spec

Issue: #6. Scope: vocabulary and schemas only. Matching agent findings to human stuck points and scoring is issue #13.

## 1. Taxonomy

Every finding carries one heuristic, one severity, and (screen-reader persona only, when applicable) one or more WCAG criteria. SGDS/DSS is a fit check, not a tag.

### 1.1 Problem type: Nielsen's 10 usability heuristics

Source: https://www.nngroup.com/articles/ten-usability-heuristics/ (names verified 14 Nov 2026).

| # | Heuristic | Typical Kaypoh finding |
|---|---|---|
| H1 | Visibility of System Status | No sign a form saved or a page loaded |
| H2 | Match Between the System and the Real World | Jargon the persona misreads |
| H3 | User Control and Freedom | No way back, state lost on back |
| H4 | Consistency and Standards | Same action labelled differently across pages |
| H5 | Error Prevention | Eligibility check lets bad input through |
| H6 | Recognition Rather than Recall | Must remember a value from an earlier page |
| H7 | Flexibility and Efficiency of Use | No shortcut, forced long path |
| H8 | Aesthetic and Minimalist Design | Key action buried in clutter |
| H9 | Help Users Recognize, Diagnose, and Recover from Errors | Vague or dead-end error message |
| H10 | Help and Documentation | Help missing or not findable at the point of need |

Rule: pick the single best-fit heuristic. If two fit, pick the one whose fix would remove the problem.

### 1.2 Severity: Nielsen's 0-4 scale

Source: https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/ (wording verified).

| Score | Meaning |
|---|---|
| 0 | Not a usability problem (reviewer rejects the finding) |
| 1 | Cosmetic only: fix if time allows |
| 2 | Minor: low priority |
| 3 | Major: important to fix, high priority |
| 4 | Catastrophe: imperative to fix before release |

The agent proposes a score; the human reviewer sets the final one. Score 0 is only assigned in review. Anchor for agents: 4 if the persona could not complete the task at all (give-up with no workaround); 3 if the persona only completed it via a wrong path or after exceeding the retry budget; 2 if recovered with visible friction; 1 if noticed but did not slow the persona.

### 1.3 Accessibility: WCAG 2.2 (screen-reader persona)

Source: https://www.w3.org/TR/WCAG22/ (numbers, names and levels verified).

| SC | Name | Level |
|---|---|---|
| 1.1.1 | Non-text Content | A |
| 1.3.1 | Info and Relationships | A |
| 2.1.1 | Keyboard | A |
| 2.4.3 | Focus Order | A |
| 3.3.1 | Error Identification | A |
| 3.3.2 | Labels or Instructions | A |
| 4.1.2 | Name, Role, Value | A |
| 4.1.3 | Status Messages | AA |

Also relevant, not in the core list: 2.4.7 Focus Visible (AA), 2.4.11 Focus Not Obscured (Minimum) (AA, new in 2.2), 3.3.3 Error Suggestion (AA), 3.3.7 Redundant Entry (A, new in 2.2).

Limits: an agent driving a browser through the accessibility tree is a proxy for a screen reader, not a replacement. Tag a WCAG criterion only when the evidence (a missing label, an unannounced status, a focus trap) is visible in the trace. Do not claim conformance or non-conformance.

### 1.4 Fit check: SGDS and Digital Service Standards

- Singapore Government Design System (SGDS): https://www.designsystem.tech.gov.sg/ (the old designsystem.gov.sg redirects here). Verified: official name, and that it has Foundations, Components, Templates and Blocks sections. Not verified: component-level guidance for specific findings; check the relevant component page by hand.
- Digital Service Standards (DSS): control catalog at https://info.standards.tech.gov.sg/control-catalog/dss/ . Verified: nine control groups: Baseline Design Practices (BD), Performance and Reliability (PR), Transactions and Payments (TX), Trust and Legitimacy (TL), Understand Users (UU), and four WCAG groups: Operable (WO), Perceivable (WP), Robust (WR), Understandable (WU). Individual control wording was not read.
- Not verified: that the DSS catalog itself recommends SGDS. A web search summary said it does, but the catalog page fetched did not mention SGDS. Do not cite that claim until checked. Also not verified: whether a public release of the DSS is current; public officers should use the agency intranet copy.

How to use: for each finding, the reviewer optionally records `fit_check`: a DSS control group code (for example `WU`, `BD`) and, if one clearly applies, an SGDS component name. Leave it empty if unsure. Do not guess control numbers.

## 2. Schemas

### 2.1 Finding (one JSON object per finding, stored in `findings.json`)

```json
{
  "id": "F-2026-0007",
  "flow": "eligibility-checker",
  "persona": "second-language-reader",
  "run": "run-2026-11-20-p3-r2",
  "step": 6,
  "url": "https://example.gov.sg/check/income",
  "stuck_type": "misread_term",
  "heuristic": "H2",
  "severity": 3,
  "wcag": ["3.3.2"],
  "screenshot": "runs/run-2026-11-20-p3-r2/step-06.png",
  "agent_reasoning": "I do not know what 'assessable income' means. I entered my monthly salary.",
  "repeat_count": 2
}
```

| Field | Type | Description |
|---|---|---|
| id | string | Unique per report, stable across edits |
| flow | string | Flow slug (one task on one service) |
| persona | string | Persona slug |
| run | string | Run id: flow, persona and repeat number |
| step | int | Step number in the trace where the stuck point was logged |
| url | string | Page URL at that step |
| stuck_type | enum | `give_up`, `backtrack`, `misread_term`, `wrong_path`, `over_budget` (see section 3) |
| heuristic | enum | `H1` to `H10` |
| severity | int 0-4 | Agent-proposed, reviewer-final |
| wcag | string[] (optional) | WCAG 2.2 SC numbers; only for the screen-reader persona, only with trace evidence |
| screenshot | string | Path to the screenshot at that step. Public pages only |
| agent_reasoning | string | The agent's own words at that step, verbatim, not summarised |
| repeat_count | int | Number of runs of the same persona and flow (out of 3) where the same finding appeared. A finding with repeat_count 1 is marked unconfirmed in the report |

Merging rule: two findings are the same if flow, url path and heuristic match. Keep the earliest `id`, set `repeat_count` to the number of distinct runs.

### 2.2 Trace (JSONL, `runs/<run>/trace.jsonl`, one event per step)

```json
{"run":"run-2026-11-20-p3-r2","step":6,"ts":"2026-11-20T10:14:03+08:00","url":"https://example.gov.sg/check/income","expectation":"A box for my monthly salary.","observation":"Field labelled 'Assessable income (S$)'. Helper text absent.","action":{"type":"type","target":"#income","value":"3200"},"stuck":"misread_term","screenshot":"runs/run-2026-11-20-p3-r2/step-06.png","tokens":{"in":5120,"out":214},"cost_usd":0.019,"retries_used":1}
```

| Field | Type | Description |
|---|---|---|
| run, step, ts | string, int, ISO 8601 | Identity and time, Singapore time |
| url | string | Page at the start of the step |
| expectation | string | What the persona thought would happen, written before acting |
| observation | string | What the persona saw after the page loaded, as the persona would read it |
| action | object | `type` (`click`, `type`, `select`, `back`, `scroll`, `submit`, `stop`), `target`, optional `value` |
| stuck | enum or null | Stuck type logged on this step, else `null` |
| screenshot | string | Screenshot path for this step |
| tokens | object | `in` and `out` model tokens for this step |
| cost_usd | number | Model cost for this step, for the S$20 per flow budget |
| retries_used | int | Retries consumed so far on the current sub-goal |

Expectation is written before the action and observation after. If they differ, that gap is the signal. Do not rewrite an expectation after the fact. Failed runs (crash, loop, blocked) get a final event with `action.type: "stop"` and a `reason`.

## 3. Stuck-point logging rules

Log at most one stuck type per step. Use the first rule that applies, in this order.

1. **give_up**: the persona ends the run or a sub-goal without reaching the task goal, by its own decision (`action.type: "stop"`).
2. **over_budget**: the persona repeats the same sub-goal more times than its persona retry budget allows. Log on the step that exceeds the budget, not earlier.
3. **misread_term**: the persona's stated reading of a label, option or message differs from what the page means, shown by `observation` or a later correction. Log on the step where the misreading is acted on.
4. **wrong_path**: the persona follows a link or option that does not lead toward the task goal and then leaves it without completing anything there. Log on the first step on the wrong path.
5. **backtrack**: the persona goes back or undoes an earlier choice (browser back, reopened page, edited an earlier answer). Log on the step that goes back.

Notes:
- A backtrack caused by a wrong path or misread is logged as that cause; backtrack is for returns with no clearer cause.
- Retry budget is set per persona (for example 1 for the low-confidence persona, 3 for a confident one) in the persona definition, not here.
- Do not log a stuck point for blocked or crashed browsers. Those are run failures, counted in reliability figures.

## 4. Worked example

Illustrative only. These findings are invented for a made-up eligibility checker and do not describe a real service.

**F-A. Jargon in an income field**
- Persona: second-language reader (Mandarin). Step 6, stuck_type `misread_term`.
- Evidence: label "Assessable income" with no help text; persona enters monthly salary instead of annual income.
- Heuristic: H2 Match Between the System and the Real World. Severity 3 (wrong result likely, task completes with bad outcome). No WCAG tag.
- Fit check: DSS WU (Understandable).

**F-B. Eligibility result with no next step**
- Persona: first-time user. Step 11, stuck_type `give_up`.
- Evidence: page says "You may not be eligible" with no reason and no link; persona stops.
- Heuristic: H9 Help Users Recognize, Diagnose, and Recover from Errors. Severity 4 (task cannot be finished, no workaround). No WCAG tag.
- Fit check: DSS BD (Baseline Design Practices).

**F-C. Unlabelled radio group for household size**
- Persona: screen-reader. Step 4, stuck_type `over_budget` (3 retries against a budget of 2 to find which option is selected).
- Evidence: accessibility tree shows radios named "radio" with no group name; no announcement when an option is chosen.
- Heuristic: H1 Visibility of System Status. Severity 3. WCAG: 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions, 4.1.2 Name, Role, Value.
- Fit check: DSS WR (Robust), plus WU.

Each would also record `repeat_count` (for example 3, 2 and 3 of 3 runs) and be unconfirmed in the report if it were 1.

## 5. Unverified items

- Individual DSS control wording and numbers (only the nine group names were read).
- Whether the DSS catalog recommends SGDS (search summary said yes, fetched page did not mention it).
- Exact SGDS component guidance for any specific finding.
