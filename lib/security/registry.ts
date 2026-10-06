export const securityProperties = [
  "consensus-safety",
  "consensus-liveness",
  "authentication",
  "authorization",
  "replay-resistance",
  "signature-integrity",
  "state-integrity",
  "transaction-integrity",
  "key-isolation",
  "serialization-safety",
  "deserialization-safety",
  "access-control",
  "resource-integrity",
  "economic-integrity",
  "oracle-integrity",
  "upgrade-security",
  "cross-chain-message-integrity",
  "attestation-integrity",
  "webhook-authenticity",
] as const;

export type SecurityProperty = (typeof securityProperties)[number];

export type InvariantResult =
  | "PASS"
  | "FAIL"
  | "NOT_APPLICABLE"
  | "INCONCLUSIVE";

export interface SecurityInvariant {
  id: string;
  property: SecurityProperty;
  statement: string;
  preconditions: string[];
  observables: string[];
  failureCondition: string;
  evidenceRequired: string[];
}

export const coreInvariants: SecurityInvariant[] = [
  {
    id: "INV-CONSENSUS-001",
    property: "consensus-safety",
    statement: "Only valid authenticated validator messages may influence consensus state.",
    preconditions: ["consensus runtime is active"],
    observables: ["votes", "round", "height", "commit", "finality"],
    failureCondition: "an unauthorized or invalid message changes consensus outcome",
    evidenceRequired: ["trace", "state-before", "state-after"],
  },
  {
    id: "INV-REPLAY-001",
    property: "replay-resistance",
    statement: "A previously accepted security-sensitive message cannot be reused outside its valid context.",
    preconditions: ["message has previously been accepted"],
    observables: ["nonce", "sequence", "domain", "state"],
    failureCondition: "replayed input causes an unauthorized state transition",
    evidenceRequired: ["original-input", "replay-input", "state-diff"],
  },
  {
    id: "INV-SIGNER-001",
    property: "key-isolation",
    statement: "An unauthorized caller cannot cause an unauthorized validator/private-key signature.",
    preconditions: ["signing boundary is available"],
    observables: ["caller", "authorization", "signed-message", "key-id"],
    failureCondition: "unauthorized signing occurs",
    evidenceRequired: ["request-trace", "authorization-result", "signing-result"],
  },
  {
    id: "INV-CCTP-001",
    property: "cross-chain-message-integrity",
    statement: "An unauthorized or invalid cross-chain message cannot cause an unauthorized destination-side state transition.",
    preconditions: ["CCTP-compatible test environment"],
    observables: ["message", "attestation", "burn", "mint", "destination-state"],
    failureCondition: "invalid cross-chain input causes unauthorized mint/state change",
    evidenceRequired: ["message", "attestation", "destination-trace", "state-diff"],
  },
  {
    id: "INV-WEBHOOK-001",
    property: "webhook-authenticity",
    statement: "An unverified webhook cannot trigger a security-sensitive state transition.",
    preconditions: ["webhook endpoint exists"],
    observables: ["signature", "key-id", "timestamp", "event", "state"],
    failureCondition: "unsigned, invalidly signed, or replayed webhook is accepted",
    evidenceRequired: ["request", "signature-verification", "state-diff"],
  },
];
