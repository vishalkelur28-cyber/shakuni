// SHAKUNI ADDITION
// Scenario replay/evidence layer.
//
// This file does NOT declare a vulnerability.
// It records whether an already-discovered scenario can be
// reproduced against the same execution path.

export interface ReplayAttempt {
  attempt: number;
  reproduced: boolean;
  seed: number;
  counterexample?: string;
  timestamp: string;
}

export interface ReplayEvidence {
  scenarioId: string;
  property: string;
  seed: number;

  attempts: ReplayAttempt[];

  requiredReplays: number;
  successfulReplays: number;

  independentlyReproduced: boolean;

  firstCounterexample?: string;

  createdAt: string;
}

// SHAKUNI ADDITION
export interface ReplayInput {
  scenarioId: string;
  property: string;
  seed: number;

  /**
   * The caller supplies the actual execution function.
   *
   * This keeps this module independent from Rust/Cargo and prevents
   * the replay layer from inventing execution results.
   */
  execute: (
    seed: number,
  ) => Promise<{
    reproduced: boolean;
    counterexample?: string;
  }>;

  replayCount?: number;
}

// SHAKUNI ADDITION
export async function replayScenario(
  input: ReplayInput,
): Promise<ReplayEvidence> {
  const requiredReplays = Math.max(
    3,
    Math.floor(input.replayCount ?? 5),
  );

  const attempts: ReplayAttempt[] = [];

  for (let attempt = 1; attempt <= requiredReplays; attempt += 1) {
    const result = await input.execute(input.seed);

    attempts.push({
      attempt,
      reproduced: result.reproduced,
      seed: input.seed,
      counterexample: result.counterexample,
      timestamp: new Date().toISOString(),
    });
  }

  const successfulReplays = attempts.filter(
    (attempt) => attempt.reproduced,
  ).length;

  const firstFailure = attempts.find(
    (attempt) => attempt.reproduced,
  );

  return {
    scenarioId: input.scenarioId,
    property: input.property,
    seed: input.seed,

    attempts,

    requiredReplays,
    successfulReplays,

    independentlyReproduced:
      successfulReplays >= requiredReplays,

    firstCounterexample:
      firstFailure?.counterexample,

    createdAt: new Date().toISOString(),
  };
}

// SHAKUNI ADDITION
export function replayPassed(
  evidence: ReplayEvidence,
): boolean {
  return (
    evidence.requiredReplays >= 3 &&
    evidence.successfulReplays === evidence.requiredReplays &&
    evidence.independentlyReproduced
  );
}

// SHAKUNI ADDITION
export function replaySummary(
  evidence: ReplayEvidence,
): string {
  return [
    `scenario=${evidence.scenarioId}`,
    `property=${evidence.property}`,
    `seed=${evidence.seed}`,
    `replays=${evidence.successfulReplays}/${evidence.requiredReplays}`,
    `independent_reproduction=${evidence.independentlyReproduced}`,
    evidence.firstCounterexample
      ? `counterexample=${evidence.firstCounterexample}`
      : "counterexample=none",
  ].join(" ");
}