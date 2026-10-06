import { decideGate } from "./gate.ts";
import type { AutoFinding } from "./finding.ts";
import { causalControls, measureImpact, minimize, replay } from "./prove.ts";
import { search, type SearchOptions } from "./search.ts";
import type { Target, TargetState } from "./target.ts";

export interface HuntOptions extends Partial<SearchOptions> {
  replays?: number;
  /** True for the synthetic benchmark (may reach GREEN_SYNTHETIC). Real targets: false. */
  synthetic?: boolean;
}

/**
 * The autonomous hunt pipeline:
 *   search (no ground truth) → minimize → causal step-removal → replay → impact → gate.
 *
 * Returns one structured finding. A null violation yields a DISPROVEN finding
 * with the search stats (useful signal: "looked, found nothing in budget").
 */
export function hunt<S extends TargetState>(target: Target<S>, options: HuntOptions = {}): AutoFinding {
  const opts: SearchOptions = {
    maxDepth: options.maxDepth ?? 16,
    budget: options.budget ?? 2_000_000,
    beamWidth: options.beamWidth ?? 120,
  };
  const replays = options.replays ?? 3;
  const synthetic = options.synthetic ?? false;
  const createdAt = new Date().toISOString();

  const { candidate, stats } = search(target, opts);
  if (!candidate) {
    const gate = decideGate({ hasViolation: false, minimalPath: [], causalAllResolved: false, replaysAllHit: false, replayCount: 0, impactReal: false, synthetic });
    return { targetId: target.id, targetName: target.name, status: gate.status, violation: null, discoveryPath: [], minimalPath: [], necessarySteps: [], causalControls: [], replays: [], impact: null, gateReasons: gate.reasons, stats, createdAt };
  }

  const violation = candidate.violations[0];
  const minimal = minimize(target, candidate.path, violation.id);
  const controls = causalControls(target, minimal, violation.id);
  const replayResults = replay(target, minimal, violation.id, replays);
  const impact = measureImpact(target, minimal);

  const gate = decideGate({
    hasViolation: true,
    minimalPath: minimal,
    causalAllResolved: controls.every((c) => c.necessary),
    replaysAllHit: replayResults.every((r) => r.hit),
    replayCount: replayResults.filter((r) => r.hit).length,
    impactReal: impact.real,
    synthetic,
  });

  return {
    targetId: target.id,
    targetName: target.name,
    status: gate.status,
    violation,
    discoveryPath: candidate.path,
    minimalPath: minimal,
    necessarySteps: controls.filter((c) => c.necessary).map((c) => c.action),
    causalControls: controls,
    replays: replayResults,
    impact,
    gateReasons: gate.reasons,
    stats,
    createdAt,
  };
}
