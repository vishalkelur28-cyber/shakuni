// SHAKUNI ADDITION
// Scenario campaign foundation.
// This file ONLY generates deterministic test scenarios.
// It does not modify Arc code and does not manufacture BROKEN results.

export type ScenarioCategory =
  | "BASELINE"
  | "BOUNDARY"
  | "ZERO"
  | "MAX_VALUE"
  | "NIL_VALUE"
  | "DUPLICATE"
  | "CONFLICT"
  | "REORDERING"
  | "REPLAY"
  | "MALFORMED_VALIDATION"
  | "PROPOSAL"
  | "PREVOTE"
  | "PRECOMMIT"
  | "LIVENESS"
  | "STREAM"
  | "SIGNATURE"
  | "ADDRESS"
  | "HEIGHT"
  | "ROUND"
  | "VALUE";

export type ScenarioSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface ShakuniScenario {
  id: string;
  repository: string;
  hypothesisId: string;

  category: ScenarioCategory;
  severity: ScenarioSeverity;

  seed: number;
  generationIndex: number;

  title: string;
  objective: string;

  messageType:
    | "Vote"
    | "Proposal"
    | "Liveness"
    | "ProposalPart"
    | "StreamMessage";

  voteType?: "Prevote" | "Precommit";

  height: number;
  round: number;

  valueKind: "Nil" | "ZeroHash" | "RandomHash" | "RepeatedHash";

  addressKind: "Zero" | "Repeated" | "Random";

  signatureKind: "Zero" | "Repeated" | "Random";

  expectedInvariant: string;

  adversarial: boolean;
  replayRequired: boolean;
  freshStateRequired: boolean;

  tags: string[];
}

// SHAKUNI ADDITION
export interface ScenarioCampaign {
  repository: string;
  hypothesisId: string;

  requested: number;
  generated: number;

  scenarios: ShakuniScenario[];

  createdAt: string;
}

// SHAKUNI ADDITION
function hashSeed(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

// SHAKUNI ADDITION
function nextRandom(state: { value: number }): number {
  state.value = (state.value + 0x6d2b79f5) >>> 0;

  let t = state.value;

  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return (t ^ (t >>> 14)) >>> 0;
}

// SHAKUNI ADDITION
function pick<T>(
  state: { value: number },
  values: readonly T[],
): T {
  return values[nextRandom(state) % values.length];
}

// SHAKUNI ADDITION
function scenarioCategories(): readonly ScenarioCategory[] {
  return [
    "BASELINE",
    "BOUNDARY",
    "ZERO",
    "MAX_VALUE",
    "NIL_VALUE",
    "DUPLICATE",
    "CONFLICT",
    "REORDERING",
    "REPLAY",
    "PROPOSAL",
    "PREVOTE",
    "PRECOMMIT",
    "LIVENESS",
    "STREAM",
    "SIGNATURE",
    "ADDRESS",
    "HEIGHT",
    "ROUND",
    "VALUE",
  ];
}

// SHAKUNI ADDITION
function buildScenario(
  repository: string,
  hypothesisId: string,
  index: number,
): ShakuniScenario {
  const seed = hashSeed(
    `${repository}:${hypothesisId}:scenario:${index}`,
  );

  const state = { value: seed };

  const category = pick(state, scenarioCategories());

  const messageType = pick(state, [
    "Vote",
    "Proposal",
    "Liveness",
    "ProposalPart",
    "StreamMessage",
  ] as const);

  const voteType =
    messageType === "Vote"
      ? pick(state, ["Prevote", "Precommit"] as const)
      : undefined;

  const heightMode = pick(state, [
    "zero",
    "one",
    "normal",
    "large",
  ] as const);

  const height =
    heightMode === "zero"
      ? 0
      : heightMode === "one"
        ? 1
        : heightMode === "large"
          ? 1_000_000
          : (nextRandom(state) % 10_000) + 1;

  const roundMode = pick(state, [
    "zero",
    "one",
    "normal",
    "large",
  ] as const);

  const round =
    roundMode === "zero"
      ? 0
      : roundMode === "one"
        ? 1
        : roundMode === "large"
          ? 10_000
          : nextRandom(state) % 128;

  const valueKind = pick(state, [
    "Nil",
    "ZeroHash",
    "RandomHash",
    "RepeatedHash",
  ] as const);

  const addressKind = pick(state, [
    "Zero",
    "Repeated",
    "Random",
  ] as const);

  const signatureKind = pick(state, [
    "Zero",
    "Repeated",
    "Random",
  ] as const);

  const adversarial =
    category === "CONFLICT" ||
    category === "REPLAY" ||
    category === "DUPLICATE" ||
    category === "REORDERING";

  const replayRequired =
    category === "REPLAY" ||
    adversarial;

  const freshStateRequired =
    category === "REPLAY" ||
    category === "DUPLICATE" ||
    category === "CONFLICT";

  const severity: ScenarioSeverity =
    category === "CONFLICT" ||
    category === "REPLAY" ||
    category === "LIVENESS"
      ? "CRITICAL"
      : category === "BOUNDARY" ||
          category === "PROPOSAL" ||
          category === "STREAM"
        ? "HIGH"
        : "MEDIUM";

  const id = `SHAKUNI-${hypothesisId}-${String(index + 1).padStart(5, "0")}`;

  return {
    id,
    repository,
    hypothesisId,

    category,
    severity,

    seed,
    generationIndex: index,

    title: `${messageType} ${category} scenario #${index + 1}`,

    objective:
      "Execute a valid consensus-message scenario against the real pinned implementation and detect any security-relevant semantic round-trip mismatch.",

    messageType,
    voteType,

    height,
    round,

    valueKind,
    addressKind,
    signatureKind,

    expectedInvariant:
      "A valid message encoded and decoded by the real codec must preserve every security-relevant semantic field.",

    adversarial,
    replayRequired,
    freshStateRequired,

    tags: [
      "arc-node",
      "netcodec",
      "roundtrip",
      messageType.toLowerCase(),
      category.toLowerCase(),
      severity.toLowerCase(),
    ],
  };
}

// SHAKUNI ADDITION
export function generateScenarioCampaign(
  repository = "circlefin/arc-node",
  hypothesisId = "node-codec-campaign",
  count = 5000,
): ScenarioCampaign {
  const requested = Math.max(1, Math.floor(count));

  const scenarios: ShakuniScenario[] = [];

  for (let index = 0; index < requested; index += 1) {
    scenarios.push(
      buildScenario(
        repository,
        hypothesisId,
        index,
      ),
    );
  }

  return {
    repository,
    hypothesisId,

    requested,
    generated: scenarios.length,

    scenarios,

    createdAt: new Date().toISOString(),
  };
}

// SHAKUNI ADDITION
export function generateScenarioBatch(
  repository = "circlefin/arc-node",
  hypothesisId = "node-codec-campaign",
  batchSize = 1000,
  batchNumber = 0,
): ShakuniScenario[] {
  const size = Math.max(1, Math.floor(batchSize));
  const offset = Math.max(0, Math.floor(batchNumber)) * size;

  const scenarios: ShakuniScenario[] = [];

  for (let i = 0; i < size; i += 1) {
    scenarios.push(
      buildScenario(
        repository,
        hypothesisId,
        offset + i,
      ),
    );
  }

  return scenarios;
}

// SHAKUNI ADDITION
export function getScenarioSummary(
  campaign: ScenarioCampaign,
): {
  total: number;
  adversarial: number;
  replayRequired: number;
  proposals: number;
  votes: number;
  liveness: number;
  streams: number;
  boundary: number;
} {
  return {
    total: campaign.scenarios.length,

    adversarial: campaign.scenarios.filter(
      (scenario) => scenario.adversarial,
    ).length,

    replayRequired: campaign.scenarios.filter(
      (scenario) => scenario.replayRequired,
    ).length,

    proposals: campaign.scenarios.filter(
      (scenario) => scenario.messageType === "Proposal",
    ).length,

    votes: campaign.scenarios.filter(
      (scenario) => scenario.messageType === "Vote",
    ).length,

    liveness: campaign.scenarios.filter(
      (scenario) => scenario.messageType === "Liveness",
    ).length,

    streams: campaign.scenarios.filter(
      (scenario) =>
        scenario.messageType === "ProposalPart" ||
        scenario.messageType === "StreamMessage",
    ).length,

    boundary: campaign.scenarios.filter(
      (scenario) =>
        scenario.category === "BOUNDARY" ||
        scenario.category === "ZERO" ||
        scenario.category === "MAX_VALUE",
    ).length,
  };
}

// SHAKUNI ADDITION
export function findScenario(
  campaign: ScenarioCampaign,
  scenarioId: string,
): ShakuniScenario | undefined {
  return campaign.scenarios.find(
    (scenario) => scenario.id === scenarioId,
  );
}

// SHAKUNI ADDITION
export function deduplicateScenarios(
  scenarios: ShakuniScenario[],
): ShakuniScenario[] {
  const seen = new Set<string>();
  const unique: ShakuniScenario[] = [];

  for (const scenario of scenarios) {
    const fingerprint = [
      scenario.messageType,
      scenario.voteType ?? "",
      scenario.height,
      scenario.round,
      scenario.valueKind,
      scenario.addressKind,
      scenario.signatureKind,
      scenario.category,
    ].join("|");

    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    unique.push(scenario);
  }

  return unique;
}