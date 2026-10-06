# Shakuni Deep Research Engine

Every security hypothesis receives an independent, evidence-preserving research case. A static signal, ArchSetu signal, GitHub discussion, scenario match, or successful function call is never itself a vulnerability verdict.

## Research lifecycle

Program Constitution → Repository/ArchSetu/GitHub understanding → Architecture → Attack Surface → Hypothesis → Counterexamples → Safe Experiments → Evidence → Reproduction → Impact → Scope → Duplicate/Known Issue → Human Review → Report.

## Per-hypothesis research tree

Each case creates bounded branches for architecture, attack surface, counterexamples, history, dependencies, state/ordering, identity/cryptography, and economics. A branch can survive, be disproved, be blocked, or complete. Disproof creates alternate paths only when the testable assumption changes. Identical failed paths are not repeated.

## Evidence requirements

Executed experiments require a pinned commit, environment, trace hash, state-before hash, state-after hash, invariant result, positive-control result, negative-control result, and human approval for testnet execution. Missing reproducibility evidence stops the case rather than producing a finding.

## Confirmation gate

Confirmation requires decisive runtime evidence, an executed negative control, independent reproduction evidence, demonstrated impact, and no unresolved stop conditions. The engine cannot weaken acceptance criteria to obtain a positive result.

## Arc safety

- Mainnet execution is hard-blocked.
- Unknown environments are rejected.
- Other users' accounts/data are prohibited.
- Unauthorized fund loss and service degradation are prohibited.
- Testnet execution requires human approval.
- Local execution is the default.
- Reports remain subject to the imported Arc program policy and HackerOne rules.

## AI / autonomy boundary

The engine is an orchestration and evidence system. It does not fabricate findings or submit autonomously. A human researcher must review and validate any potential finding before submission.
