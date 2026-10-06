import { SHAKUNI_CONSTITUTION } from "./constitution";

export type ThinkingPerspective =
  | "attacker"
  | "defender"
  | "protocol"
  | "code"
  | "runtime"
  | "economic"
  | "consensus"
  | "cryptography"
  | "history"
  | "reviewer"
  | "counterexample"
  | "impact";

export type EvidenceKind = "archsetu" | "github" | "policy" | "runtime" | "source" | "issue" | "commit";

export interface ResearchContext {
  program: string;
  repository: string;
  commit?: string;
  scopeAssets: string[];
  externalSignals: string[];
  githubSignals: string[];
  invariants: string[];
}

export interface ThinkingBranch {
  id: string;
  perspective: ThinkingPerspective;
  question: string;
  evidenceNeeded: EvidenceKind[];
  nextActions: string[];
}

export interface HypothesisCandidate {
  id: string;
  statement: string;
  branches: string[];
  supportingEvidence: string[];
  counterEvidence: string[];
  confidence: "low" | "medium" | "high";
  status: "candidate" | "needs-evidence" | "disproved" | "confirmed";
}

export interface CognitivePlan {
  parallelBranches: ThinkingBranch[];
  convergenceRules: string[];
  memoryBuckets: string[];
  safetyConstraints: string[];
}

/**
 * Human-brain-inspired research orchestration.
 * It does not claim literal million-token or million-thought cognition.
 * Instead, it creates bounded, independent reasoning branches that can be
 * expanded by workers/LLMs later, then converges them against evidence.
 */
export function buildCognitivePlan(context: ResearchContext): CognitivePlan {
  const perspectives: Array<[ThinkingPerspective, string]> = [
    ["attacker", "What attacker-controlled input can reach a sensitive boundary?"],
    ["defender", "Which validation, authorization, and isolation controls should stop the path?"],
    ["protocol", "Which protocol rule or invariant must always hold?"],
    ["code", "Which functions, call paths, and state mutations implement the behavior?"],
    ["runtime", "What safe experiment could distinguish the competing explanations?"],
    ["economic", "Could a demonstrated state transition create measurable security or fund impact?"],
    ["consensus", "Could malformed, stale, conflicting, or replayed messages violate consensus assumptions?"],
    ["cryptography", "Are signatures, domains, identities, attestations, and key uses bound correctly?"],
    ["history", "What do previous commits, issues, and fixes say about this behavior?"],
    ["reviewer", "What alternative benign explanation would a maintainer give?"],
    ["counterexample", "What evidence would disprove this hypothesis?"],
    ["impact", "What exact security property changes if the hypothesis is demonstrated?"],
  ];

  return {
    parallelBranches: perspectives.map(([perspective, question], index) => ({
      id: `branch-${index + 1}`,
      perspective,
      question,
      evidenceNeeded:
        perspective === "history"
          ? ["github", "issue", "commit"]
          : perspective === "runtime"
            ? ["runtime", "source"]
            : ["source", "archsetu", "policy"],
      nextActions: [
        "Collect only evidence permitted by program scope.",
        "Record the exact source and version of every observation.",
        "Generate both supporting and disconfirming paths.",
      ],
    })),
    convergenceRules: [
      "Never treat one signal as a confirmed vulnerability.",
      "Prefer independent evidence from different sources.",
      "Preserve contradictory evidence instead of discarding it.",
      "Require an explicit invariant and reproducible evidence before confirmation.",
      "Separate facts, hypotheses, assumptions, and conclusions.",
      "Stop research paths that violate program scope or safety constraints.",
      ...SHAKUNI_CONSTITUTION.map(rule => `Constitution: ${rule}`),
    ],
    memoryBuckets: [
      "program-policy",
      "repository-provenance",
      "archsetu-understanding",
      "github-history",
      "trust-boundaries",
      "security-invariants",
      "hypotheses",
      "counterexamples",
      "experiments",
      "evidence",
      "known-issues",
    ],
    safetyConstraints: [
      "Authorized targets only.",
      "Prefer local, disposable, devnet, or testnet environments.",
      "No destructive production testing.",
      "No unauthorized data access or credential use.",
    ],
  };
}

export function expandHypothesisSearch(seed: string, branches: ThinkingBranch[]): string[] {
  return branches.map((branch) => `${branch.perspective}: investigate ${seed} through this question: ${branch.question}`);
}
