export type HypothesisStatus =
  | "candidate"
  | "investigating"
  | "disproved"
  | "inconclusive"
  | "reproduced"
  | "confirmed"
  | "out-of-scope"
  | "duplicate"
  | "known-issue";

export type EvidenceStrength = "weak" | "moderate" | "strong" | "decisive";

export type DisproofReason =
  | "scope-blocked"
  | "missing-precondition"
  | "trusted-boundary"
  | "sanitization"
  | "authorization"
  | "cryptographic-binding"
  | "state-invariant-holds"
  | "runtime-nonreproducible"
  | "environment-artifact"
  | "known-fix"
  | "duplicate"
  | "insufficient-evidence"
  | "other";

export interface EvidenceRecord {
  id: string;
  source: "archsetu" | "github" | "policy" | "source" | "runtime" | "issue" | "commit" | "human";
  claim: string;
  strength: EvidenceStrength;
  supports: string[];
  contradicts: string[];
  provenance: string;
  immutableHash?: string;
}

export interface Hypothesis {
  id: string;
  statement: string;
  invariant: string;
  preconditions: string[];
  status: HypothesisStatus;
  evidence: EvidenceRecord[];
  disproof?: {
    reason: DisproofReason;
    explanation: string;
    decisiveEvidenceIds: string[];
    blockedPaths: string[];
  };
  alternatePaths: AlternatePath[];
  learnedRules: LearnedRule[];
}

export interface AlternatePath {
  id: string;
  rationale: string;
  changedAssumption: string;
  nextQuestion: string;
  requiredEvidence: string[];
  safety: "safe-local" | "safe-testnet" | "human-approval";
}

export interface LearnedRule {
  id: string;
  rule: string;
  trigger: string;
  evidenceIds: string[];
  confidence: "provisional" | "validated";
  createdAt: string;
}

export interface ConstitutionalDecision {
  allowed: boolean;
  reasons: string[];
  requiredEvidence: string[];
  nextActions: string[];
}

/**
 * Shakuni Research Constitution.
 *
 * This is a control layer, not a vulnerability generator. Learning is
 * evidence-backed: verified outcomes may add reusable rules, but the engine
 * cannot weaken an invariant, delete failed evidence, or change acceptance
 * criteria merely to turn a hypothesis into a finding.
 */
export const SHAKUNI_CONSTITUTION = [
  "AUTHORIZED_SCOPE_ONLY",
  "PROVENANCE_FIRST",
  "ARCHSETU_IS_CONTEXT_NOT_VERDICT",
  "GITHUB_IS_CONTEXT_NOT_VERDICT",
  "SEPARATE_FACT_HYPOTHESIS_AND_CONCLUSION",
  "EXPLICIT_SECURITY_INVARIANT_REQUIRED",
  "ATTACKER_MODEL_REQUIRED",
  "PRECONDITIONS_MUST_BE_PROVEN",
  "NO_STATIC_SIGNAL_EQUALS_VULNERABILITY",
  "NO_RUNTIME_RESULT_EQUALS_ROOT_CAUSE_WITHOUT_TRACE",
  "COUNTEREVIDENCE_MUST_BE_PRESERVED",
  "DISPROOF_MUST_BE_EXPLAINED",
  "DISPROOF_MUST_GENERATE_ALTERNATE_PATHS",
  "ALTERNATE_PATHS_MUST_CHANGE_A_TESTABLE_ASSUMPTION",
  "DO_NOT_REPEAT_IDENTICAL_FAILED_EXPERIMENTS",
  "NO_EXPECTATION_WEAKENING",
  "NO_HARDCODED_PASS",
  "NO_SUPPRESSED_ERRORS",
  "NO_DELETED_FAILING_TESTS",
  "NO_FABRICATED_EVIDENCE",
  "NO_UNAUTHORIZED_PRODUCTION_TESTING",
  "PREFER_DISPOSABLE_SANDBOXES",
  "REPRODUCTION_REQUIRED_FOR_CONFIRMATION",
  "NEGATIVE_TEST_REQUIRED_WHEN_PRACTICAL",
  "KNOWN_ISSUE_AND_DUPLICATE_CHECK_REQUIRED",
  "COMMIT_PINNED_FOR_RESEARCH",
  "IMPACT_MUST_BE_DEMONSTRATED",
  "SELF_LEARNING_REQUIRES_VERIFIED_EVIDENCE",
  "LEARNED_RULES_CANNOT_OVERRIDE_CORE_INVARIANTS",
  "HUMAN_APPROVAL_FOR_HIGH_RISK_ACTIONS",
  "STOP_ON_SCOPE_VIOLATION",
  "STOP_ON_CREDENTIAL_OR_SECRET_EXPOSURE",
  "MINIMIZE_DATA_COLLECTION",
  "AUDIT_EVERY_DECISION",
  "PRESERVE_REPRODUCIBILITY",
] as const;

export function evaluateConstitution(h: Hypothesis): ConstitutionalDecision {
  const reasons: string[] = [];
  const requiredEvidence: string[] = [];
  const nextActions: string[] = [];

  if (!h.invariant) {
    reasons.push("No explicit security invariant is attached.");
    requiredEvidence.push("Define the invariant and its expected truth condition.");
  }
  if (!h.preconditions.length) {
    reasons.push("Attacker-controlled preconditions are not established.");
    requiredEvidence.push("Prove the minimum attacker preconditions.");
  }
  if (h.status === "confirmed" && !h.evidence.some(e => e.source === "runtime" && e.strength === "decisive")) {
    reasons.push("Confirmation lacks decisive runtime evidence.");
    requiredEvidence.push("Obtain reproducible runtime evidence in an authorized environment.");
  }

  if (reasons.length) {
    nextActions.push("Collect the missing evidence without changing the acceptance criteria.");
  } else {
    nextActions.push("Continue with the least-risk experiment that can distinguish remaining hypotheses.");
  }

  return {
    allowed: !reasons.some(r => r.includes("scope")),
    reasons,
    requiredEvidence,
    nextActions,
  };
}

export function explainDisproof(
  hypothesis: Hypothesis,
  reason: DisproofReason,
  explanation: string,
  decisiveEvidenceIds: string[],
): Hypothesis {
  const blockedPaths = hypothesis.alternatePaths.map(p => p.id);
  const alternatePaths = buildAlternatePaths(hypothesis, reason, explanation);

  return {
    ...hypothesis,
    status: "disproved",
    disproof: { reason, explanation, decisiveEvidenceIds, blockedPaths },
    alternatePaths,
  };
}

export function buildAlternatePaths(
  hypothesis: Hypothesis,
  reason: DisproofReason,
  explanation: string,
): AlternatePath[] {
  const common = {
    rationale: `The original path was disproved because: ${explanation}`,
    safety: "safe-local" as const,
    requiredEvidence: [
      "A new source or runtime observation that differs from the failed path.",
      "The same security invariant evaluated against the new path.",
    ],
  };

  const paths: AlternatePath[] = [
    {
      id: `${hypothesis.id}-alt-trust-boundary`,
      ...common,
      changedAssumption: "Change the assumed trust boundary or attacker-controlled entry point.",
      nextQuestion: "Is there another reachable entry point that crosses the same sensitive boundary?",
    },
    {
      id: `${hypothesis.id}-alt-state`,
      ...common,
      changedAssumption: "Change the state/sequence assumption while keeping the security property fixed.",
      nextQuestion: "Does a stale, replayed, conflicting, or reordered state transition expose the same invariant?",
    },
    {
      id: `${hypothesis.id}-alt-history`,
      ...common,
      changedAssumption: "Change the historical implementation assumption using PRs, issues, reviews, and commits.",
      nextQuestion: "Did another implementation or previously fixed path introduce the same security property elsewhere?",
    },
  ];

  if (reason === "authorization" || reason === "trusted-boundary") {
    paths.push({
      id: `${hypothesis.id}-alt-parser`,
      ...common,
      changedAssumption: "Move the investigation to a parser/decoder boundary before authorization.",
      nextQuestion: "Can malformed or ambiguous input alter the data that authorization evaluates?",
    });
  }

  if (reason === "cryptographic-binding") {
    paths.push({
      id: `${hypothesis.id}-alt-domain`,
      ...common,
      changedAssumption: "Change the domain, identity, chain, message, or replay-binding dimension.",
      nextQuestion: "Is a signature valid for the wrong domain, identity, chain, message, or lifecycle state?",
    });
  }

  return paths;
}

/**
 * Learning is deliberately conservative. Only a verified outcome can create
 * a reusable rule, and learned rules can never override constitutional rules.
 */
export function learnFromVerifiedOutcome(
  trigger: string,
  rule: string,
  evidenceIds: string[],
  verified: boolean,
): LearnedRule | null {
  if (!verified || evidenceIds.length === 0) return null;

  return {
    id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    rule,
    trigger,
    evidenceIds,
    confidence: "provisional",
    createdAt: new Date().toISOString(),
  };
}

export function promoteLearnedRule(rule: LearnedRule, corroboratingEvidenceIds: string[]): LearnedRule {
  return {
    ...rule,
    evidenceIds: [...new Set([...rule.evidenceIds, ...corroboratingEvidenceIds])],
    confidence: "validated",
  };
}
