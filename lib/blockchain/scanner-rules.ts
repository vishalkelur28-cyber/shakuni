// Deterministic, offline vuln-pattern rules + per-asset methodology checklists.
// Patterns flag LEADS, never confirmed bugs, each carries how to confirm it and,
// where relevant, the false-positive that burns bug-bounty researchers (test keys,
// build hashes, dev-only tooling). The checklists encode the real invariants to verify.

export type Severity = "high" | "medium" | "low" | "info";
export type Lang = "solidity" | "rust" | "move" | "cairo" | "go" | "ts" | "any";

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  langs: Lang[];
  /** Applied per line; no global flag (kept stateless for .test()). */
  pattern: RegExp;
  means: string;
  confirm: string;
  /** Common false positive, the reason a naive report gets rejected. */
  fp?: string;
}

export const LANG_OPTIONS: { id: Lang | "auto"; label: string }[] = [
  { id: "auto", label: "Auto (all rules)" },
  { id: "solidity", label: "Solidity" },
  { id: "rust", label: "Rust / Anchor" },
  { id: "move", label: "Move" },
  { id: "cairo", label: "Cairo" },
  { id: "go", label: "Go" },
  { id: "ts", label: "TypeScript / JS" },
];

export const RULES: Rule[] = [
  // ---- Solidity ----
  { id: "sol-tx-origin", title: "Authorization via tx.origin", severity: "high", langs: ["solidity"], pattern: /\btx\.origin\b/, means: "tx.origin is the original EOA, so a malicious intermediary contract can act on a victim's behalf.", confirm: "If it gates access, it's a bug, authorization should use msg.sender." },
  { id: "sol-selfdestruct", title: "selfdestruct present", severity: "high", langs: ["solidity"], pattern: /\bselfdestruct\b|\bsuicide\b/, means: "Can delete the contract / forcibly send ETH.", confirm: "Verify who can trigger it and that it can't brick a live contract." },
  { id: "sol-initialize", title: "Initializer function", severity: "high", langs: ["solidity"], pattern: /function\s+initialize\w*\s*\(/, means: "Proxy initializers are a classic takeover point if unprotected or front-runnable.", confirm: "Confirm it uses initializer/reinitializer AND the deploy calls it atomically (upgradeToAndCall). An already-initialized live proxy is not exploitable." },
  { id: "sol-auth-upgrade", title: "UUPS upgrade hook", severity: "high", langs: ["solidity"], pattern: /_authorizeUpgrade\s*\(/, means: "If _authorizeUpgrade isn't access-controlled, anyone can upgrade the implementation.", confirm: "Verify the body or modifier enforces onlyOwner / a role; an empty body with no modifier is critical." },
  { id: "sol-mint", title: "Mint / withdraw function", severity: "high", langs: ["solidity"], pattern: /function\s+\w*(mint|withdraw|burn)\w*\s*\(/i, means: "Money-moving entrypoint, the highest-value target.", confirm: "Check access control, that the amount is bounded/authorized, and replay protection (used-hash/nonce)." },
  { id: "sol-ecrecover", title: "Raw ecrecover", severity: "medium", langs: ["solidity"], pattern: /\becrecover\s*\(/, means: "Low-level signature recovery is easy to get wrong.", confirm: "Verify malleability guard (s <= N/2, v in {27,28}), zero-address check, and that the signed digest binds a nonce + domain. Prefer OpenZeppelin ECDSA.", fp: "OZ ECDSA.recover already handles malleability, not a bug on its own." },
  { id: "sol-delegatecall", title: "delegatecall", severity: "medium", langs: ["solidity"], pattern: /\bdelegatecall\b/, means: "Runs external code in this contract's storage context.", confirm: "Verify the target is trusted/immutable and the storage layout is compatible." },
  { id: "sol-lowlevel-call", title: "Low-level call", severity: "medium", langs: ["solidity"], pattern: /\.call\s*\{|\.call\s*\(/, means: "Raw call: return value must be checked and reentrancy considered.", confirm: "Check the return is handled and state changes happen before the call (CEI) or nonReentrant is present.", fp: "Extremely common and usually fine." },
  { id: "sol-unchecked", title: "unchecked block", severity: "medium", langs: ["solidity"], pattern: /\bunchecked\s*\{/, means: "Disables Solidity 0.8 overflow/underflow checks.", confirm: "Verify the arithmetic inside genuinely cannot over/underflow for attacker-chosen inputs." },
  { id: "sol-blockvals", title: "Block value used", severity: "low", langs: ["solidity"], pattern: /block\.(timestamp|number|prevrandao|difficulty|coinbase)/, means: "Validator-influenceable values.", confirm: "Fine for coarse timing; a bug only if used for randomness or tight authorization.", fp: "Usually benign." },
  { id: "sol-pragma", title: "Floating pragma", severity: "low", langs: ["solidity"], pattern: /pragma\s+solidity\s+\^/, means: "Allows compiling with a range of compiler versions.", confirm: "Informational; rarely bounty-worthy on its own." },

  // ---- Rust / Anchor (Solana) ----
  { id: "rust-init-if-needed", title: "init_if_needed", severity: "high", langs: ["rust"], pattern: /init_if_needed/, means: "Account can be (re)initialized, a re-init can reset state such as a used-nonce flag.", confirm: "Verify re-initialization can't reset security-critical state." },
  { id: "rust-accountinfo", title: "Raw AccountInfo", severity: "medium", langs: ["rust"], pattern: /AccountInfo\s*</, means: "Bypasses Anchor's owner/type checks, account-substitution risk.", confirm: "Verify the program checks owner, is_signer, and PDA seeds/bump manually." },
  { id: "rust-unwrap", title: "unwrap / expect in logic", severity: "low", langs: ["rust"], pattern: /\.unwrap\s*\(\s*\)|\.expect\s*\(/, means: "Panics on error, a handler panic can be a DoS.", confirm: "Check it's not reachable with attacker input in an on-chain handler.", fp: "Fine in tests and build scripts." },
  { id: "rust-as-cast", title: "Numeric as-cast", severity: "low", langs: ["rust"], pattern: /\bas\s+(u8|u16|u32|u64|u128|i64)\b/, means: "A cast can truncate silently.", confirm: "Verify the value is bounded (e.g. amount <= MAX_U64) before the cast." },

  // ---- Move ----
  { id: "move-public-fun", title: "Public entry function", severity: "info", langs: ["move"], pattern: /public(\s*\(\s*friend\s*\)|\s+entry)?\s+fun\s+\w+/, means: "Externally callable function.", confirm: "For a privileged action, verify it requires the right capability or signer; minting should need a hot-potato/capability only an attested path can produce." },

  // ---- Cairo ----
  { id: "cairo-caller", title: "get_caller_address", severity: "info", langs: ["cairo"], pattern: /get_caller_address\s*\(\s*\)/, means: "Caller identity read.", confirm: "Verify every privileged entrypoint asserts the caller's role/ownership against this." },
  { id: "cairo-felt", title: "felt252 arithmetic", severity: "info", langs: ["cairo"], pattern: /\bfelt252\b/, means: "felt arithmetic wraps (no overflow panic).", confirm: "For amounts/allowances prefer checked u256; felt math can wrap silently." },

  // ---- Go (Cosmos) ----
  { id: "go-nonce", title: "Nonce / used-marker", severity: "info", langs: ["go"], pattern: /used[_]?[Nn]once|SetNonceUsed|IsNonceUsed/, means: "Replay-protection bookkeeping.", confirm: "Verify the nonce is both checked and persisted, with no path that un-marks it." },

  // ---- Cross-cutting (the false-positive teachers) ----
  { id: "any-privkey", title: "Possible hardcoded key (64-hex)", severity: "high", langs: ["any"], pattern: /0x[0-9a-fA-F]{64}\b/, means: "A 64-hex value can be a private key.", confirm: "Read the surrounding comment/context before you even think about reporting.", fp: "Usually a KNOWN TEST KEY (Anvil 0xac0974…, 0xdbda1821…) or a build hash, those are public by design and are NOT secrets. Only a real, in-use production key matters." },
  { id: "ts-exec-interp", title: "Interpolated shell command", severity: "medium", langs: ["ts"], pattern: /(execSync|exec|spawnSync|spawn)\s*\(\s*`[^`]*\$\{/, means: "A command built by string interpolation, the command-injection pattern.", confirm: "Only a bug if an ATTACKER controls the interpolated value AND it runs in an in-scope component.", fp: "In a deploy/CI script the operator controls the input and already has a shell, out of scope, not a bounty." },
  { id: "any-tls-off", title: "TLS verification disabled", severity: "low", langs: ["any"], pattern: /curl\s+[^\n]*\s-k\b|rejectUnauthorized\s*:\s*false|InsecureSkipVerify\s*:\s*true/, means: "Disables certificate verification (MITM exposure).", confirm: "Check where it runs.", fp: "Usually a localnet/dev health-check or test setup, rarely in-scope." },
  { id: "any-http", title: "Plaintext HTTP URL", severity: "low", langs: ["any"], pattern: /http:\/\/(?!localhost|127\.0\.0\.1)[\w.-]+/, means: "Non-TLS endpoint.", confirm: "Check whether it carries anything sensitive and is in the production path." },
  { id: "any-build-digest", title: "Build digest (not a secret)", severity: "info", langs: ["any"], pattern: /manifest_digest\s*=|sha256\s*=\s*"|integrity\s*:\s*"sha/, means: "A build-artifact / lockfile hash.", confirm: "Ignore, this is NOT a credential, even when a secret scanner labels it one (e.g. 'Twilio SID')." },
];

export interface ChecklistItem { q: string; note?: string }
export interface Checklist { assetType: string; blurb: string; items: ChecklistItem[] }

export const CHECKLISTS: Checklist[] = [
  {
    assetType: "Smart contract (general)",
    blurb: "The baseline every on-chain contract must hold.",
    items: [
      { q: "Access control on every state-mutating and admin function (onlyOwner / role / signer)." },
      { q: "Initializer protected (initializer/reinitializer) and called atomically on deploy, no front-run window." },
      { q: "UUPS _authorizeUpgrade is onlyOwner; storage is namespaced (EIP-7201) so modules can't collide." },
      { q: "Reentrancy: effects written before external interactions (CEI), or nonReentrant guards the entry.", note: "Operator/attested calls still need this when the token can hook transfers." },
      { q: "Arithmetic: Solidity 0.8 checked (or SafeMath); every unchecked block can't over/underflow." },
      { q: "External calls: return values checked; the callee is trusted or the flow tolerates failure." },
    ],
  },
  {
    assetType: "CCTP bridge (cross-chain transfer)",
    blurb: "Burn on source, attested mint on destination. The whole protocol rests on these four.",
    items: [
      { q: "Attestation threshold enforced EXACTLY (len == 65 × threshold), threshold ≥ 2 where required." },
      { q: "Signers strictly increasing (rejects duplicates and wrong order) and all must be enabled attesters." },
      { q: "Low-s malleability guard (s ≤ N/2) and v normalized to {27,28}." },
      { q: "Replay: nonce marked used AND persisted, checked before mint, with no un-use path.", note: "On Soroban, confirm the used-nonce store is PERSISTENT, not temporary." },
      { q: "Domain binding: destinationDomain == local domain; destinationCaller enforced; recipient bound in the signed message." },
      { q: "Mint: only an attested message can mint; amount ≤ MAX before the u64 cast; fee < amount ≤ maxFee." },
    ],
  },
  {
    assetType: "Gateway / unified balance",
    blurb: "Deposit once, attested mint anywhere. Watch the double-spend seam.",
    items: [
      { q: "Mint: single trusted attester; payload binds destDomain/destContract/token/recipient/value and all are re-validated; expiry checked." },
      { q: "Replay by transfer-spec hash (includes a unique salt)." },
      { q: "Double-spend: the operator burn can drain the 'withdrawing' balance; withdrawal delay > settlement time." },
      { q: "Refund/settle uses CEI (state written before external transfers) and is operator-gated + nonReentrant." },
      { q: "Burn intents: signer validated (EOA / EIP-1271 / TEE) AND the signer was authorized for that depositor; fee ≤ maxFee." },
    ],
  },
  {
    assetType: "USDC token (FiatToken)",
    blurb: "The mint boundary every bridge/gateway flows through.",
    items: [
      { q: "mint() gated by minter allowance; allowance decremented on mint; can't exceed or underflow." },
      { q: "Roles, masterMinter, minter, pauser, blocklister, owner, each setter is correctly gated." },
      { q: "Blocklist and pause enforced on mint and transfer (recipient and caller)." },
      { q: "Upgrade / ownership transfer is two-step and owner-gated." },
    ],
  },
  {
    assetType: "Web2 API / app",
    blurb: "Where a solo+AI combo has the best odds. Own accounts, sandbox/testnet only.",
    items: [
      { q: "Cross-tenant authorization (IDOR/BOLA): app A's credentials cannot reach app B's objects, test with two accounts you own." },
      { q: "Every endpoint authenticates; object ownership is bound to the token, not just the path id." },
      { q: "Allowed-domains / OAuth redirect allowlist can't be bypassed; account-linking can't merge into a victim; recovery flow can't take over." },
      { q: "No DoS / volumetric testing; only your own accounts; follow the program's sandbox + naming rules." },
    ],
  },
  {
    assetType: "Smart-contract wallet (ERC-4337)",
    blurb: "Account abstraction, the signature path is everything.",
    items: [
      { q: "validateUserOp: no path returns success without a valid, threshold-weighted, registered signer." },
      { q: "Signed hash binds chainId + entryPoint + nonce (no cross-chain / cross-op replay)." },
      { q: "Module/plugin install and permissions are authorized; any skipRuntimeValidation function self-authorizes." },
      { q: "Owner / guardian / social-recovery can't be hijacked; execute/delegatecall can't reach protected admin functions." },
    ],
  },
];

export interface TriageStep { q: string; detail: string }
export const TRIAGE: TriageStep[] = [
  { q: "In-scope asset?", detail: "The actual on-chain contract or in-scope URL, not tests, examples, deploy scripts, or dev tooling." },
  { q: "Attacker-controlled input?", detail: "Can an external attacker influence the value, or only the operator/developer (who already has that power)?" },
  { q: "Crosses a security boundary?", detail: "Does a lower-privileged party gain access, funds, or control they didn't already have?" },
  { q: "Real secret vs artifact?", detail: "A live production credential, not a known test key (Anvil) or a build/lockfile hash." },
  { q: "Already public?", detail: "Checked the repo's issues/PRs/commits, published audits, and CVEs, it isn't a duplicate." },
  { q: "Reproducible PoC?", detail: "You can demonstrate it (ideally a Foundry test) without exploiting real funds." },
];
