---
name: execute
description: >-
  Implementation methodology for kaypoh backlog items. Handles scoping, worktree workflow,
  verification against pnpm check/pnpm e2e, and commit conventions. Triggers: "execute",
  "implement", "build this".
schedule: "When backlog items with linked plans are ready for implementation"
---

# Execute

Implementation methodology for this repo. Operate fully autonomously. Never ask the user. Don't stop until the work is fully complete or the item is unbuildable (see Scope).

**Craft comes from shinstack when it is installed.** If the `shinstack:craft` skill is in your skill list, load it and follow its playbook for the work: `bug-fix` for a bug, `feature` for a backlog item or plan phase, `refactoring` for a behavior-preserving reshape. This skill adds only the factory mechanics around it (worktree, commit, yield) and the repo-specific rules below. Where they overlap, the router's "Inside shinfactory" rule wins: commit and yield, never push or open a PR. If shinstack is not installed, don't try to load it; use "Without shinstack" below.

Read `CLAUDE.md` at the project root first — it names the fixed reading order (`docs/PRD.md`,
`docs/ARCHITECTURE.md`, the spec your issue names) and the project rules (don't change the
stack, respect "Depends on", spec wins over the issue, add a dependency only when named). This
skill covers the factory mechanics around that; CLAUDE.md covers the product and stack rules.

**Track all work with Tasks** (TaskCreate, TaskUpdate, TaskList). One task per decomposed change; mark in_progress when starting, completed when done.

## 1. Scope

- Read the issue with `gh issue view <id> --json body,title,labels` — the backlog's `description`
  field is cut at 2,000 characters, and "Decided", "Assumed" and "Open" questions often come
  last in a long issue.
- Check "Depends on": every issue it names must already be closed. If one isn't, this is
  unbuildable — see below.
- Read `docs/ARCHITECTURE.md` and the spec(s) the issue names under `docs/specs/`. If the
  issue and the spec disagree, the spec wins. If the spec is silent or wrong, that's also
  unbuildable — don't invent a contract.
- If a linked plan exists (`brain/plans/...`), read it.

Output: a clear, bounded description of what changes and what doesn't, scoped to the issue's
"Done when" and nothing past its "Out of scope".

**Unbuildable item:** if "Depends on" issues aren't closed, the spec is silent/contradictory
with no way to resolve it, the issue has no observable Done when, or anything else only a
person can settle — don't guess and don't change any code. Fail the stage, name what's
missing, and stop:

```bash
shinfactory event emit --session $NOODLE_SESSION_ID stage_fail --payload '{"message": "Unbuildable: <what is missing and who can settle it>"}'
```

The message becomes the issue comment word for word, so write one or two plain sentences that
state the decision a person must make. The loop fails the stage, discards the worktree,
comments once on the issue, and swaps its `ready` label for `needs-shin`. This is the one case
where you stop before the work is complete.

## 2. Decompose

Break scope into discrete changes. Each change:
- One function/type/module + its tests, OR one bug fix
- Independently compilable (`pnpm check` passes with just that change)
- One conventional commit

Single-change scopes skip decomposition.

## 3. Implement

### Worktree First — Non-Negotiable

**Never edit files on main.** Multiple sessions run concurrently; editing main causes merge conflicts and lost work.

If CWD is already inside `.worktrees/`, use it. Otherwise: `shinfactory worktree create <descriptive-name>`

Use absolute paths or `shinfactory worktree exec <name> <cmd>`. **Never `cd` into a worktree** — if it gets removed while the shell is inside, the session dies permanently.

Commit inside the worktree. If the loop gave you this worktree, stop at commit and yield; the loop merges it. Only merge worktrees you created yourself: `shinfactory worktree merge <name>`

### Project rules (from CLAUDE.md / docs/ARCHITECTURE.md)

- One source of truth per contract: the Zod schemas in `packages/protocol`. Import them; never redeclare a shape by hand.
- Every API route gets a Vitest test. Every user-visible flow gets a Playwright test.
- Mini-app code (templates, examples under `examples/`) never uses `fetch`, browser storage or external URLs.
- Error messages describe the failure state (`"session not found"`, not `"error"`).
- No backward-compatibility code or feature flags — nothing is released yet.
- Do not change the stack, add a framework, rename a package, or move a port. Add a dependency only if the issue names it or the work is impossible without it, and say which and why in the PR.
- Dependency direction: `protocol` depends on nothing; `sdk`/`host`/`cli`/`apps/api` depend on `protocol`; `ui` depends on nothing in the workspace; apps depend on packages, never the reverse.

### Delegation

- **Self-execute**: Single change, or tightly coupled changes (shared Zod schemas, sequential dependencies).
- **Sub-agents**: 2+ independent changes touching different packages/apps.

Before parallelizing, ask: "Does any change's output become another's input?" Changes sharing a Zod schema or a route contract must be sequential.

## 4. Verify

Run the full verification suite before committing. See `references/verification.md` for the complete checklist. Never commit failing code — fix and re-verify on failure.

## 5. Commit

`<type>(<scope>): <description>` with an `Refs: #<issue-number>` footer. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. One commit per logical change.

### Rebase before you yield

Other orders build in parallel and merge while you work, and they often touch the same
shared files (for example the export list in `packages/protocol/src/index.ts`). Right before
yielding, bring your branch up to date with `main` so the loop's landing is clean.

**Never rewrite a branch that is already on GitHub.** On a fix round the loop has already
pushed your branch (its draft PR), and a rebase makes the loop's next push fail as
non-fast-forward. So:

```bash
git fetch origin
if [ -z "$(git ls-remote --heads origin "$(git branch --show-current)")" ]; then
  git rebase origin/main     # first round: branch not pushed yet
else
  git merge --no-edit origin/main   # fix round: branch already pushed
fi
```

Resolve any conflict by keeping both sides' intent (for an export list: keep every export,
sorted), then re-run `pnpm check` (and `pnpm e2e` if it applies) before yielding. Never yield a
branch that has not passed the checks after this update.

## 6. Yield

After all changes are committed and verified, emit `stage_yield`:

```bash
shinfactory event emit --session $NOODLE_SESSION_ID stage_yield --payload '{"message": "Implemented: <brief summary>"}'
```

Without this, the stage only completes on clean process exit — interrupted work is lost to the pipeline.

## Scope Discipline

- Only change what's in scope. No defensive code, backwards-compat shims, or speculative features.
- Out-of-scope discoveries go in the quality review notes — don't change them.
- Wrong or incomplete spec/issue: that's unbuildable (see above) — don't silently deviate from the spec.

## Principles

With shinstack installed, read each of these in full before applying:
- prove-it-works
- laziness-protocol
- guard-the-context-window
- boundary-discipline
- sequence-verifiable-units

## Without shinstack

Same job, built in:

- **Reproduce first.** For a bug, make it fail before you fix it. For a feature, write the test that fails without it.
- **Smallest change.** Meet the Done when and nothing else.
- **Slices.** Build in small steps that each end in a passing `pnpm check`, then commit.
- **Validate at the edge.** Validate with the Zod schema where input enters (API routes, SDK boundary); inside, trust the inferred types.
- **Commit and yield.** Never push, open a PR or comment on issues from a factory stage; the loop owns those.
- **Prove it.** Run the real thing (`pnpm dev` + a manual check, or the Playwright run), not only unit tests, and paste the output into your stage message. A self-report is not proof.
- **TypeScript.** `strict: true`, no `any` in exported types. Derive state instead of syncing it. Effects only for external systems (not for derived values). Test what a user sees (Playwright) or what a caller sees (Vitest against the route/SDK boundary), not internals.
