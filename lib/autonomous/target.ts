/**
 * Target abstraction for the autonomous hunter.
 *
 * The hunter never knows whether it is attacking the synthetic benchmark, a
 * real contract on a fork, or anything else. It only sees: a starting state,
 * a list of actions, a way to apply one, a relational abstraction of a state,
 * generic invariants over before/after, and an impact measure.
 *
 * INTEGRITY RULE: a Target must never hand the hunter the answer. No action
 * named after the bug, no invariant hardcoded to the planted sequence, no
 * ground-truth import. The hunter discovers violations from observable state.
 */

/** Opaque protocol state. Shape is the Target's business; the hunter treats it as data. */
export type TargetState = Record<string, number | boolean | string>;

/** A relational view of a state: the hunter searches and dedups over THIS, not raw fields. */
export type Abstraction = ReadonlyArray<string | number | boolean>;

/** One detected invariant violation. `id` is a stable name; `detail` is human-facing. */
export interface Violation {
  id: string;
  detail: string;
}

export interface ImpactReport {
  /** True only when the before→after transition has a concrete, security-relevant consequence. */
  real: boolean;
  /** Named, measurable deltas that justify `real` (e.g. { finalized: 1, authorityDrift: 1024 }). */
  deltas: Record<string, number | boolean | string>;
  summary: string;
}

export interface Target<S extends TargetState = TargetState> {
  /** Stable identifier for provenance in findings. */
  readonly id: string;
  /** Human-facing name. */
  readonly name: string;
  /** A fresh starting state. Called for every independent replay, must not share mutable state. */
  reset(): S;
  /** Every action the hunter may try, as plain string names. */
  actions(): readonly string[];
  /** Apply one action to a state, returning a NEW state. Must not mutate the input. */
  apply(state: S, action: string): S;
  /** Relational abstraction used for search scoring and dedup. Focus on relationships, not raw values. */
  abstract(state: S): Abstraction;
  /** Generic invariants evaluated over a transition. Return every violation observed. */
  invariants(before: S, after: S): Violation[];
  /** Measure whether a start→end transition has real security impact. */
  impact(start: S, end: S): ImpactReport;
  /**
   * Optional: which subsystem an action touches, for cross-layer diversity scoring.
   * Cross-subsystem sequences are prioritized because real failures are often cross-layer.
   */
  subsystemOf?(action: string): string | null;
}
