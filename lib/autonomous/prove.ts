import type { ImpactReport, Target, TargetState, Violation } from "./target.ts";

/** Run a path from a fresh state and report whether a target violation id appeared. */
export function execute<S extends TargetState>(
  target: Target<S>,
  path: string[],
  violationId: string,
): { hit: boolean; start: S; end: S; violations: Violation[] } {
  const start = target.reset();
  let state = start;
  const all: Violation[] = [];
  for (const action of path) {
    const after = target.apply(state, action);
    for (const v of target.invariants(state, after)) if (!all.some((x) => x.id === v.id)) all.push(v);
    state = after;
  }
  return { hit: all.some((v) => v.id === violationId), start, end: state, violations: all };
}

/**
 * Delta-debugging minimization: drop any action whose removal still reproduces
 * the same violation. Returns the smallest path that keeps the violation.
 */
export function minimize<S extends TargetState>(target: Target<S>, path: string[], violationId: string): string[] {
  let current = [...path];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < current.length; i++) {
      const trial = current.slice(0, i).concat(current.slice(i + 1));
      if (trial.length && execute(target, trial, violationId).hit) { current = trial; changed = true; break; }
    }
  }
  return current;
}

export interface CausalControl {
  kind: "remove-step";
  action: string;
  index: number;
  /** A step is NECESSARY when removing it eliminates the violation (so `necessary` = !hit-after-removal). */
  necessary: boolean;
}

/** For each step in a (minimized) path, remove it and check the violation disappears. */
export function causalControls<S extends TargetState>(target: Target<S>, path: string[], violationId: string): CausalControl[] {
  return path.map((action, i) => {
    const without = path.slice(0, i).concat(path.slice(i + 1));
    const stillHits = without.length ? execute(target, without, violationId).hit : false;
    return { kind: "remove-step", action, index: i, necessary: !stillHits };
  });
}

export interface ReplayResult { index: number; hit: boolean; startFp: string; endFp: string; }

/** Run the path N times from fresh state; each replay must independently reproduce the violation. */
export function replay<S extends TargetState>(target: Target<S>, path: string[], violationId: string, times: number): ReplayResult[] {
  const out: ReplayResult[] = [];
  for (let i = 0; i < times; i++) {
    const r = execute(target, path, violationId);
    out.push({
      index: i,
      hit: r.hit,
      startFp: JSON.stringify(target.abstract(r.start)),
      endFp: JSON.stringify(target.abstract(r.end)),
    });
  }
  return out;
}

export function measureImpact<S extends TargetState>(target: Target<S>, path: string[]): ImpactReport {
  const r = execute(target, path, "__none__");
  return target.impact(r.start, r.end);
}
