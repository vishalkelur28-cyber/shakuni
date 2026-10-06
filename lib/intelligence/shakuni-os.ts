/**
 * Shakuni Security Research OS
 *
 * Capability registry for the product's orchestration layer.
 * This file defines what the system understands and how evidence moves
 * through the research lifecycle. It does not claim that an adapter/runtime
 * exists merely because a capability is registered.
 */

export type CapabilityKind =
  | "ingestion"
  | "understanding"
  | "graph"
  | "hypothesis"
  | "experiment"
  | "evidence"
  | "learning"
  | "safety"
  | "reporting"
  | "orchestration";

export type ResearchState =
  | "intake"
  | "understanding"
  | "mapped"
  | "hypothesizing"
  | "experiment-ready"
  | "running"
  | "observed"
  | "disproved"
  | "inconclusive"
  | "reproduced"
  | "confirmed"
  | "duplicate"
  | "known-issue"
  | "out-of-scope"
  | "reported"
  | "closed";

export interface ShakuniCapability {
  id: string;
  name: string;
  kind: CapabilityKind;
  purpose: string;
  requires: string[];
  outputs: string[];
  safetyBoundary: string;
}

export const SHAKUNI_CAPABILITIES: ShakuniCapability[] = [
  {
    id: "program-intake",
    name: "Bug Bounty Program Intake",
    kind: "ingestion",
    purpose: "Normalize CSV, policy, scope, eligibility and research restrictions.",
    requires: ["program CSV or structured assets", "program policy"],
    outputs: ["normalized program profile", "scope rules", "eligibility rules"],
    safetyBoundary: "No asset is treated as authorized without explicit program scope.",
  },
  {
    id: "archsetu-understanding",
    name: "ArchSetu Understanding Bridge",
    kind: "understanding",
    purpose: "Understand existing repository analysis and reuse its structural knowledge.",
    requires: ["ArchSetu report or export"],
    outputs: ["functions", "call relationships", "entry points", "signals", "affected components"],
    safetyBoundary: "Static analysis is context, never a vulnerability verdict.",
  },
  {
    id: "github-history",
    name: "GitHub Collaboration Intelligence",
    kind: "understanding",
    purpose: "Understand PRs, issues, commits, reviews, comments and changed files.",
    requires: ["authorized repository access or exported GitHub data"],
    outputs: ["development timeline", "change context", "review context", "fix history"],
    safetyBoundary: "GitHub discussion is evidence/context, not proof by itself.",
  },
  {
    id: "multi-language",
    name: "Multi-language Program Understanding",
    kind: "understanding",
    purpose: "Map supported languages and configuration/infrastructure surfaces.",
    requires: ["repository"],
    outputs: ["language inventory", "component inventory", "coverage"],
    safetyBoundary: "Missing parser/toolchain is reported as a coverage gap.",
  },
  {
    id: "security-graph",
    name: "Unified Security Graph",
    kind: "graph",
    purpose: "Connect code, data flow, trust boundaries, identities, assets and security invariants.",
    requires: ["repository understanding", "program profile"],
    outputs: ["security graph", "trust boundaries", "sensitive sinks"],
    safetyBoundary: "Graph edges retain provenance and confidence.",
  },
  {
    id: "hypothesis-lab",
    name: "Hypothesis Laboratory",
    kind: "hypothesis",
    purpose: "Generate diverse, testable security hypotheses from graph and evidence.",
    requires: ["security graph", "invariants", "program rules"],
    outputs: ["ranked hypotheses", "counter-hypotheses", "test plans"],
    safetyBoundary: "No hypothesis becomes a finding without evidence.",
  },
  {
    id: "counterexample-engine",
    name: "Counterexample Engine",
    kind: "hypothesis",
    purpose: "Actively search for observations that would disprove each hypothesis.",
    requires: ["hypothesis", "invariant"],
    outputs: ["disproof tests", "counterexamples"],
    safetyBoundary: "Counterevidence is preserved rather than discarded.",
  },
  {
    id: "experiment-planner",
    name: "Safe Experiment Planner",
    kind: "experiment",
    purpose: "Translate hypotheses into least-risk reproducible experiments.",
    requires: ["hypothesis", "scope", "environment capabilities"],
    outputs: ["experiment plan", "preconditions", "rollback plan"],
    safetyBoundary: "Production/destructive/unauthorized experiments are blocked.",
  },
  {
    id: "trace-ledger",
    name: "Evidence & Trace Ledger",
    kind: "evidence",
    purpose: "Capture immutable provenance for inputs, commands, outputs, state and artifacts.",
    requires: ["experiment"],
    outputs: ["trace", "artifact hashes", "state delta", "reproduction package"],
    safetyBoundary: "Evidence cannot be silently rewritten.",
  },
  {
    id: "reproduction-lab",
    name: "Clean Reproduction Lab",
    kind: "experiment",
    purpose: "Re-run candidate findings in a clean environment.",
    requires: ["pinned commit", "experiment", "reproduction package"],
    outputs: ["reproduced", "not reproduced", "inconclusive"],
    safetyBoundary: "Confirmation requires reproducible evidence.",
  },
  {
    id: "duplicate-intelligence",
    name: "Known Issue & Duplicate Intelligence",
    kind: "understanding",
    purpose: "Compare candidates with issues, fixes, advisories and previous research.",
    requires: ["candidate", "repository history", "research sources"],
    outputs: ["new", "duplicate", "known issue", "patched", "inconclusive"],
    safetyBoundary: "Matching evidence is retained for human review.",
  },
  {
    id: "learning-ledger",
    name: "Verified Learning Ledger",
    kind: "learning",
    purpose: "Learn reusable research patterns only from verified outcomes.",
    requires: ["verified outcome", "evidence IDs"],
    outputs: ["provisional rule", "validated rule"],
    safetyBoundary: "Learned rules cannot override constitutional safety/invariant rules.",
  },
  {
    id: "campaign-orchestrator",
    name: "Research Campaign Orchestrator",
    kind: "orchestration",
    purpose: "Schedule and prioritize the next research action across hypotheses.",
    requires: ["hypothesis queue", "environment capabilities", "constitution"],
    outputs: ["next action", "blocked action", "completed action"],
    safetyBoundary: "Scope, safety and evidence gates are checked before execution.",
  },
  {
    id: "report-forensics",
    name: "Forensic Report Builder",
    kind: "reporting",
    purpose: "Generate reports directly from verified evidence and provenance.",
    requires: ["reproduced finding", "impact evidence", "scope result"],
    outputs: ["bounty report", "reproduction package", "evidence index"],
    safetyBoundary: "Report claims must map to evidence.",
  },
];

export function capability(id: string) {
  return SHAKUNI_CAPABILITIES.find(c => c.id === id);
}
