export const ARC_PROGRAM_PROFILE = {
  id: "arc-bbp",
  name: "Arc Bug Bounty Program",
  operator: "Circle Internet Contract Services, LLC",
  researchEnvironments: ["local-devnet", "arc-testnet"] as const,
  forbiddenEnvironments: ["arc-mainnet"] as const,
  requiresReproducibility: true,
  requiresDetailedSteps: true,
  oneVulnerabilityPerReport: true,
  minimumAge: 18,
  reportsLanguage: "English",
  researcherOwnedAccountsOnly: true,
  noPublicDisclosureWithoutApproval: true,
  humanValidationBeforeSubmission: true,
  prohibitedActions: [
    "Accessing, modifying, copying, downloading or deleting others' data",
    "Accessing non-public information without authorization",
    "Service degradation, interruption or denial",
    "Unauthorized loss of funds",
    "Social engineering",
    "Public disclosure without required approval",
  ],
  outOfScope: [
    "Source-manipulation-required issues",
    "Unit-test-only issues",
    "Low-impact clickjacking",
    "CSRF on unauthenticated/non-sensitive forms",
    "MITM or physical-access attacks",
    "Known vulnerable libraries without working PoC",
    "CSV injection without demonstrated security impact",
    "DoS/disruption",
    "Content spoofing/text injection without attack vector",
    "Rate limiting/bruteforce on non-authentication endpoints",
    "CSP-only issues",
    "Missing HttpOnly/Secure cookie flags",
    "Missing email security records",
    "Outdated browser/mobile-only issues",
    "Version/banner disclosure",
    "Tabnabbing",
    "Open redirect without additional security impact",
    "Issues requiring unlikely user interaction",
  ],
  tierA: {
    name: "Arc Mainnet Chain/Protocol",
    rewards: {
      extreme: "Up to $1,000,000",
      critical: "$20,000-$200,000",
      high: "$10,000-$20,000",
      medium: "$5,000-$10,000",
      low: "Up to $5,000",
    },
  },
  tierB: {
    name: "Arc Product/Web2",
    rewards: {
      critical: "$3,000-$10,000",
      high: "$800-$3,000",
      medium: "$400-$800",
      low: "Up to $400",
    },
  },
  confirmationRule:
    "Never promote a static signal, scenario match or successful call directly to confirmed vulnerability. Require evidence, safe reproduction, demonstrated impact, scope/duplicate checks and human validation.",
} as const;

export function arcActionAllowed(action: { environment: string; touchesOtherUsers: boolean; mayDisrupt: boolean; mayCauseUnauthorizedLoss: boolean; publicDisclosure: boolean; humanApproved: boolean }) {
  const reasons: string[] = [];
  const allowedEnvironments = new Set<string>(ARC_PROGRAM_PROFILE.researchEnvironments);
  if (!allowedEnvironments.has(action.environment)) reasons.push("The requested environment is not an allowed Arc research environment.");
  if (action.environment === "arc-mainnet") reasons.push("Arc mainnet is prohibited by the imported program policy.");
  if (action.touchesOtherUsers) reasons.push("Testing must be limited to accounts/wallets owned by the researcher or explicitly authorized holders.");
  if (action.mayDisrupt) reasons.push("Service disruption/degradation is prohibited.");
  if (action.mayCauseUnauthorizedLoss) reasons.push("Unauthorized fund loss is prohibited.");
  if (action.publicDisclosure) reasons.push("Disclosure requires the program's permitted disclosure process/approval.");
  if (action.environment === "arc-testnet" && !action.humanApproved) reasons.push("Testnet execution requires human approval in Shakuni.");
  return { allowed: reasons.length === 0, reasons };
}
