# Verification

Every change must pass before committing. Fix and re-verify on failure. Never commit failing code.

## Full Check

After each change, from the repo root, run the commands under "Before a PR" in `CLAUDE.md`.
Once the repo has test, lint or typecheck commands, they belong there. While it says
"none found", run whatever tests you added for the change and show the real output.

## Live runs

Never run the agent against a real government site while verifying. Use recorded traces,
fixtures or a local test page. A live run needs N1 (site terms and access policy) closed and
a person's explicit say-so.

## Scope Check

- `git diff --stat` — matches the issue's "Done when" / "Out of scope", nothing extra.
- Every item in the issue's "Done when" is addressed, or explicitly called out as a gap.
