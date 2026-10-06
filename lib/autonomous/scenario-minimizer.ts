// SHAKUNI ADDITION
// Scenario minimization layer.
//
// Purpose:
// Take an already reproduced failure and progressively remove/change
// parts of its input while checking whether the failure still reproduces.
//
// This module NEVER creates a failure.
// It only minimizes an existing one.

export interface MinimizationStep {
  step: number;
  description: string;
  accepted: boolean;
  state: unknown;
  timestamp: string;
}

export interface MinimizationResult {
  scenarioId: string;

  original: unknown;
  minimized: unknown;

  originalComplexity: number;
  minimizedComplexity: number;

  failurePreserved: boolean;

  steps: MinimizationStep[];

  attempts: number;

  createdAt: string;
}

// SHAKUNI ADDITION
export interface MinimizerInput {
  scenarioId: string;

  failingInput: unknown;

  /**
   * The caller supplies the real execution predicate.
   *
   * true  = the failure still reproduces
   * false = the failure disappeared
   */
  stillFails: (
    candidate: unknown,
  ) => Promise<boolean>;

  /**
   * Produces smaller candidates from the current input.
   *
   * The actual Arc message structure remains owned by
   * the real harness.
   */
  simplify: (
    current: unknown,
  ) => unknown[];
}

// SHAKUNI ADDITION
function complexity(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "string") {
    return value.length;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return 1;
  }

  if (Array.isArray(value)) {
    return (
      1 +
      value.reduce<number>(
        (total, item) =>
          total + complexity(item),
        0,
      )
    );
  }

  if (typeof value === "object") {
    const values = Object.values(
      value as Record<string, unknown>,
    );

    return (
      1 +
      values.reduce<number>(
        (total, item) =>
          total + complexity(item),
        0,
      )
    );
  }

  return 1;
}

// SHAKUNI ADDITION
export async function minimizeScenario(
  input: MinimizerInput,
): Promise<MinimizationResult> {
  let current = input.failingInput;

  const original = current;

  const steps: MinimizationStep[] = [];

  let attempts = 0;
  let stepNumber = 0;

  // First verify that the supplied failure is actually reproducible.
  const originalStillFails =
    await input.stillFails(current);

  attempts += 1;

  if (!originalStillFails) {
    return {
      scenarioId: input.scenarioId,

      original,
      minimized: original,

      originalComplexity: complexity(original),
      minimizedComplexity: complexity(original),

      failurePreserved: false,

      steps: [
        {
          step: 1,
          description:
            "Initial failure could not be reproduced by the minimizer.",
          accepted: false,
          state: current,
          timestamp:
            new Date().toISOString(),
        },
      ],

      attempts,

      createdAt:
        new Date().toISOString(),
    };
  }

  let changed = true;

  while (changed) {
    changed = false;

    const candidates =
      input.simplify(current);

    for (const candidate of candidates) {
      attempts += 1;

      const candidateStillFails =
        await input.stillFails(candidate);

      stepNumber += 1;

      if (
        candidateStillFails &&
        complexity(candidate) <
          complexity(current)
      ) {
        current = candidate;
        changed = true;

        steps.push({
          step: stepNumber,

          description:
            "Accepted smaller candidate because the failure remained reproducible.",

          accepted: true,

          state: candidate,

          timestamp:
            new Date().toISOString(),
        });

        break;
      }

      steps.push({
        step: stepNumber,

        description:
          "Rejected candidate because it did not preserve the reproduced failure or was not smaller.",

        accepted: false,

        state: candidate,

        timestamp:
          new Date().toISOString(),
      });
    }
  }

  // Final verification after minimization.
  const finalStillFails =
    await input.stillFails(current);

  attempts += 1;

  return {
    scenarioId: input.scenarioId,

    original,
    minimized: current,

    originalComplexity:
      complexity(original),

    minimizedComplexity:
      complexity(current),

    failurePreserved:
      finalStillFails,

    steps,

    attempts,

    createdAt:
      new Date().toISOString(),
  };
}

// SHAKUNI ADDITION
export function minimizationPassed(
  result: MinimizationResult,
): boolean {
  return (
    result.failurePreserved &&
    result.minimizedComplexity <=
      result.originalComplexity
  );
}

// SHAKUNI ADDITION
export function minimizationSummary(
  result: MinimizationResult,
): string {
  return [
    `scenario=${result.scenarioId}`,
    `failure_preserved=${result.failurePreserved}`,
    `original_complexity=${result.originalComplexity}`,
    `minimized_complexity=${result.minimizedComplexity}`,
    `attempts=${result.attempts}`,
  ].join(" ");
}