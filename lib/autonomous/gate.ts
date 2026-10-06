import type { AutoFinding, AutoStatus } from "./finding.ts";

export interface GateInput {
  hasViolation: boolean;
  minimalPath: string[];
  causalAllResolved: boolean;
  replaysAllHit: boolean;
  replayCount: number;
  impactReal: boolean;
  /** Synthetic benchmark may reach GREEN_SYNTHETIC; real targets cap at YELLOW pending human review. */
  synthetic: boolean;
}

export function decideGate(i: GateInput): { status: AutoStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (!i.hasViolation) reasons.push("No invariant violation was reproduced.");
  if (!i.minimalPath.length) reasons.push("No minimal reproduction was produced.");
  if (!i.causalAllResolved) reasons.push("Not every minimal step was shown to be necessary (step-removal controls).");
  if (!i.replaysAllHit || i.replayCount < 3) reasons.push(`Fewer than 3 clean independent replays reproduced it (had ${i.replayCount}).`);
  if (!i.impactReal) reasons.push("No measurable security impact was demonstrated.");
  if (reasons.length) return { status: i.hasViolation ? "YELLOW" : "DISPROVEN", reasons };
  if (!i.synthetic) return { status: "YELLOW", reasons: ["All automated checks passed. Real-target findings require human confirmation before GREEN, this is the point where Shakuni's confirmation gate and human review take over."] };
  return { status: "GREEN_SYNTHETIC", reasons: ["All synthetic-benchmark requirements met."] };
}

export function isFullyProven(f: AutoFinding): boolean {
  return f.status === "GREEN_SYNTHETIC" || (f.status === "YELLOW" && f.gateReasons.length === 1 && /human confirmation/i.test(f.gateReasons[0]));
}

// ============================================================================

// ADDITIONAL SHAKUNI GATE INTELLIGENCE

// ============================================================================

// IMPORTANT:

// - The original gate implementation above is UNCHANGED.

// - decideGate() remains the ONLY existing status decision.

// - These additions do NOT override decideGate().

// - These additions do NOT promote real targets to GREEN.

// - These additions provide evidence auditing, memory, diagnostics,

//   contradiction detection, and research-quality analysis.

// ============================================================================





/**

 * Detailed evidence categories remembered by the gate layer.

 *

 * This is intentionally separate from GateInput so the original public

 * interface remains unchanged.

 */

export type GateEvidenceType =

  | "INVARIANT"

  | "MINIMAL_PATH"

  | "CAUSALITY"

  | "REPLAY"

  | "IMPACT"

  | "COUNTEREXAMPLE"

  | "DISPROOF"

  | "SCOPE"

  | "COMMIT"

  | "HARNESS"

  | "OBSERVATION";



/**

 * A single piece of evidence associated with a gate evaluation.

 */

export interface GateEvidence {

  id: string;



  type: GateEvidenceType;



  description: string;



  source?: string;



  repository?: string;



  commit?: string;



  hypothesisId?: string;



  /**

   * Whether this evidence was generated independently from another

   * evidence item.

   */

  independent: boolean;



  /**

   * Whether the evidence can be reproduced.

   */

  reproducible: boolean;



  timestamp: string;

}



/**

 * Historical information retained for a hypothesis.

 *

 * This does not decide truth. It tells the next run what has already

 * happened.

 */

export interface GateMemory {

  hypothesisId?: string;



  repository?: string;



  commit?: string;



  previousStatuses: AutoStatus[];



  evidence: GateEvidence[];



  replayResults: GateReplayMemory[];



  causalChecks: GateCausalMemory[];



  impactChecks: GateImpactMemory[];



  disproofs: GateDisproofMemory[];



  contradictions: GateContradiction[];



  alternateHypotheses: string[];



  failedAssumptions: string[];



  lastEvaluatedAt?: string;

}



/**

 * Replay-level memory.

 */

export interface GateReplayMemory {

  replayId: string;



  result:

    | "HIT"

    | "MISS"

    | "ERROR"

    | "BLOCKED";



  independent: boolean;



  inputFingerprint?: string;



  outputFingerprint?: string;



  timestamp: string;

}



/**

 * Causal-step evidence.

 */

export interface GateCausalMemory {

  step: string;



  necessary: boolean;



  removalTested: boolean;



  removalResult:

    | "BREAKS_REPRODUCTION"

    | "STILL_REPRODUCES"

    | "NOT_TESTED";



  timestamp: string;

}



/**

 * Security-impact evidence.

 */

export interface GateImpactMemory {

  category:

    | "FUNDS"

    | "AUTHORITY"

    | "CONSENSUS"

    | "ACCOUNTING"

    | "AVAILABILITY"

    | "INTEGRITY"

    | "CONFIDENTIALITY"

    | "OTHER";



  demonstrated: boolean;



  description: string;



  timestamp: string;

}



/**

 * A recorded disproof.

 */

export interface GateDisproofMemory {

  claim: string;



  reason: string;



  failedAssumption: string;



  counterexample?: string;



  timestamp: string;

}



/**

 * Contradictory evidence is important because Shakuni should not silently

 * discard evidence that disagrees with a hypothesis.

 */

export interface GateContradiction {

  evidenceA: string;



  evidenceB: string;



  explanation: string;



  resolved: boolean;



  timestamp: string;

}



/**

 * Detailed audit result.

 *

 * This is diagnostic information only.

 * It does not replace decideGate().

 */

export interface GateEvidenceAudit {

  complete: boolean;



  evidenceCount: number;



  independentEvidenceCount: number;



  reproducibleEvidenceCount: number;



  duplicateEvidenceCount: number;



  contradictionCount: number;



  unresolvedContradictionCount: number;



  missingEvidence: string[];



  warnings: string[];



  strengths: string[];

}



/**

 * Detailed gate-quality analysis.

 */

export interface GateQualityReport {

  gateStatus: AutoStatus;



  proofCompleteness: number;



  replayStrength: number;



  causalStrength: number;



  impactStrength: number;



  evidenceStrength: number;



  audit: GateEvidenceAudit;



  nextActions: string[];



  cannotPromoteBecause: string[];

}



/**

 * In-process gate memory.

 *

 * This is deliberately separate from the original gate decision.

 */

const SHAKUNI_GATE_MEMORY =

  new Map<string, GateMemory>();



/**

 * Normalize a memory key.

 */

function normalizeGateMemoryKey(

  repository: string,

  hypothesisId?: string,

): string {

  return [

    repository.trim().toLowerCase(),

    hypothesisId?.trim().toLowerCase() ?? "unknown",

  ].join("::");

}



/**

 * Get or create historical gate memory.

 */

export function getGateMemory(

  repository: string,

  hypothesisId?: string,

  commit?: string,

): GateMemory {

  const key =

    normalizeGateMemoryKey(

      repository,

      hypothesisId,

    );



  const existing =

    SHAKUNI_GATE_MEMORY.get(key);



  if (existing) {

    return existing;

  }



  const memory: GateMemory = {

    hypothesisId,



    repository,



    commit,



    previousStatuses: [],



    evidence: [],



    replayResults: [],



    causalChecks: [],



    impactChecks: [],



    disproofs: [],



    contradictions: [],



    alternateHypotheses: [],



    failedAssumptions: [],

  };



  SHAKUNI_GATE_MEMORY.set(

    key,

    memory,

  );



  return memory;

}



/**

 * Remember a gate status.

 *

 * This does not change the status.

 */

export function rememberGateStatus(

  repository: string,

  status: AutoStatus,

  hypothesisId?: string,

  commit?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

      commit,

    );



  memory.previousStatuses.push(

    status,

  );



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Add evidence to gate memory.

 */

export function rememberGateEvidence(

  repository: string,

  evidence: GateEvidence,

  hypothesisId?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

      evidence.commit,

    );



  memory.evidence.push(

    evidence,

  );



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Remember replay information.

 */

export function rememberGateReplay(

  repository: string,

  replay: GateReplayMemory,

  hypothesisId?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

    );



  memory.replayResults.push(

    replay,

  );



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Remember a causal step.

 */

export function rememberCausalCheck(

  repository: string,

  causal: GateCausalMemory,

  hypothesisId?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

    );



  memory.causalChecks.push(

    causal,

  );



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Remember demonstrated impact.

 */

export function rememberImpactCheck(

  repository: string,

  impact: GateImpactMemory,

  hypothesisId?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

    );



  memory.impactChecks.push(

    impact,

  );



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Record a disproof.

 */

export function rememberGateDisproof(

  repository: string,

  disproof: GateDisproofMemory,

  hypothesisId?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

    );



  memory.disproofs.push(

    disproof,

  );



  memory.failedAssumptions.push(

    disproof.failedAssumption,

  );



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Check whether two evidence descriptions are effectively duplicated.

 */

function evidenceDuplicate(

  a: GateEvidence,

  b: GateEvidence,

): boolean {

  return (

    a.type === b.type &&

    a.description.trim().toLowerCase() ===

      b.description.trim().toLowerCase()

  );

}



/**

 * Audit the evidence associated with a hypothesis.

 *

 * This is intentionally conservative.

 */

export function auditGateEvidence(

  memory: GateMemory,

): GateEvidenceAudit {

  const missingEvidence: string[] = [];

  const warnings: string[] = [];

  const strengths: string[] = [];



  let duplicateEvidenceCount = 0;



  for (

    let i = 0;

    i < memory.evidence.length;

    i += 1

  ) {

    for (

      let j = i + 1;

      j < memory.evidence.length;

      j += 1

    ) {

      if (

        evidenceDuplicate(

          memory.evidence[i],

          memory.evidence[j],

        )

      ) {

        duplicateEvidenceCount += 1;

      }

    }

  }



  const independentEvidenceCount =

    memory.evidence.filter(

      (x) => x.independent,

    ).length;



  const reproducibleEvidenceCount =

    memory.evidence.filter(

      (x) => x.reproducible,

    ).length;



  const unresolvedContradictionCount =

    memory.contradictions.filter(

      (x) => !x.resolved,

    ).length;



  if (!memory.evidence.length) {

    missingEvidence.push(

      "No evidence has been recorded.",

    );

  }



  if (

    independentEvidenceCount === 0

  ) {

    missingEvidence.push(

      "No independently generated evidence is recorded.",

    );

  }



  if (

    reproducibleEvidenceCount === 0

  ) {

    missingEvidence.push(

      "No reproducible evidence is recorded.",

    );

  }



  if (

    memory.replayResults.length === 0

  ) {

    missingEvidence.push(

      "No replay evidence is recorded.",

    );

  }



  if (

    memory.causalChecks.length === 0

  ) {

    missingEvidence.push(

      "No causal step-removal evidence is recorded.",

    );

  }



  if (

    memory.impactChecks.length === 0

  ) {

    missingEvidence.push(

      "No impact evidence is recorded.",

    );

  }



  if (duplicateEvidenceCount > 0) {

    warnings.push(

      `${duplicateEvidenceCount} duplicate evidence item(s) detected.`,

    );

  }



  if (

    unresolvedContradictionCount > 0

  ) {

    warnings.push(

      `${unresolvedContradictionCount} unresolved evidence contradiction(s) detected.`,

    );

  }



  if (

    independentEvidenceCount >= 3

  ) {

    strengths.push(

      "Multiple independent evidence items are present.",

    );

  }



  if (

    reproducibleEvidenceCount >= 3

  ) {

    strengths.push(

      "Multiple reproducible evidence items are present.",

    );

  }



  if (

    memory.replayResults.filter(

      (x) =>

        x.result === "HIT" &&

        x.independent,

    ).length >= 3

  ) {

    strengths.push(

      "At least three independent replay hits are recorded.",

    );

  }



  return {

    complete:

      missingEvidence.length === 0 &&

      unresolvedContradictionCount === 0,



    evidenceCount:

      memory.evidence.length,



    independentEvidenceCount,



    reproducibleEvidenceCount,



    duplicateEvidenceCount,



    contradictionCount:

      memory.contradictions.length,



    unresolvedContradictionCount,



    missingEvidence,



    warnings,



    strengths,

  };

}



/**

 * Calculate replay strength.

 *

 * This does not change the existing replay requirement in decideGate().

 */

export function calculateReplayStrength(

  memory: GateMemory,

): number {

  const independentHits =

    memory.replayResults.filter(

      (x) =>

        x.result === "HIT" &&

        x.independent,

    ).length;



  const independentAttempts =

    memory.replayResults.filter(

      (x) => x.independent,

    ).length;



  if (!independentAttempts) {

    return 0;

  }



  return Math.min(

    1,

    independentHits /

      Math.max(

        3,

        independentAttempts,

      ),

  );

}



/**

 * Calculate causal proof strength.

 */

export function calculateCausalStrength(

  memory: GateMemory,

): number {

  if (!memory.causalChecks.length) {

    return 0;

  }



  const resolved =

    memory.causalChecks.filter(

      (x) =>

        x.removalTested &&

        x.necessary &&

        x.removalResult ===

          "BREAKS_REPRODUCTION",

    ).length;



  return Math.min(

    1,

    resolved /

      memory.causalChecks.length,

  );

}



/**

 * Calculate demonstrated impact strength.

 */

export function calculateImpactStrength(

  memory: GateMemory,

): number {

  if (!memory.impactChecks.length) {

    return 0;

  }



  const demonstrated =

    memory.impactChecks.filter(

      (x) => x.demonstrated,

    ).length;



  return Math.min(

    1,

    demonstrated /

      memory.impactChecks.length,

  );

}



/**

 * Build a detailed quality report from an already-decided gate result.

 *

 * IMPORTANT:

 * The passed gate status is treated as authoritative.

 * This function never changes it.

 */

export function buildGateQualityReport(

  gate: {

    status: AutoStatus;

    reasons: string[];

  },

  memory: GateMemory,

): GateQualityReport {

  const audit =

    auditGateEvidence(memory);



  const replayStrength =

    calculateReplayStrength(memory);



  const causalStrength =

    calculateCausalStrength(memory);



  const impactStrength =

    calculateImpactStrength(memory);



  const evidenceStrength =

    memory.evidence.length === 0

      ? 0

      : Math.min(

          1,

          audit.independentEvidenceCount /

            Math.max(

              3,

              memory.evidence.length,

            ),

        );



  const proofCompleteness =

    (

      replayStrength +

      causalStrength +

      impactStrength +

      evidenceStrength

    ) / 4;



  const cannotPromoteBecause =

    [

      ...gate.reasons,

      ...audit.missingEvidence,

      ...audit.warnings,

    ];



  const nextActions: string[] = [];



  if (replayStrength < 1) {

    nextActions.push(

      "Increase independent clean replay coverage.",

    );

  }



  if (causalStrength < 1) {

    nextActions.push(

      "Run step-removal controls for every minimal reproduction step.",

    );

  }



  if (impactStrength < 1) {

    nextActions.push(

      "Demonstrate measurable security impact with reproducible evidence.",

    );

  }



  if (

    audit.unresolvedContradictionCount >

    0

  ) {

    nextActions.push(

      "Resolve contradictory evidence before treating the research result as settled.",

    );

  }



  if (!nextActions.length) {

    nextActions.push(

      "Continue independent validation and preserve the deterministic gate boundary.",

    );

  }



  return {

    gateStatus:

      gate.status,



    proofCompleteness,



    replayStrength,



    causalStrength,



    impactStrength,



    evidenceStrength,



    audit,



    nextActions,



    cannotPromoteBecause,

  };

}



/**

 * Determine whether historical evidence contains unresolved contradictions.

 *

 * This does NOT resolve the contradiction automatically.

 */

export function hasUnresolvedGateContradictions(

  repository: string,

  hypothesisId?: string,

): boolean {

  const memory =

    SHAKUNI_GATE_MEMORY.get(

      normalizeGateMemoryKey(

        repository,

        hypothesisId,

      ),

    );



  if (!memory) {

    return false;

  }



  return memory.contradictions.some(

    (x) => !x.resolved,

  );

}



/**

 * Record a contradiction without deciding which side is correct.

 */

export function rememberGateContradiction(

  repository: string,

  contradiction: GateContradiction,

  hypothesisId?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

    );



  memory.contradictions.push(

    contradiction,

  );



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Record an alternate hypothesis.

 */

export function rememberAlternateHypothesis(

  repository: string,

  hypothesis: string,

  hypothesisId?: string,

): GateMemory {

  const memory =

    getGateMemory(

      repository,

      hypothesisId,

    );



  if (

    !memory.alternateHypotheses.includes(

      hypothesis,

    )

  ) {

    memory.alternateHypotheses.push(

      hypothesis,

    );

  }



  memory.lastEvaluatedAt =

    new Date().toISOString();



  return memory;

}



/**

 * Return historical gate memory as a defensive copy.

 */

export function snapshotGateMemory(

  repository: string,

  hypothesisId?: string,

): GateMemory | undefined {

  const memory =

    SHAKUNI_GATE_MEMORY.get(

      normalizeGateMemoryKey(

        repository,

        hypothesisId,

      ),

    );



  if (!memory) {

    return undefined;

  }



  return structuredClone(memory);

}



/**

 * Remove one repository/hypothesis memory bucket.

 *

 * This affects memory only.

 * It does not affect findings or gate decisions.

 */

export function clearGateMemory(

  repository: string,

  hypothesisId?: string,

): boolean {

  return SHAKUNI_GATE_MEMORY.delete(

    normalizeGateMemoryKey(

      repository,

      hypothesisId,

    ),

  );

}