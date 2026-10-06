import { ARC_PROGRAM_PROFILE } from "../programs/arc";
import { DEFAULT_DEEP_RESEARCH_POLICY } from "../research/deep-loop";
import { SHAKUNI_CONSTITUTION } from "../intelligence/constitution";
import { languageRegistry } from "../languages/registry";
import { coreInvariants } from "../security/registry";

export type CapabilityStatus = "GREEN" | "YELLOW" | "RED";

export interface ArcCapabilityCheck {
  id: string;
  name: string;
  status: CapabilityStatus;
  evidence: string;
  missing?: string[];
}

export interface ArcReadinessReport {
  status: CapabilityStatus;
  checks: ArcCapabilityCheck[];
  blockers: string[];
  nextActions: string[];
}

export function buildArcReadinessReport(input: {
  repositoryPinned: boolean;
  repositoryAnalyzed: boolean;
  runtimeVerified: boolean;
  consensusRuntimeVerified: boolean;
  signerRuntimeVerified: boolean;
  executionRuntimeVerified: boolean;
  reproductionHarnessVerified: boolean;
  duplicateIntelligenceVerified: boolean;
  humanApprovalConfigured: boolean;
}): ArcReadinessReport {
  const checks: ArcCapabilityCheck[] = [
    {
      id: "policy",
      name: "Arc program constitution",
      status: ARC_PROGRAM_PROFILE.researchEnvironments.length && ARC_PROGRAM_PROFILE.forbiddenEnvironments.includes("arc-mainnet") ? "GREEN" : "RED",
      evidence: "Arc profile encodes allowed local/devnet and testnet environments plus a mainnet prohibition.",
    },
    {
      id: "safety",
      name: "Deep-research safety policy",
      status: DEFAULT_DEEP_RESEARCH_POLICY.mainnetAllowed === false && DEFAULT_DEEP_RESEARCH_POLICY.requireHumanApprovalForExternalExecution ? "GREEN" : "RED",
      evidence: "Deep research defaults to local execution and requires human approval for external execution.",
    },
    {
      id: "constitution",
      name: "Research constitution",
      status: SHAKUNI_CONSTITUTION.includes("NO_STATIC_SIGNAL_EQUALS_VULNERABILITY") && SHAKUNI_CONSTITUTION.includes("REPRODUCTION_REQUIRED_FOR_CONFIRMATION") ? "GREEN" : "RED",
      evidence: "Static signals cannot become findings and confirmation requires reproduction.",
    },
    {
      id: "languages",
      name: "Multi-language coverage registry",
      status: languageRegistry.length >= 15 ? "GREEN" : "YELLOW",
      evidence: `${languageRegistry.length} language/configuration profiles are registered for analysis planning.`,
    },
    {
      id: "invariants",
      name: "Security invariant registry",
      status: coreInvariants.length >= 5 ? "GREEN" : "YELLOW",
      evidence: `${coreInvariants.length} executable invariant definitions are registered; runtime evaluation remains environment-dependent.`,
    },
    {
      id: "repo-pin",
      name: "Exact Arc repository + commit",
      status: input.repositoryPinned ? "GREEN" : "YELLOW",
      evidence: input.repositoryPinned ? "A repository commit is explicitly pinned for the campaign." : "No exact repository commit has been verified in this package.",
      missing: input.repositoryPinned ? undefined : ["Arc repository URL/path", "exact commit SHA", "provenance record"],
    },
    {
      id: "repo-analysis",
      name: "Actual repository analysis",
      status: input.repositoryAnalyzed ? "GREEN" : "YELLOW",
      evidence: input.repositoryAnalyzed ? "The supplied Arc repository has been analyzed by the research pipeline." : "The package contains analysis orchestration but no verified Arc repository run.",
      missing: input.repositoryAnalyzed ? undefined : ["run repository ingestion", "produce coverage report", "persist analysis provenance"],
    },
    {
      id: "runtime",
      name: "Arc runtime verification",
      status: input.runtimeVerified ? "GREEN" : "YELLOW",
      evidence: input.runtimeVerified ? "Runtime adapter has produced evidence for the campaign." : "No verified live Arc runtime evidence is bundled.",
      missing: input.runtimeVerified ? undefined : ["authorized local/devnet or testnet runtime", "trace capture", "state before/after"],
    },
    {
      id: "consensus",
      name: "Consensus runtime",
      status: input.consensusRuntimeVerified ? "GREEN" : "YELLOW",
      evidence: input.consensusRuntimeVerified ? "Consensus behavior has been exercised and traced." : "Consensus adapter/runtime is not verified by the package alone.",
    },
    {
      id: "execution",
      name: "Execution/state runtime",
      status: input.executionRuntimeVerified ? "GREEN" : "YELLOW",
      evidence: input.executionRuntimeVerified ? "Execution/state transitions have been exercised and compared." : "Execution-layer runtime evidence is not verified by the package alone.",
    },
    {
      id: "signer",
      name: "Remote signer/KMS runtime",
      status: input.signerRuntimeVerified ? "GREEN" : "YELLOW",
      evidence: input.signerRuntimeVerified ? "Signer authorization and signing-boundary behavior has been exercised." : "Signer/KMS runtime evidence is not verified by the package alone.",
    },
    {
      id: "repro",
      name: "Clean reproduction harness",
      status: input.reproductionHarnessVerified ? "GREEN" : "YELLOW",
      evidence: input.reproductionHarnessVerified ? "Independent reproduction is available." : "A clean independent reproduction run is not verified.",
    },
    {
      id: "duplicates",
      name: "Duplicate/known-issue verification",
      status: input.duplicateIntelligenceVerified ? "GREEN" : "YELLOW",
      evidence: input.duplicateIntelligenceVerified ? "Known issue / duplicate evidence was checked for the campaign." : "No campaign-specific duplicate/known-issue verification is verified.",
    },
    {
      id: "human",
      name: "Human validation gate",
      status: input.humanApprovalConfigured ? "GREEN" : "RED",
      evidence: input.humanApprovalConfigured ? "External/testnet execution and final confirmation require human approval." : "Human approval gate is not configured.",
    },
  ];

  const blockers = checks.filter(c => c.status === "RED").map(c => c.name);
  const yellow = checks.filter(c => c.status === "YELLOW");
  const status: CapabilityStatus = blockers.length ? "RED" : yellow.length ? "YELLOW" : "GREEN";
  const nextActions = checks.flatMap(c => c.missing ?? []).filter((x, i, a) => a.indexOf(x) === i);

  return { status, checks, blockers, nextActions };
}
