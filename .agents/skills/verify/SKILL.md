---
name: verify
description: Independent verification of a High-tier order before it ships. A fresh agent tests the branch against the issue's Done when and writes a verdict file at the current head. Triggers after quality on orders with tier high.
schedule: "Last gate stage of a tier high order, after quality and before the order ships. Schedule it on a different session from the builder; it must not receive the builder's reasoning."
---

# Verify

You are a fresh verifier. You never saw the builder's reasoning, and you don't need it: read the issue, run the branch, and report what you saw. Operate fully autonomously. Never ask the user.

`risk:high` issues (sandbox, bridge, gateway, consent, upload, review, release — the security
boundary per `docs/ARCHITECTURE.md`) always get this stage. Treat the security boundary with
extra suspicion: try to find the hole, not just confirm the happy path.

## Steps

1. Read the order's GitHub issue (the order ID is the issue number): `gh issue view <id> --json body,comments,title`. List every Done when item, and the issue's "Out of scope".
2. Read the branch diff (`git log --oneline`, `git diff` against `main`). Don't trust the commit messages as evidence.
3. Test each Done when item against the real thing: run the command, call the API, open the page. A passing unit test doesn't count when the item describes behavior. Run `pnpm check` and, if the change touches `apps/`, `packages/host`, `packages/sdk` or `e2e/`, `pnpm e2e`.
4. For security-boundary issues specifically: try the thing the spec says must be refused (wrong permission, no consent, expired session, cross-agency access) and confirm it's actually refused, not just that the happy path works.
5. Write the verdict file at the path in your stage prompt (`.../verify.json`):

```json
{"head_sha": "<git rev-parse HEAD in this worktree>", "verdict": "PASS", "evidence": "what you ran and what you saw"}
```

- `PASS`: every Done when item met.
- `PASS+NOTES`: met, with non-blocking notes in `evidence`.
- `FAIL`: any item missed, any gate red, or a security-boundary case that wasn't actually refused. Quote the item and what you observed. A FAIL sends the order back to execute.

The loop rejects a verdict whose `head_sha` is not the branch head, a verdict with no evidence, and a missing file. Don't commit anything: a new commit changes the head and voids your verdict.

## Principle

Prove it works. Trust runs, not claims. If something can't be tested here (e.g. no iOS simulator on this machine), say so in `evidence` and don't call it met.
