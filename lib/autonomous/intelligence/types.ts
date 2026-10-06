/**
 * Autonomous Intelligence + Evidence Adjudication layer, types.
 *
 * Design rule (non-negotiable): the reasoning layer ANALYSES; the deterministic
 * gate DECIDES. No reasoning output, no confidence, no "critical" claim, can
 * move the verdict. The gate reads only the runtime evidence booleans.
 */

export type IntelVerdict =
  | "HYPOTHESIS"
  | "ON_HOLD"
  | "DISPROVED"
  | "INCONCLUSIVE"
  | "EXPLOITABILITY_DEMONSTRATED"
  | "SUBMIT_RECOMMENDED";

export type GateStatus = "PASS" | "FAIL";

/** The only inputs the deterministic gate is allowed to read. */
export interface RuntimeEvidence {
  scopeConfirmed: boolean;
  policyChecksPassed: boolean;
  realCodeExecuted: boolean;
  attackerControlledInput: boolean;
  invariantChecked: boolean;
  invariantBroken: boolean;
  minimizedReproducer: boolean;
  negativeControlPassed: boolean;
  independentReproduction: boolean;
  impactDemonstrated: boolean;
  historyChecked: boolean;
  currentCommitAffected: boolean;
  /** Must stay false for a bounty-safe local/testnet workflow. */
  disruptionUsed?: boolean;
  realFundsUsed?: boolean;
  thirdPartyDataAccessed?: boolean;
}

export interface Branch {
  name: "architecture" | "attack_surface" | "state" | "identity" | "economic" | "history" | "dependencies" | "counterexample";
  conclusion: string;
  supportingEvidence: string[];
  contradictions: string[];
  missingEvidence: string[];
  /** Heuristic only. The gate IGNORES this, it is never evidence. */
  confidence: number;
}

export interface Contradiction {
  a: string;
  b: string;
  resolution: string;
  resolvingExperiment: string;
  resolved: boolean;
}

export interface Intelligence {
  analyst: string;
  overallAssessment: string;
  branches: Branch[];
  contradictions: Contradiction[];
  strongestArgumentFor: string[];
  strongestArgumentAgainst: string[];
  nextExperiments: string[];
  evidenceRequests: string[];
}

export interface GateResult {
  gates: Record<string, GateStatus>;
  verdict: IntelVerdict;
  exploitabilityDemonstrated: boolean;
  readyForHumanReview: boolean;
  missingGates: string[];
  reason: string;
}

/** What the analyst sees. Facts only, never asked to execute or to decide the verdict. */
export interface AnalystInput {
  target: { repository: string; commit: string; scope?: string | null; authorization: string };
  hypothesis: { id: string; title: string; claim: string; invariant: string; suspectedImpact: string; attackerControl: string };
  harnessSummaries: { property: string; crate: string; result: string; cases: number; checks: number }[];
  prExcerpts: { label: string; url?: string; fixish: boolean }[];
  surface: { entryPoints?: number; languages?: Record<string, number>; topDirs?: { dir: string; files: number }[] };
  runtime: RuntimeEvidence;
  priorContradictions?: Contradiction[];
}

/**
 * A deterministic, synchronous local analyzer. The synchronous-only signature is
 * deliberate: a model/API call is inherently asynchronous, so this type cannot
 * hold one. Swapping analyzers is limited to offline deterministic functions.
 */
export interface Analyst {
  readonly name: string;
  analyze(input: AnalystInput): Intelligence;
}

export interface IntelligenceResult {
  hypothesisId: string;
  runtime: RuntimeEvidence;
  gate: GateResult;
  intelligence: Intelligence;
}
