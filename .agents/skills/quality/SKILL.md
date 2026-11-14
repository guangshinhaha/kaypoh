---
name: quality
description: Post-cook quality gate. Tests completed cook work against the issue's Done when, then reviews correctness, scope discipline and CLAUDE.md rules. Accepts with a stage_message event and rejects with a stage_fail event. Triggers after execute stages, on '/quality', 'review this', 'check the work', 'assess quality'.
schedule: "Follow-up stage after execute. Cross-provider review preferred — builder runs on zcode, so schedule quality on claude."
---

# Quality

Review completed cook work and emit your verdict as an event.

Operate fully autonomously. Never ask the user.

## Step 0 -- Load Principles

If the `shinstack:craft` skill is in your skill list, load it and read the principles its router lists for this change, in full. These govern the review. Do NOT skip this. If shinstack is not installed, don't try to load it; judge against the three principles under "Judge by these three" below.

**Block only on what you can show**: a failing run, a bug a user would hit, a failed gate (`pnpm check` / `pnpm e2e`), a missed Done when, or a spec/CLAUDE.md rule the change broke. Everything else is a non-blocking issue.

## Assessment Pipeline

Run in order. Stop early and reject on any high-severity finding.

### 1. Done When

You test the work; the cook doesn't get to mark its own.

- Read the order's GitHub issue (the order ID is the issue number): `gh issue view <id> --json body,title,labels`, plus its linked plan if there is one. Find what it says is observable when done.
- Test each criterion yourself against the real thing: run the command, call the API, open the page in the dev server. A cook's claim, a passing unit test, or a doc line doesn't count when the criterion describes behavior.
- Reject if any criterion is missed, or if the item states nothing observable. Quote the criterion and what you observed.
- If a criterion needs something this environment doesn't have (e.g. an iOS simulator), say so in the verdict as unverified. Don't call it met.

### 2. Scope Check

- Read the issue's "Out of scope" and any "Depends on" line.
- Run `git diff --stat` and `git log --oneline` for the cook's commits.
- Flag files changed outside the issue's stated scope, or a dependency added that the issue didn't name, as scope violations.

### 3. Code Quality

- `pnpm check` must pass (Biome lint/format, TypeScript strict typecheck, Vitest).
- `pnpm e2e` must pass if the change touches `apps/`, `packages/host`, `packages/sdk`, or `e2e/`.
- Error messages describe the failure state, not a generic expectation.
- Check against `CLAUDE.md` and `docs/ARCHITECTURE.md`: no stack change, no renamed package, no moved port, Zod schemas in `packages/protocol` as the one source of truth per contract.
- If the spec (`docs/specs/*.md`) and the shipped behavior disagree, that's a rejection — the spec wins.

### 4. Test Evidence

- New behavior must have new tests (Vitest for API routes, Playwright for user-visible flows).
- Tests must assert outcomes, not implementation details.
- Check coverage of edge cases the issue's "Done when" calls out.

### 5. Runtime Verification

- "It compiles" / "`pnpm check` is green" is not enough on its own when the Done when describes observable behavior — also run it (`pnpm dev` + a manual call/click, or the relevant Playwright spec).

## Gated orders

If your stage prompt names a findings file (`.../review.md`), the order runs the review gate. Don't emit `stage_message` or `stage_fail` for the verdict; write that file instead, then exit:

```
Covered: <the diff or files you read, the review level, the kinds of problem you checked>
Findings: none
```

or `Findings:` followed by a list, one proven finding per line starting with `- `. Review at the depth for the order's tier: none, no review; low, `/code-review low`; medium, `/code-review medium`; high, `/shinstack:blast-radius` then `/shinstack:interrogate` (when shinstack is installed; otherwise run `/code-review high`). An empty file, or one with no `Covered:` line, counts as not run and fails the stage. Findings send the order back to execute on the same branch, at most 2 times; after that the order stops for a person.

## Verdict

**Accept**: Emit a `stage_message` with `blocking: false`. The pipeline continues and the scheduler sees the green light.

```sh
shinfactory event emit --session $NOODLE_SESSION_ID stage_message --payload '{ "message": "All checks pass. Done when met: GET /api/me returns the dev user after login. pnpm check and pnpm e2e green, scope clean.", "blocking": false }'
```

**Reject**: Emit a `stage_fail`. The stage and order fail, later stages don't run, the backlog item stays open, and the scheduler reads findings and decides whether to retry or abort. In `auto` mode the cook's commits are already on local main when you run, and a rejection doesn't revert them, so name the commits in your message.

```sh
shinfactory event emit --session $NOODLE_SESSION_ID stage_fail --payload '{ "message": "Rejected: 2 high issues. [1] Done when missed: \"GET /api/me returns the user\", but it returned 401. [2] Scope violation: modified packages/ui outside this issue's stated scope." }'
```

Write the message as natural language the scheduler can act on. Include specific file paths and line context so the scheduler can brief the retry cook.

## Non-blocking Issues

Issues that don't warrant rejection (style nits, minor improvements, documentation gaps): file as a new GitHub issue with a Goal, an observable Done when and an Out of scope. They wait until a person adds the `ready` label — do not add it yourself.

## Judge by these three

- **Prove it works.** Trust runs and artifacts, not the cook's self-report. Run the change yourself against the Done when.
- **Test behavior, not implementation.** A test that only restates the code proves nothing; a good one fails when behavior breaks.
- **Fix root causes.** A fix that hides the symptom (a retry, a swallowed error, a special case) is a blocker when you can show the cause is still there.
