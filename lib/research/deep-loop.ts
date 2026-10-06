import type { Hypothesis, EvidenceRecord, AlternatePath } from "../intelligence/constitution";

export type ResearchStage =
  | "program"
  | "architecture"
  | "attack-surface"
  | "hypothesis"
  | "counterexample"
  | "experiment"
  | "evidence"
  | "reproduction"
  | "impact"
  | "scope"
  | "duplicate"
  | "human-review"
  | "closed";

export type BranchStatus = "queued" | "running" | "blocked" | "disproved" | "survives" | "complete";

export interface ResearchObservation {
  id: string;
  stage: ResearchStage;
  claim: string;
  supports: string[];
  contradicts: string[];
  evidenceIds: string[];
  assumptionChanged?: string;
}

export interface ResearchBranch {
  id: string;
  parentId?: string;
  question: string;
  purpose: string;
  status: BranchStatus;
  stage: ResearchStage;
  safety: "local" | "testnet" | "human-approval";
  observations: ResearchObservation[];
  nextQuestions: string[];
}

export interface ExperimentPlan {
  id: string;
  branchId: string;
  objective: string;
  positiveControl: string;
  negativeControl: string;
  requiredEvidence: string[];
  environment: "local" | "testnet";
  prohibitedActions: string[];
  humanApprovalRequired: boolean;
}

export interface DeepResearchCase {
  id: string;
  hypothesis: Hypothesis;
  stage: ResearchStage;
  branches: ResearchBranch[];
  experiments: ExperimentPlan[];
  observations: ResearchObservation[];
  evidence: EvidenceRecord[];
  blockedActions: string[];
  decisions: string[];
  stopReasons: string[];
  conclusion?: "disproved" | "inconclusive" | "reproduced" | "confirmed" | "out-of-scope" | "duplicate" | "known-issue";
}

export interface DeepResearchPolicy {
  maxBranches: number;
  maxDepth: number;
  maxExperiments: number;
  requireNegativeControl: boolean;
  requireHumanApprovalForExternalExecution: boolean;
  mainnetAllowed: false;
}

export const DEFAULT_DEEP_RESEARCH_POLICY: DeepResearchPolicy = {
  maxBranches: 64,
  maxDepth: 8,
  maxExperiments: 24,
  requireNegativeControl: true,
  requireHumanApprovalForExternalExecution: true,
  mainnetAllowed: false,
};

const BASE_QUESTIONS = [
  ["architecture", "Where does the security property live across components, contracts, services, queues, nodes and state?"],
  ["attack-surface", "Which attacker-controlled entry points can reach the sensitive transition?"],
  ["counterexample", "What concrete observation would make this hypothesis false?"],
  ["history", "Did a PR, issue, commit or previous fix change this security property?"],
  ["dependency", "Does a dependency, generated component or upstream revision implement the relevant control?"],
  ["state", "Does ordering, replay, stale state, rollback or recovery change the result?"],
  ["identity", "Is identity, authorization, signature, domain or chain binding preserved?"],
  ["economic", "Does the proposed state transition violate an accounting or conservation property?"],
] as const;

export function createDeepResearchCase(hypothesis: Hypothesis, policy = DEFAULT_DEEP_RESEARCH_POLICY): DeepResearchCase {
  const root: ResearchBranch = {
    id: `${hypothesis.id}-root`,
    question: hypothesis.statement,
    purpose: "Determine whether the hypothesis can survive source, architecture, counterexample and safe runtime scrutiny.",
    status: "running",
    stage: "hypothesis",
    safety: "local",
    observations: [],
    nextQuestions: BASE_QUESTIONS.map(([, q]) => q),
  };

  const branches = [root, ...BASE_QUESTIONS.slice(0, Math.min(policy.maxBranches - 1, 8)).map(([kind, question], i) => ({
    id: `${hypothesis.id}-${kind}-${i + 1}`,
    parentId: root.id,
    question,
    purpose: `Independent ${kind} perspective on the same invariant.`,
    status: "queued" as const,
    stage: kind === "counterexample" ? "counterexample" as const : "architecture" as const,
    safety: "local" as const,
    observations: [],
    nextQuestions: [],
  }))];

  return {
    id: `case-${hypothesis.id}`,
    hypothesis,
    stage: "hypothesis",
    branches,
    experiments: [],
    observations: [],
    evidence: hypothesis.evidence,
    blockedActions: [
      "No Arc mainnet execution.",
      "No interaction with other users' accounts or wallets.",
      "No unauthorized data access, fund loss, service degradation or destructive testing.",
      "No public disclosure without program approval.",
    ],
    decisions: ["Static signals are leads only.", "A successful call is not a vulnerability verdict."],
    stopReasons: [],
  };
}

export function queueSafeExperiment(
  researchCase: DeepResearchCase,
  branchId: string,
  objective: string,
  environment: "local" | "testnet" = "local",
): DeepResearchCase {
  if (researchCase.experiments.length >= DEFAULT_DEEP_RESEARCH_POLICY.maxExperiments) {
    return { ...researchCase, stopReasons: [...researchCase.stopReasons, "Experiment budget reached."] };
  }

  const plan: ExperimentPlan = {
    id: `${researchCase.id}-exp-${researchCase.experiments.length + 1}`,
    branchId,
    objective,
    positiveControl: "Define the expected security-property-preserving control before mutation.",
    negativeControl: "Use a known-safe input/state transition and verify the same invariant remains satisfied.",
    requiredEvidence: [
      "Pinned repository commit and environment metadata.",
      "Input/mutation record.",
      "Execution trace and errors.",
      "State before/after comparison.",
      "Invariant evaluation.",
    ],
    environment,
    prohibitedActions: researchCase.blockedActions,
    humanApprovalRequired: environment === "testnet",
  };

  return { ...researchCase, experiments: [...researchCase.experiments, plan], stage: "experiment" };
}

export function recordObservation(
  researchCase: DeepResearchCase,
  branchId: string,
  observation: Omit<ResearchObservation, "id">,
): DeepResearchCase {
  const item = { ...observation, id: `${branchId}-obs-${researchCase.observations.length + 1}` };
  return {
    ...researchCase,
    observations: [...researchCase.observations, item],
    branches: researchCase.branches.map((b) => b.id === branchId ? {
      ...b,
      observations: [...b.observations, item],
      // A recorded counterexample is sticky: later supporting notes must not silently revive a disproved branch.
      status: item.contradicts.length || b.status === "disproved" ? "disproved" : "survives",
    } : b),
  };
}

export function generateAlternateResearchPaths(researchCase: DeepResearchCase, branchId: string, reason: string): ResearchBranch[] {
  const parent = researchCase.branches.find((b) => b.id === branchId);
  if (!parent) return [];

  const alternatives = [
    "Change the attacker-controlled entry point while keeping the invariant fixed.",
    "Change the state/ordering assumption while keeping the security property fixed.",
    "Move one layer earlier: parser, decoder, serializer or authorization boundary.",
    "Move one layer later: executor, persistence, consensus or settlement boundary.",
    "Compare the current implementation with historical PR/commit behavior.",
    "Compare two independent implementations or clients for the same invariant.",
  ];

  return alternatives.map((assumption, i) => ({
    id: `${branchId}-alt-${i + 1}`,
    parentId: branchId,
    question: `${assumption} Why could the same invariant fail there?`,
    purpose: `Continue research after disproof without repeating the failed path. Reason: ${reason}`,
    status: "queued" as const,
    stage: "hypothesis" as const,
    safety: "local" as const,
    observations: [],
    nextQuestions: [],
  }));
}

export function finalizeResearchCase(
  researchCase: DeepResearchCase,
  conclusion: DeepResearchCase["conclusion"],
): DeepResearchCase {
  if (conclusion === "confirmed" && !canConfirm(researchCase).allowed) {
    // Stay open: a refused confirmation is not a conclusion, the researcher still has work to do.
    return { ...researchCase, decisions: [...researchCase.decisions, "Confirmation blocked because required evidence is missing."] };
  }
  return { ...researchCase, conclusion, stage: "closed" };
}

export type ExperimentOutcome = "not-run" | "passed" | "failed" | "inconclusive" | "blocked";

export interface ExecutedExperiment {
  planId: string;
  outcome: ExperimentOutcome;
  startedAt: string;
  finishedAt: string;
  environment: "local" | "testnet";
  commitSha: string;
  traceHash: string;
  stateBeforeHash: string;
  stateAfterHash: string;
  invariantResult: "PASS" | "FAIL" | "NOT_APPLICABLE" | "INCONCLUSIVE";
  positiveControlPassed: boolean;
  negativeControlPassed: boolean;
  humanApproved: boolean;
}

export function attachExperimentOutcome(
  researchCase: DeepResearchCase,
  result: ExecutedExperiment,
): DeepResearchCase {
  const plan = researchCase.experiments.find(e => e.id === result.planId);
  if (!plan) return { ...researchCase, stopReasons: [...researchCase.stopReasons, `Unknown experiment plan: ${result.planId}`] };
  if (!result.commitSha || !result.traceHash || !result.stateBeforeHash || !result.stateAfterHash) {
    return { ...researchCase, stopReasons: [...researchCase.stopReasons, `Experiment ${result.planId} is missing reproducibility evidence.`] };
  }
  if (result.environment === "testnet" && !result.humanApproved) {
    return { ...researchCase, stopReasons: [...researchCase.stopReasons, `Experiment ${result.planId} attempted testnet execution without human approval.`] };
  }

  // A FAIL only counts as decisive when the negative control passed on the same
  // harness; otherwise the "break" may be a harness artifact.
  const controlPassed = result.negativeControlPassed === true;
  const decisiveFail = result.invariantResult === "FAIL" && controlPassed;

  const evidence: EvidenceRecord[] = [
    {
      id: `${result.planId}-runtime`,
      source: "runtime",
      claim: `Experiment ${result.planId} produced invariant result ${result.invariantResult}.`,
      strength: decisiveFail ? "decisive" : "strong",
      supports: decisiveFail ? [researchCase.hypothesis.id] : [],
      contradicts: result.invariantResult === "PASS" ? [researchCase.hypothesis.id] : [],
      // Honest labels: these are fork fingerprints and a run receipt, not a source commit or on-chain storage hashes.
      provenance: `forkFingerprint=${result.commitSha};runReceipt=${result.traceHash};stateBeforeFp=${result.stateBeforeHash};stateAfterFp=${result.stateAfterHash}`,
      immutableHash: result.traceHash,
    },
  ];

  const stopReasons = result.invariantResult === "FAIL" && !controlPassed
    ? [...researchCase.stopReasons, `Experiment ${result.planId} reported FAIL but its negative control did not pass; not decisive.`]
    : researchCase.stopReasons;

  return {
    ...researchCase,
    evidence: [...researchCase.evidence, ...evidence],
    decisions: [
      ...researchCase.decisions,
      `Experiment ${result.planId}: ${result.outcome}; invariant=${result.invariantResult}.`,
      `negative-control=${controlPassed ? "PASS" : "NOT_PASSED"} for ${result.planId}`,
    ],
    stopReasons,
    stage: result.invariantResult === "FAIL" ? "evidence" : result.outcome === "blocked" ? "scope" : "experiment",
  };
}

export function canConfirm(researchCase: DeepResearchCase): { allowed: boolean; missing: string[] } {
  const missing: string[] = [];
  const runtime = researchCase.evidence.filter((e) => e.source === "runtime" && e.strength === "decisive");
  if (!runtime.length) missing.push("Decisive runtime evidence");
  if (!researchCase.decisions.some((d) => d.includes("negative-control=PASS"))) missing.push("Passed negative control");
  if (!researchCase.observations.some((o) => o.stage === "reproduction" && o.supports.length)) missing.push("Independent reproduction observation");
  if (!researchCase.observations.some((o) => o.stage === "impact" && o.supports.length)) missing.push("Demonstrated impact observation");
  if (researchCase.stopReasons.length) missing.push("Unresolved stop conditions");
  return { allowed: missing.length === 0, missing };
}
