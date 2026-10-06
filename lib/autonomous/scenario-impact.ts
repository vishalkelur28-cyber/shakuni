// SHAKUNI ADDITION
// Scenario impact validation layer.
//
// This module does NOT decide that a vulnerability exists.
// It only records whether an already-reproduced failure has
// a demonstrated security-relevant consequence.
//
// A real BROKEN result must still come from the real execution
// and the existing deterministic gate.

export type ImpactClass =
  | "NONE"
  | "CONSISTENCY"
  | "INTEGRITY"
  | "AVAILABILITY"
  | "AUTHORIZATION"
  | "CONSENSUS_SAFETY"
  | "CONSENSUS_LIVENESS"
  | "ACCOUNTING";

export interface ImpactEvidence {
  scenarioId: string;
  property: string;

  reproduced: boolean;
  minimized: boolean;

  impactClass: ImpactClass;

  invariantViolated: boolean;

  securityRelevant: boolean;

  explanation: string;

  evidence: string[];

  createdAt: string;
}

// SHAKUNI ADDITION
export interface ImpactInput {
  scenarioId: string;
  property: string;

  reproduced: boolean;
  minimized: boolean;

  invariantViolated: boolean;

  impactClass: ImpactClass;

  explanation: string;

  evidence?: string[];
}

// SHAKUNI ADDITION
export function evaluateScenarioImpact(
  input: ImpactInput,
): ImpactEvidence {
  const evidence = [
    ...(input.evidence ?? []),
  ];

  if (input.reproduced) {
    evidence.push(
      "The failure was reproduced by the execution path.",
    );
  }

  if (input.minimized) {
    evidence.push(
      "A minimized reproducer was produced.",
    );
  }

  if (input.invariantViolated) {
    evidence.push(
      "The tested invariant was actually violated.",
    );
  }

  const securityRelevant =
    input.reproduced &&
    input.minimized &&
    input.invariantViolated &&
    input.impactClass !== "NONE";

  return {
    scenarioId: input.scenarioId,
    property: input.property,

    reproduced: input.reproduced,
    minimized: input.minimized,

    impactClass: input.impactClass,

    invariantViolated:
      input.invariantViolated,

    securityRelevant,

    explanation:
      input.explanation,

    evidence,

    createdAt:
      new Date().toISOString(),
  };
}

// SHAKUNI ADDITION
export function impactDemonstrated(
  evidence: ImpactEvidence,
): boolean {
  return (
    evidence.securityRelevant &&
    evidence.reproduced &&
    evidence.minimized &&
    evidence.invariantViolated &&
    evidence.impactClass !== "NONE"
  );
}

// SHAKUNI ADDITION
export function impactSummary(
  evidence: ImpactEvidence,
): string {
  return [
    `scenario=${evidence.scenarioId}`,
    `property=${evidence.property}`,
    `reproduced=${evidence.reproduced}`,
    `minimized=${evidence.minimized}`,
    `invariant_violated=${evidence.invariantViolated}`,
    `impact=${evidence.impactClass}`,
    `security_relevant=${evidence.securityRelevant}`,
  ].join(" ");
}