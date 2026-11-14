# Kaypoh PRD: synthetic users for government services

14 Nov 2026 · @shin

## Brief

Kaypoh sends AI agents to attempt real tasks on public government services as different kinds of users, and reports where they get stuck. The experiment tests one thing: do agent users fail where human users fail?

| Field | Entry |
|---|---|
| Problem | Product teams learn where users fail only after complaints arrive. Usability testing covers a few flows a year. |
| Outcome | A findings report per service that a product team trusts enough to act on, at a small fraction of the cost of a usability round. |
| Quadrant | Big Bet. The gate tests the capability: persona agents as a stand-in for human users. |
| Pilot | Shin |
| Counterpart | To confirm. One product team willing to receive a free report, plus a candidate enduring owner for service quality. |
| Uncertainties | Agents may be too competent to fail like humans. Findings may be too noisy to act on. No owner may want it. |
| Baseline | Known issues for 3 services, plus a 5-person human run on the same tasks. |
| Intervention | 5 personas attempt 10 public, no-login flows. Each run produces a ranked findings report. |
| Allowance | 3 weeks, S$1,500 in model usage, no partner approvals needed to start. |
| Decision date | 7 Dec 2026 (proposed, GRL Year End Review) |

## Name

Kaypoh is the pick: Singlish for the busybody who pokes into everything and tells you what they found. It describes the behaviour, it is local, and it sits well next to Ducks, Stan and Joy.

- Fallback for formal settings: Scout. Safe, clear, forgettable.
- Rejected: Mystery Shopper (sounds like a retail audit of staff, not a product tool), Canary (engineers will hear canary deployment), Wind Tunnel (better kept for the policy simulation idea).
- Tagline: "Kaypoh tries your service before your users do."

## Problem

Government product teams find out where users fail late and in small samples. The signal arrives as complaints, helpdesk tickets or a drop in a satisfaction score, after the release.

- Usability testing is slow to arrange and covers 5 to 8 people on a few flows. Most flows are never tested with anyone.
- Tested users skew towards people who are easy to recruit. Seniors, second-language readers and screen-reader users are tested least and fail most.
- Analytics show where users drop off but not why.
- Nobody looks across services. The same failure (jargon, dead-end eligibility checks, forms that lose state) repeats from agency to agency.

### Who has it

- Product teams in agencies and in GovTech central products, who want evidence before a release and cannot get a research slot.
- Whoever is accountable for service quality across government, who today relies on self-reported scorecards.
- Agencies with no UX researcher at all, which is most of the long tail.

## Hypothesis

Agents acting as specific kinds of users will hit at least half of the failure points that real users hit on the same task, and at least 70% of what they report will be confirmed as real by a human reviewer.

The new capability is not driving a browser. That is established. The untested part is persona fidelity: whether an agent told to behave like a first-time, low-confidence, Mandarin-first user fails in the places that person fails. The default risk runs the other way. Agents are patient, read everything and recover from errors, so they pass flows that defeat people.

Three sub-questions the experiment answers:

1. **Recall:** of the issues humans hit, how many do agents find?
2. **Precision:** of the issues agents report, how many are real?
3. **Workflow:** counting a human's time to review and correct the report, is the whole thing still cheaper than a usability round?

## How it works

A product team gives Kaypoh a URL and a task in plain words. Kaypoh returns a ranked list of where users got stuck, with evidence.

1. **Task.** "Find out if I qualify for X and start the application." One sentence, with a definition of done.
2. **Personas.** Kaypoh runs the task as each persona. A persona sets what the agent knows, how much it reads, how many attempts it makes before giving up, its language, and its device.
3. **Run.** The agent drives a real browser. It narrates what it expected, what it saw and why it chose each action. Each persona runs 3 times so one-off flukes can be separated from repeat failures.
4. **Detect.** A stuck point is logged when the agent gives up, backtracks, misreads a term, takes a wrong path, or needs more attempts than the persona allows.
5. **Report.** Findings are merged across runs and ranked by how many personas hit them and how badly. Each finding carries a screenshot, the step, the agent's reasoning and a suggested fix.
6. **Review.** A human confirms or rejects each finding before it goes to the product team. Review time is measured.

### Starting personas

| Persona | What it constrains |
|---|---|
| First-timer on mobile | Small viewport, no prior knowledge of agency terms, skims headings only |
| Low-confidence senior | Reads slowly, gives up after 2 errors, avoids anything that looks irreversible |
| Second-language reader | Runs in Mandarin, Malay or Tamil where offered, misreads idiom and acronyms |
| Screen-reader user | Sees only the accessibility tree, no visual layout |
| Rushed expert | Knows the domain, skips instructions, expects shortcuts |

### Build notes

- Integrate first: an off-the-shelf computer-use model plus a headless browser. No custom model.
- The browser-driving and run-logging layer is shared with Legacy Exoskeleton. Build it once.
- Run traces go to GRL agent observability rather than a new store.

## Scope

The experiment covers public, no-login journeys only, and stops before anything is submitted.

### In

- Information finding, eligibility checkers, calculators and the first pages of application flows on public government sites.
- 10 flows across at least 3 agencies, 5 personas, 3 runs each.
- A findings report per flow and one cross-service summary of repeated failure patterns.

### Out

- Anything behind Singpass or Corppass. That needs test accounts and agency approval, and belongs to a second phase.
- Submitting real applications, bookings, payments or feedback forms.
- Security testing. Kaypoh reports usability failures, not vulnerabilities.
- Public rankings or league tables of agencies.
- Continuous monitoring, dashboards and self-serve access. Those come only if the gate passes.

### Guardrails for running on live services

- Low volume and human pace: one session at a time per site, no parallel load.
- No CAPTCHA solving or bot-detection workarounds. If a site blocks the agent, that flow is dropped and noted.
- Check each site's terms of use before the first run.
- No personal data entered. Personas use obviously fictional details.
- Findings go to the owning product team privately first.

## Experiment

Three weeks and S$1,500 produce a tested answer on recall, precision and total workflow cost.

### Baseline

- For 3 of the 10 flows, 5 people each attempt the same tasks while thinking aloud. Their stuck points are the ground truth.
- For the same 3 services, issues already on record: product scorecard findings, public feedback, app or site reviews.
- Cost baseline: hours and cost of a typical usability round for one flow, taken from a team that has run one this year.

### Measures

| Measure | Pass | How it is measured |
|---|---|---|
| Recall | 50% or more | Share of human-found issues that Kaypoh also found |
| Precision | 70% or more | Share of Kaypoh findings a human reviewer confirms |
| Persona effect | Visible difference | Do personas fail in different places, or do all five report the same things? |
| Review effort | Under 30 minutes per flow | Reviewer time to confirm and correct a report |
| Cost per flow | Under S$20 | Model usage for 5 personas, 3 runs each |
| Adoption signal | 1 of 3 teams | A product team asks for a second run or fixes a reported issue |

Failed runs count. A run where the agent crashes, loops or is blocked is logged and included in cost and reliability figures.

### Timeline

1. **Week 1.** Build the runner and report. Pick the 10 flows. Run all personas on 2 flows and check the reports by hand.
2. **Week 2.** Run the remaining 8 flows. Run the 5-person human baseline on 3 flows.
3. **Week 3.** Score recall and precision. Send reports to 3 product teams. Write the finding.

### Allowance

- Time: 3 weeks of side-product capacity.
- Cost: S$1,500 model usage cap. Human baseline uses volunteer colleagues, 30 minutes each.
- Partner access needed to start: none. Partner access needed to finish: 3 product teams willing to read a report.

## Decision

The gate is the capability and an adoption signal, not whether the runner got built.

### Stop if

- Recall is under 50% against the human baseline. Agents do not fail like people, and better prompts in week 2 did not change that.
- Precision is under 70%, or review takes longer than 30 minutes a flow. Correction erases the gain.
- All five personas report the same findings. Then it is a generic UX linter, which is established tech and low novelty.
- None of the 3 product teams asks for a second run or acts on a finding within 2 weeks of receiving the report.

### Narrow if

- Only one persona type holds up. The likeliest is the screen-reader persona, where the constraint is mechanical. Kaypoh becomes an accessibility checker for flows.

### Continue if

- All measures pass. Next quarter: logged-in flows with test accounts on one partner agency's staging site, and a pre-release check that plugs into the Agentic SDLC harness.

### Reusable learning if it stops

- Measured reliability of UI-driving agents on real government front ends: success rate, cost and failure modes per site. Legacy Exoskeleton needs exactly this.
- A scored dataset of human and agent stuck points on 3 services, reusable as an eval for any future persona or simulation work.
- A catalogue of failure patterns repeated across agencies, which feeds the weak-product diagnosis work.

### Transfer path

- Candidate enduring owners: the team that runs product scorecards and service standards, or the Agentic SDLC team as a release check.
- Portfolio effect: adds a Big Bet without a new partner dependency, and shares its core with Legacy Exoskeleton.

## Risks and open questions

The biggest risk is that agents are too capable to fail like the people they imitate.

| Risk | Response |
|---|---|
| Agents pass flows that defeat humans | Constrain personas hard (attention, retries, vocabulary). Measure the persona effect directly. Stop if constraints do not move recall. |
| Agents invent problems that are not there | Three runs per persona, findings need a repeat, human review before anything is sent. |
| An agency objects to agents on its live site | Low volume, public pages only, tell the product team before the report lands. Drop the flow if asked. |
| Product teams read the report as an audit | Private delivery, framed as a free pre-check. No cross-agency ranking. |
| Sites block automated browsers | Do not work around it. Record how many of 10 flows are blocked, since that is itself a finding for Exoskeleton. |
| Human baseline of 5 is small | It matches how usability rounds are run today, which is the thing being compared. |

### Open questions

- [ ] Which 10 flows? Shortlist needed, weighted to services with issues already on record.
- [ ] Is 7 Dec realistic as the decision date given the MOE handover, or should the three weeks start in January?
- [ ] Which 3 product teams will take a report? This is the only partner access the experiment needs.
- [ ] Does GRL count Kaypoh as a separate Big Bet or as a workstream of Legacy Exoskeleton?
- [ ] Who is the candidate enduring owner, and would they name the measure that would make them take it?
- [ ] Is there an existing policy on automated access to government sites that applies to internal teams?
