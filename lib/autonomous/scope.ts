/**
 * Arc bug-bounty scope for the three source-code targets the user narrowed to,
 * transcribed from the program's scope CSV. Used to stamp every report with the
 * program's own severity ceiling and eligibility, and to refuse out-of-scope repos.
 */
export interface ScopeEntry {
  repository: string;
  inScope: boolean;
  bountyEligible: boolean | null;
  maxSeverity: string | null;
  scopeNote: string | null;
}

export const SCOPE: Record<string, ScopeEntry> = {
  "circlefin/malachite": {
    repository: "circlefin/malachite",
    inScope: true,
    bountyEligible: true,
    maxSeverity: "critical",
    scopeNote: "Partial scope: code/crates minus the starknet and test folders; everything outside code/crates is out of scope.",
  },
  "circlefin/arc-node": {
    repository: "circlefin/arc-node", inScope: true, bountyEligible: true, maxSeverity: "critical", scopeNote: null,
  },
  "circlefin/arc-remote-signer": {
    repository: "circlefin/arc-remote-signer", inScope: true, bountyEligible: true, maxSeverity: "critical", scopeNote: null,
  },
};

export function scopeFor(repo: string): ScopeEntry | null {
  return SCOPE[repo.toLowerCase()] ?? null;
}

export const SCOPE_TARGETS = Object.values(SCOPE);

// SHAKUNI ADDITION, live (non-source) in-scope assets from the program CSV.
// Kept separate from SCOPE because these are URLs/wildcards, not git repos: the
// autonomous selector/ingestion clones SCOPE_TARGETS, while these are driven by
// the live-asset hypothesis catalogs and the testnet runtime tools. Tier/severity
// transcribed from the program. Testing is testnet-only, own-account-only.
export interface LiveAssetEntry {
  identifier: string;
  assetType: "URL" | "WILDCARD";
  inScope: boolean;
  bountyEligible: boolean;
  maxSeverity: string | null;
  tier: "A" | "B";
  note: string | null;
}

export const LIVE_SCOPE: Record<string, LiveAssetEntry> = {
  "rpc.testnet.arc.network": {
    identifier: "rpc.testnet.arc.network", assetType: "URL", inScope: true, bountyEligible: true,
    maxSeverity: "critical", tier: "A", note: "Arc testnet JSON-RPC endpoint. Testnet only; no DoS; own accounts only.",
  },
  "rpc.drpc.testnet.arc.network": {
    identifier: "rpc.drpc.testnet.arc.network", assetType: "URL", inScope: true, bountyEligible: true,
    maxSeverity: "critical", tier: "A", note: "Alternate Arc testnet RPC provider. Compare against rpc.testnet for divergence. Testnet only; no DoS.",
  },
  "*.arc.io": {
    identifier: "*.arc.io", assetType: "WILDCARD", inScope: true, bountyEligible: true,
    maxSeverity: "critical", tier: "B", note: "Circle-owned Arc web products (Tier B payouts). Only Circle-owned hosts; own accounts only. Note explorer/community/help.arc.io are explicitly out of scope.",
  },
};

export const LIVE_SCOPE_TARGETS = Object.values(LIVE_SCOPE);

/** Hosts explicitly marked out of scope in the program CSV (eligible_for_submission=false). */
export const OUT_OF_SCOPE_HOSTS = ["community.arc.io", "explorer.arc.io", "help.arc.io"] as const;

export function liveScopeFor(identifier: string): LiveAssetEntry | null {
  return LIVE_SCOPE[identifier.trim().toLowerCase()] ?? null;
}
