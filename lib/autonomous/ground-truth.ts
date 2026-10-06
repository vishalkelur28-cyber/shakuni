/**
 * Ground truth for the synthetic benchmark. The evaluator (test) knows the
 * answer; the hunter must not. ENGINE FILES MUST NEVER IMPORT THIS.
 * The test in tests/autonomous.test.ts enforces that no engine module imports it.
 */
export const GROUND_TRUTH = {
  violationId: "finality_preserves_authority_consistency",
  class: "emergent cross-layer finality/settlement safety failure",
  requiredConditions: ["authority drift", "pending work", "nonce divergence", "emergency"],
  // The minimal reproduction the designer planted (for grading only).
  minimalLength: 5,
  requiredActions: ["rotate_authority", "queue_claim", "enter_emergency"],
} as const;
