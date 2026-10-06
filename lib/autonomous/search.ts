import { createHash } from "node:crypto";
import type { Abstraction, Target, TargetState, Violation } from "./target.ts";

/** A discovered candidate: the action path and the violations it triggered. */
export interface Candidate {
  path: string[];
  violations: Violation[];
}

export interface SearchOptions {
  maxDepth: number;
  /** Hard cap on states examined (search budget). */
  budget: number;
  /** Beam width: how many promising frontier nodes to keep per level. */
  beamWidth: number;
}

export interface SearchStats {
  examined: number;
  pruned: number;
  unique: number;
  depthReached: number;
}

export interface SearchResult {
  candidate: Candidate | null;
  stats: SearchStats;
}

function fingerprint(abs: Abstraction): string {
  return createHash("sha256").update(JSON.stringify(abs)).digest("hex").slice(0, 18);
}

/**
 * Score a transition: reward newly-changed relationships and cross-subsystem
 * diversity, penalise repetition. The hunter is NOT told which relationships
 * matter, every changed relation scores equally.
 */
function heuristic<S extends TargetState>(target: Target<S>, before: S, after: S, path: string[]): number {
  const a = target.abstract(before);
  const b = target.abstract(after);
  let score = 0;
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) score += 3;

  if (target.subsystemOf) {
    const subsystems = new Set<string>();
    for (const act of path) { const sub = target.subsystemOf(act); if (sub) subsystems.add(sub); }
    score += subsystems.size * 2; // cross-layer diversity
  }
  score -= Math.max(0, path.length - new Set(path).size) * 2; // repetition penalty
  return score;
}

interface Node<S> { score: number; state: S; path: string[]; }

/**
 * Deterministic beam search. Returns the first path that triggers any
 * invariant violation (the shallowest / highest-scoring such path), plus stats.
 */
export function search<S extends TargetState>(target: Target<S>, opts: SearchOptions): SearchResult {
  const actions = target.actions();
  const seen = new Set<string>();
  const stats: SearchStats = { examined: 0, pruned: 0, unique: 0, depthReached: 0 };

  let frontier: Node<S>[] = [{ score: 0, state: target.reset(), path: [] }];
  seen.add(fingerprint(target.abstract(frontier[0].state)));
  stats.unique = 1;

  for (let depth = 0; depth < opts.maxDepth; depth++) {
    const next: Node<S>[] = [];
    for (const node of frontier) {
      for (const action of actions) {
        if (stats.examined >= opts.budget) { stats.depthReached = depth; return { candidate: null, stats }; }
        stats.examined++;
        const after = target.apply(node.state, action);
        const path = [...node.path, action];

        const violations = target.invariants(node.state, after);
        if (violations.length) { stats.depthReached = depth + 1; return { candidate: { path, violations }, stats }; }

        const fp = fingerprint(target.abstract(after));
        if (seen.has(fp)) { stats.pruned++; continue; }
        seen.add(fp);
        stats.unique++;
        next.push({ score: node.score + heuristic(target, node.state, after, path), state: after, path });
      }
    }
    if (!next.length) { stats.depthReached = depth + 1; break; }
    // Keep the most promising, breaking ties toward shorter then lexicographic paths (deterministic).
    next.sort((x, y) => (y.score - x.score) || (x.path.length - y.path.length) || (x.path.join() < y.path.join() ? -1 : 1));
    frontier = next.slice(0, opts.beamWidth);
    stats.depthReached = depth + 1;
  }
  return { candidate: null, stats };
}
