# Shakuni — Security Research Operating System

## Product principle

Shakuni is not a scanner that turns a static signal into a bug. It is an evidence-first research system.

Its job is to **understand**, **connect**, **question**, **test safely**, **learn from verified outcomes**, and **produce reproducible evidence**.

## 1. Source understanding layer

### Bug bounty program
- CSV / structured scope
- Policy
- Eligibility
- Safe-harbor conditions
- Out-of-scope rules
- Disclosure rules
- Target types

### Repository intelligence
- ArchSetu analysis
- Source tree
- Language inventory
- Functions and symbols
- Call graph
- Data flow
- Entry points
- Trust boundaries
- Security-sensitive sinks

### Development intelligence
- GitHub PRs
- Issues
- Reviews
- Comments
- Commits
- Changed files
- Fix history
- Reverts
- Release history

All imported material keeps source/provenance metadata.

## 2. Unified research graph

The graph should connect:

`Program → Asset → Repository → Commit → File → Symbol → Entry Point → Data Flow → Trust Boundary → Invariant → Hypothesis → Experiment → Trace → Evidence → Impact → Report`

Additional relations:
- `PR CHANGED`
- `ISSUE DISCUSSED`
- `REVIEWED`
- `FIXED_BY`
- `REVERTED_BY`
- `CALLS`
- `READS`
- `WRITES`
- `AUTHENTICATES`
- `SIGNS`
- `VERIFIES`
- `PERSISTS`
- `CROSSES_BOUNDARY`
- `VIOLATES`
- `DISPROVES`
- `ALTERNATIVE_TO`

## 3. Hypothesis laboratory

Every hypothesis must contain:
- attacker model
- preconditions
- invariant
- expected secure behavior
- expected failure behavior
- supporting evidence
- counterevidence
- experiment
- result
- confidence
- provenance

Generate multiple independent paths:
- attacker perspective
- defender perspective
- protocol/state-machine perspective
- cryptographic perspective
- economic/impact perspective
- implementation/history perspective
- parser/serialization perspective
- concurrency/replay perspective
- configuration/infrastructure perspective

Do not optimize for the number of hypotheses. Optimize for useful, testable diversity.

## 4. Disproof is a first-class result

When a hypothesis fails:

1. Freeze the original hypothesis.
2. Preserve the decisive evidence.
3. Explain exactly why it failed.
4. Identify the invalid assumption.
5. Identify what remained true.
6. Generate alternate hypotheses that change one or more testable assumptions.
7. Prevent identical retry loops.
8. Re-check scope and safety.
9. Continue only when the alternate path has a meaningful research question.

## 5. Self-learning

Learning has two layers:

### Provisional
A verified outcome creates a reusable observation.

### Validated
Independent corroborating evidence promotes the observation to a reusable rule.

A learned rule must contain:
- trigger
- rule
- evidence IDs
- provenance
- confidence
- creation timestamp
- corroboration history

Learned rules may influence prioritization and hypothesis generation.

They may NOT:
- weaken an invariant
- bypass scope
- suppress evidence
- change acceptance criteria
- convert inconclusive into confirmed
- manufacture a reproduction

## 6. Research memory

Maintain separate stores for:
- program memory
- repository memory
- historical memory
- experiment memory
- hypothesis memory
- disproof memory
- learned-rule memory
- evidence ledger

Each memory item should have a confidence/provenance field and an expiration/revalidation strategy where appropriate.

## 7. Experiment planner

Select the least-risk experiment capable of distinguishing hypotheses.

Before execution:
- verify authorization
- verify target/environment
- verify toolchain
- verify commit
- verify dependencies
- verify isolation
- verify credentials are disposable or absent
- set timeout/resource limits
- define rollback
- define expected evidence

After execution:
- capture stdout/stderr
- logs
- state before/after
- network trace where permitted
- artifact hashes
- exact command
- environment metadata
- result
- invariant evaluation

## 8. Confirmation gate

A candidate can become `confirmed` only when:
- in scope
- invariant is explicit
- root cause is understood
- attack preconditions are proven
- experiment is reproducible
- decisive evidence exists
- impact is demonstrated or rigorously established
- duplicate/known-issue review is completed
- exact commit is pinned

Otherwise use `inconclusive`, `disproved`, `duplicate`, `known-issue`, or `out-of-scope`.

## 9. Research scheduler

The campaign orchestrator should score *research value*, not "bug likelihood" alone.

Suggested dimensions:
- invariant proximity
- exposure
- impact potential
- evidence quality
- exploit precondition simplicity
- novelty uncertainty
- experiment cost
- reproducibility
- historical change activity
- counterevidence strength

Never use a score as proof.

## 10. Coverage map

Show what Shakuni knows and what it does not know:

- languages covered
- files covered
- symbols mapped
- entry points mapped
- trust boundaries mapped
- invariants tested
- experiments run
- hypotheses disproved
- hypotheses unresolved
- runtime capabilities missing
- toolchain gaps
- external analysis gaps

Unknown is a valid state.

## 11. Human control

Require human approval before:
- high-risk experiments
- anything that could affect a shared environment
- credential use
- network activity beyond explicitly authorized boundaries
- publishing/submitting a bounty report

The system can prepare the action; approval controls execution where required.

## 12. Final report

Every claim in the final report should resolve to evidence:
- program and scope
- repository/commit
- component
- attacker model
- preconditions
- root cause
- invariant
- reproduction
- expected vs actual
- trace
- impact
- duplicate/known issue analysis
- remediation context
- evidence hashes

## 13. Product philosophy

ArchSetu gives Shakuni **understanding**.

GitHub gives Shakuni **development history**.

The bounty program gives Shakuni **permission and constraints**.

The constitution gives Shakuni **research discipline**.

The cognitive engine gives Shakuni **alternative reasoning paths**.

The experiment engine gives Shakuni **reality checks**.

The evidence ledger gives Shakuni **memory and reproducibility**.

Together:

**Understand → Connect → Question → Test → Observe → Disprove/Confirm → Learn → Re-search → Reproduce → Report**
