import type { HarnessResult } from "../rust-harness.ts";
import type { RepoHypothesis } from "../report.ts";
import type { Manifest } from "../ingest.ts";
import { adjudicate } from "./gate.ts";
import { heuristicAnalyst } from "./analyst.ts";
import type { Analyst, AnalystInput, IntelligenceResult, RuntimeEvidence } from "./types.ts";

export * from "./types.ts";
export { adjudicate, evaluateGates, gateFailures, GATE_ORDER } from "./gate.ts";
export { heuristicAnalyst, defaultAnalyst } from "./analyst.ts";

export interface DeriveParams {
  repository: string;
  commit: string;
  scopeNote: string | null;
  authorization: string;
  inScope: boolean;
  /** The lead being adjudicated (the highest-priority one with a harness, else the top lead). */
  hypothesis: RepoHypothesis;
  /** Harness results relevant to this campaign. */
  executed: HarnessResult[];
  surface: { entryPoints?: number; languages?: Record<string, number> };
  manifest?: Manifest;
  /** True when PR/history data was available and consulted. */
  historyChecked: boolean;
  /** Set true only when history shows the current/pinned commit is NOT affected (already fixed). */
  currentCommitNotAffected?: boolean;
  /** Evidence a human/engine confirmed for a BROKEN result (default all false, conservative). */
  confirmed?: Partial<Pick<RuntimeEvidence, "negativeControlPassed" | "independentReproduction" | "impactDemonstrated" | "minimizedReproducer">>;
}

/** Map the engine's real evidence into the gate's runtime booleans. Conservative by default. */
export function deriveRuntimeEvidence(p: DeriveParams): RuntimeEvidence {
  const ran = p.executed.filter((h) => h.result !== "ERROR");
  const broken = p.executed.filter((h) => h.result === "BROKEN");
  const c = p.confirmed ?? {};
  return {
    scopeConfirmed: p.inScope,
    policyChecksPassed: true, // local-only workflow; no disruption / funds / third-party data
    realCodeExecuted: ran.length > 0,
    attackerControlledInput: p.executed.length > 0,
    invariantChecked: p.executed.length > 0,
    invariantBroken: broken.length > 0,
    minimizedReproducer: c.minimizedReproducer ?? broken.some((h) => Boolean(h.counterexample)),
    negativeControlPassed: c.negativeControlPassed ?? false,
    independentReproduction: c.independentReproduction ?? false,
    impactDemonstrated: c.impactDemonstrated ?? false,
    historyChecked: p.historyChecked,
    currentCommitAffected: !p.currentCommitNotAffected,
    disruptionUsed: false,
    realFundsUsed: false,
    thirdPartyDataAccessed: false,
  };
}

export function buildAnalystInput(p: DeriveParams, runtime: RuntimeEvidence): AnalystInput {
  const prExcerpts = p.hypothesis.crossRefs
    .filter((c) => c.source === "github-pr")
    .slice(0, 4)
    .map((c) => ({ label: c.label, url: c.url, fixish: c.signal === "possibly-fixed" }));
  return {
    target: { repository: p.repository, commit: p.commit, scope: p.scopeNote, authorization: p.authorization },
    hypothesis: {
      id: p.hypothesis.id,
      title: p.hypothesis.title,
      claim: p.hypothesis.rationale,
      invariant: p.hypothesis.title,
      suspectedImpact: p.hypothesis.vulnClass,
      attackerControl: "randomized, protocol-shaped inputs driving the real component",
    },
    harnessSummaries: p.executed.map((h) => ({ property: h.property, crate: h.crate, result: h.result, cases: h.iters, checks: h.quorumsVerified })),
    prExcerpts,
    surface: { entryPoints: p.surface.entryPoints, languages: p.surface.languages, topDirs: p.manifest?.topDirs },
    runtime,
  };
}

/**
 * Reason (deterministic analyst) → adjudicate (deterministic gate).
 * Fully synchronous and offline; no network, no model, no API key. The gate is
 * the authority and ignores all analyst output.
 */
export function runIntelligence(p: DeriveParams, analyst: Analyst = heuristicAnalyst): IntelligenceResult {
  const runtime = deriveRuntimeEvidence(p);
  const input = buildAnalystInput(p, runtime);
  const intelligence = analyst.analyze(input);
  const gate = adjudicate(runtime);
  return { hypothesisId: p.hypothesis.id, runtime, gate, intelligence };
}
