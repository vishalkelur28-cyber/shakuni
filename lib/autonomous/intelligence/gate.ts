import type { GateResult, GateStatus, RuntimeEvidence } from "./types.ts";

/**
 * Deterministic evidence gate, the AUTHORITY.
 *
 * Pure functions, no model, no randomness. Given the runtime evidence booleans
 * it returns the gate matrix and the adjudicated verdict. Nothing in the
 * reasoning layer can change this output: the gate never reads analyst text,
 * confidence, or claims. This is what makes "AI is not evidence" enforceable.
 */

export const GATE_ORDER = [
  "scope_confirmed",
  "policy_checks_passed",
  "real_code_executed",
  "attacker_controlled_input",
  "invariant_checked",
  "invariant_broken",
  "minimized_reproducer",
  "negative_control_passed",
  "independent_reproduction",
  "impact_demonstrated",
  "history_checked",
  "current_commit_affected",
  "no_disallowed_testing",
] as const;

export function evaluateGates(r: RuntimeEvidence): Record<string, GateStatus> {
  const p = (b: boolean): GateStatus => (b ? "PASS" : "FAIL");
  return {
    scope_confirmed: p(r.scopeConfirmed),
    policy_checks_passed: p(r.policyChecksPassed),
    real_code_executed: p(r.realCodeExecuted),
    attacker_controlled_input: p(r.attackerControlledInput),
    invariant_checked: p(r.invariantChecked),
    invariant_broken: p(r.invariantBroken),
    minimized_reproducer: p(r.minimizedReproducer),
    negative_control_passed: p(r.negativeControlPassed),
    independent_reproduction: p(r.independentReproduction),
    impact_demonstrated: p(r.impactDemonstrated),
    history_checked: p(r.historyChecked),
    current_commit_affected: p(r.currentCommitAffected),
    no_disallowed_testing: p(!(r.disruptionUsed || r.realFundsUsed || r.thirdPartyDataAccessed)),
  };
}

export function gateFailures(gates: Record<string, GateStatus>): string[] {
  return GATE_ORDER.filter((k) => gates[k] !== "PASS");
}

/**
 * READY_FOR_HUMAN_REVIEW: every gate PASS. Adjudication is deterministic:
 *  - safety/scope/policy failure  → ON_HOLD (blocked; cannot proceed)
 *  - history says not affected     → DISPROVED
 *  - no invariant violation        → INCONCLUSIVE (if not really tested) / HYPOTHESIS (tested, held)
 *  - invariant violation + all gates → SUBMIT_RECOMMENDED (exploitability demonstrated)
 *  - invariant violation + gaps    → ON_HOLD (missing gates listed)
 */
export function adjudicate(r: RuntimeEvidence): GateResult {
  const gates = evaluateGates(r);
  const missing = gateFailures(gates);
  const readyForHumanReview = missing.length === 0;

  const base = { gates, exploitabilityDemonstrated: false, readyForHumanReview, missingGates: missing };

  if (gates.no_disallowed_testing === "FAIL") {
    return { ...base, readyForHumanReview: false, verdict: "ON_HOLD", reason: "Disallowed testing was used (disruption / real funds / third-party data). Blocked." };
  }
  if (gates.scope_confirmed === "FAIL" || gates.policy_checks_passed === "FAIL") {
    return { ...base, readyForHumanReview: false, verdict: "ON_HOLD", reason: "Scope or policy gate failed; cannot proceed without confirmed authorization." };
  }
  if (r.historyChecked && !r.currentCommitAffected) {
    return { ...base, readyForHumanReview: false, verdict: "DISPROVED", reason: "History shows the current/pinned commit is not affected (the behavior was introduced and already fixed, or is intentional)." };
  }
  if (!r.invariantBroken) {
    if (!r.realCodeExecuted || !r.invariantChecked) {
      return { ...base, verdict: "INCONCLUSIVE", reason: "The real implementation was not executed against the stated invariant, so nothing can be concluded." };
    }
    return { ...base, verdict: "HYPOTHESIS", reason: "Real code executed and the invariant held, no violation reproduced. An interesting lead with insufficient evidence; absence of a violation is not proof of safety." };
  }
  // invariant broken
  if (readyForHumanReview) {
    return { ...base, exploitabilityDemonstrated: true, verdict: "SUBMIT_RECOMMENDED", reason: "The real implementation violated the stated invariant under attacker-controlled input, with minimized reproducer, passing negative control, independent reproduction, demonstrated impact, and history/scope/policy confirmed." };
  }
  return { ...base, verdict: "ON_HOLD", reason: `The invariant broke on real code, but required evidence is incomplete: ${missing.join(", ")}.` };
}
