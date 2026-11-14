# Kaypoh

> Kaypoh tries your service before your users do.

Kaypoh sends AI agents to attempt real tasks on public government services as different kinds of users (first-timer on mobile, low-confidence senior, second-language reader, screen-reader user, rushed expert), and reports where they get stuck.

It is a 3-week experiment from GRL (Giant Robots Labs, GovTech Singapore). It tests one question: **do agent users fail where human users fail?**

## Status

Pre-build. Decision date: 7 Dec 2026 (proposed). Full plan, measures and stop rules are in [PRD.md](PRD.md).

## How it works

1. A product team gives a URL and a one-sentence task with a definition of done.
2. Each persona attempts the task in a real browser, 3 runs each, narrating expectations and choices.
3. Stuck points (give-up, backtrack, misread term, wrong path, too many attempts) are logged.
4. Findings are merged across runs, ranked by personas affected and severity, each with screenshot, step, reasoning and suggested fix.
5. A human confirms or rejects each finding before it reaches the product team.

## Experiment gates

| Measure | Pass |
|---|---|
| Recall vs 5-person human baseline | 50% or more |
| Precision (human-confirmed) | 70% or more |
| Persona effect | Personas fail in visibly different places |
| Review effort | Under 30 min per flow |
| Cost per flow | Under S$20 |
| Adoption | 1 of 3 teams asks for a re-run or fixes an issue |

## Scope and guardrails

Public, no-login flows only. Stops before anything is submitted. No Singpass/Corppass, no security testing, no agency rankings.

On live sites: one session at a time per site, human pace, no CAPTCHA or bot-detection workarounds, terms of use checked first, fictional persona details only, findings delivered privately to the owning team first.

## Build approach

Off-the-shelf computer-use model plus a headless browser; no custom model. The browser-driving and run-logging layer is shared with Legacy Exoskeleton. Traces go to GRL agent observability.

## Repo layout

```
PRD.md      product requirements, experiment design, decision rules
README.md   this file
```

Code layout will be added when the runner is built (week 1).

## Owner

Shin, pilot, GRL.
