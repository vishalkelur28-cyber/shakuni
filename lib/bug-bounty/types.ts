export type BountyAsset = {
  identifier: string;
  assetType: string;
  eligibleForBounty: boolean | null;
  eligibleForSubmission: boolean | null;
  instruction: string;
  labels: string[];
  raw: Record<string, string>;
};

export type BountyProgramProfile = {
  name: string;
  source: string;
  scopeMode: "defined" | "open" | "unknown";
  policyText: string;
  assets: BountyAsset[];
  exclusions: string[];
  technologies: string[];
  repositories: string[];
  requirements: string[];
  warnings: string[];
};
