import type { RepoHypothesis } from "./report.ts";

/**
 * Candidate hypothesis catalogs per in-scope repository.
 *
 * These are security-relevant invariant classes a reviewer SHOULD examine for
 * each target, drawn from each system's documented purpose. They are leads to
 * guide manual review and (later) model-based execution, never claims.
 * confidence is "low": nothing here has been tested against the real code.
 */

type Seed = Omit<RepoHypothesis, "crossRefs" | "priority" | "status" | "confidence"> & { confidence?: "low" | "medium" };

// Malachite: Byzantine-fault-tolerant Tendermint-style consensus in Rust.
// Scope note: code/crates minus starknet and test folders.
const MALACHITE: Seed[] = [
  { id: "mal-agreement", title: "Two distinct values decided at the same height (agreement break)", vulnClass: "consensus safety, agreement", area: ["decide", "commit", "height", "finaliz", "value", "certificate", "consensus", "state-machine"], rationale: "The core BFT safety property: no honest node commits two different values at one height. Any path that lets a second decision through under <1/3 Byzantine power is critical.", toConfirm: ["model Tendermint height/round/step in a Target", "search for a double-decide path under the 2/3 quorum rule", "reproduce 5× from fresh state", "port the sequence to a Rust property test against the real crate"] },
  { id: "mal-lock", title: "Locked-value / valid-value inconsistency across rounds", vulnClass: "consensus safety, locking rule", area: ["lock", "polka", "prevote", "precommit", "round", "valid", "consensus", "state-machine"], rationale: "Tendermint's locking rule prevents conflicting commits across rounds. A missing or mis-ordered lock update can enable equivocation to be laundered into a commit.", toConfirm: ["model lock/valid transitions", "search for a lock-bypass path", "replay", "confirm against real round-change code"] },
  { id: "mal-quorum", title: "Commit accepted without a genuine +2/3 precommit set", vulnClass: "quorum integrity", area: ["quorum", "precommit", "vote", "threshold", "2/3", "power", "signature", "consensus"], rationale: "If vote aggregation miscounts voting power or accepts duplicate/equivocating votes toward quorum, a minority could force a commit.", toConfirm: ["model weighted vote aggregation", "search for quorum-miscount path", "replay", "confirm against the real vote-counting code"] },
  { id: "mal-equiv", title: "Equivocation (double-sign) not rejected / double-counted", vulnClass: "Byzantine behavior handling", area: ["equivocat", "double", "evidence", "byzantine", "duplicate", "slashing", "consensus", "vote"], rationale: "A node that signs two different messages for the same height/round/step must not have both counted. Double-counting toward quorum breaks safety.", toConfirm: ["model an equivocating validator", "search for a double-count path", "replay", "confirm against evidence/vote handling"] },
  { id: "mal-wal", title: "Crash-recovery (WAL) replays into an inconsistent step", vulnClass: "state-recovery consistency", area: ["wal", "recover", "restart", "persist", "replay", "crash", "engine", "sync"], rationale: "On restart, replaying the write-ahead log must restore exactly the prior consensus step; a divergence can cause a node to re-vote or skip a lock.", toConfirm: ["model WAL persist/replay", "search for a replay-divergence path", "replay", "confirm against the real WAL code"] },
  // SHAKUNI ADDITION, deeper Malachite consensus-safety / liveness leads (Extreme/Critical tier).
  { id: "mal-prevote-polka", title: "Polka declared without a genuine +2/3 prevote set", vulnClass: "quorum integrity, prevote/polka", area: ["prevote", "polka", "quorum", "threshold", "2/3", "power", "vote", "round", "consensus"], rationale: "The precommit/lock rule rests on a real polka. If prevote aggregation declares a polka the weighted prevote set does not actually support, locking and commit decisions downstream are built on a forged quorum.", toConfirm: ["drive the real VoteKeeper with randomized prevotes + equivocation", "independently recount first-prevote-per-validator power", "assert every announced Polka meets 2/3", "reproduce any gap from a seed", "confirm against the pinned commit"] },
  { id: "mal-round-skip", title: "Round-skip / round-change accepted without a valid +2/3 certificate", vulnClass: "consensus safety, round change", area: ["round", "skip", "certificate", "round-change", "f+1", "2/3", "advance", "consensus", "state-machine"], rationale: "Advancing rounds on an unjustified or forged skip/round-change certificate lets a minority drive the state machine, enabling conflicting proposals to be laundered across rounds.", toConfirm: ["model round-change certificate verification", "search for an advance path on an insufficient certificate", "replay", "confirm against the real round-change code"] },
  { id: "mal-value-valid", title: "valid_round / valid_value not reset correctly across rounds", vulnClass: "consensus safety, valid value tracking", area: ["valid", "valid_round", "valid_value", "lock", "round", "proposal", "reset", "consensus"], rationale: "Tendermint tracks validValue/validRound to justify re-proposal. A stale or mis-updated valid value lets a proposer re-propose a value that lost its justification, feeding equivocation into a commit.", toConfirm: ["model valid/locked transitions across >=3 rounds", "search for a stale-valid-value re-proposal path", "replay", "confirm against the real driver"] },
  { id: "mal-sig-domain", title: "Vote/proposal signature verified without full domain/address binding", vulnClass: "signature verification, domain separation", area: ["signature", "verify", "sign_bytes", "domain", "address", "vote", "proposal", "to_sign_bytes"], rationale: "If the signed bytes don't bind every consensus-relevant field (height, round, step, value, validator address, chain/domain), a signature valid for one context can be replayed into another, breaking attribution and quorum counting.", toConfirm: ["enumerate every signed message's to_sign_bytes", "check each binds all consensus fields + domain", "attempt a cross-context replay in a model", "confirm against the real signing/verification code"] },
  { id: "mal-cert-agg", title: "Commit/skip certificate aggregation double-counts or mismatches validator set", vulnClass: "certificate integrity", area: ["certificate", "aggregate", "commit", "signature", "validator", "set", "verify", "sync"], rationale: "A certificate carries a signature set that must map one-to-one onto the active validator set with no duplicates and correct power. Double-counting, wrong-set binding, or duplicate inclusion forges finality.", toConfirm: ["model certificate verification over a known validator set", "inject duplicate/foreign signatures", "assert accepted power == genuine distinct power", "confirm against the real certificate verifier"] },
  { id: "mal-sync-forge", title: "Block/vote sync accepts a commit certificate it should reject", vulnClass: "consensus safety, sync", area: ["sync", "certificate", "commit", "decided", "value", "verify", "catchup", "consensus"], rationale: "A syncing node trusts certificates to adopt decided values without re-running consensus. A verification gap here lets a peer feed a forged decided value, splitting state from the rest of the network.", toConfirm: ["model the sync certificate path", "feed a certificate with insufficient/forged power", "assert it is rejected", "confirm against the real sync crate"] },
  { id: "mal-wal-torn", title: "WAL torn/partial-write record accepted as a complete entry", vulnClass: "state-recovery integrity", area: ["wal", "torn", "partial", "truncat", "crc", "checksum", "recover", "replay"], rationale: "A crash mid-write can leave a truncated final record. If recovery accepts a partial entry as complete (missing length/CRC check), the node replays into a state that never legitimately existed.", toConfirm: ["model persist interrupted at byte boundaries", "attempt recovery from truncated tails", "assert truncated records are rejected, not partially applied", "confirm against the real WAL decode"] },
  { id: "mal-proposer", title: "Proposer selection diverges from the deterministic weighted schedule", vulnClass: "consensus determinism, proposer election", area: ["proposer", "select", "round-robin", "weight", "power", "schedule", "determin", "rotation"], rationale: "All honest nodes must agree on who proposes for (height, round). A divergence in weighted proposer selection makes nodes accept different proposals as legitimate, a safety/liveness split.", toConfirm: ["recompute the proposer schedule independently", "compare against the real selector across many validator sets/rounds", "search for any disagreement", "confirm against the pinned code"] },
  { id: "mal-timeout", title: "Timeout handling allows step regression or lost lock on expiry", vulnClass: "consensus state-machine, timeouts", area: ["timeout", "step", "schedule", "propose", "prevote", "precommit", "regress", "consensus"], rationale: "Timeouts drive progress but must never move a node backward in step or drop a lock. A mishandled timeout (e.g. firing for a stale round) can reset state in a way that enables conflicting votes.", toConfirm: ["model timeout scheduling across rounds", "fire stale/duplicate timeouts", "assert no step regression and no lock loss", "confirm against the real driver timeout logic"] },
  { id: "mal-equiv-evidence", title: "Equivocation evidence is incomplete or non-attributable", vulnClass: "Byzantine accountability", area: ["equivocat", "evidence", "byzantine", "double", "attribut", "slashing", "proof"], rationale: "Detected double-signs must yield complete, independently verifiable evidence bound to the offending validator. Incomplete or forgeable evidence undermines accountability and can be weaponized to frame honest validators.", toConfirm: ["drive equivocation into the real keeper", "assert emitted evidence is complete and verifies against only the true signer", "attempt to forge evidence against an honest validator", "confirm against the real evidence code"] },
];

// arc-node: Arc L1 execution node (Rust). USDC is the gas asset (see Arc EVM differences).
const ARC_NODE: Seed[] = [
  { id: "node-stateroot", title: "Non-deterministic execution → diverging state roots", vulnClass: "execution determinism", area: ["state", "root", "execut", "determin", "block", "apply"], rationale: "If two honest nodes can derive different state roots from the same block, consensus over state breaks. Ordering, iteration or float-like nondeterminism are classic causes.", toConfirm: ["model block application", "search for an ordering-dependent root path", "replay", "confirm on a local devnet"] },
  { id: "node-gas-usdc", title: "USDC-as-gas accounting mismatch (6- vs 18-decimal, EIP-7708)", vulnClass: "fee/gas accounting", area: ["gas", "usdc", "fee", "decimal", "balance", "7708", "value"], rationale: "Arc pays gas in native USDC with a dual-decimal view. Any path where gas debited ≠ balance change, or fee accounting drifts from supply, is a direct accounting bug.", toConfirm: ["model fee debit vs balance change", "search for a drift path", "replay", "confirm on a local fork with arc-forge"] },
  { id: "node-nonce", title: "Transaction nonce / replay handling across reorgs", vulnClass: "replay protection", area: ["nonce", "replay", "reorg", "mempool", "tx", "duplicate"], rationale: "A transaction accepted twice (across a reorg or mempool edge) can double-apply effects. Nonce tracking through reorgs is a common weak point.", toConfirm: ["model mempool + reorg", "search for a double-apply path", "replay", "confirm on devnet"] },
  { id: "node-rpc-auth", title: "RPC method reachable without the intended authorization", vulnClass: "authorization boundary", area: ["rpc", "auth", "admin", "method", "endpoint", "permission"], rationale: "Privileged RPC (debug/admin/txpool controls) exposed on a public endpoint is a direct impact; rpc.testnet.arc.network is itself in scope.", toConfirm: ["enumerate RPC methods", "test authorization on each against a local node", "confirm reachability", "document impact"] },
  { id: "node-codec", title: "Consensus message codec is not a faithful round-trip", vulnClass: "wire-format integrity", area: ["codec", "encode", "decode", "proto", "wire", "serialization", "types", "consensus"], rationale: "If encode/decode of a consensus message is asymmetric (a field is dropped, truncated, or altered), honest nodes can disagree on what was sent, a consensus safety/liveness break. This is the kind of bug that is cheap to search and expensive to miss.", toConfirm: ["drive the real NetCodec with randomized messages", "assert decode(encode(m)) == m for every field", "reproduce any asymmetry from a seed", "confirm against the pinned commit"] },
  // SHAKUNI ADDITION, Arc L1 execution, fee/USDC accounting, mempool, reorg and RPC leads.
  { id: "node-eip7708-mint", title: "EIP-7708 native USDC mint/burn log diverges from the balance change", vulnClass: "supply/accounting integrity", area: ["7708", "mint", "burn", "usdc", "native", "log", "transfer", "balance", "supply"], rationale: "Arc surfaces native-value moves as log events (EIP-7708). If an emitted mint/burn/transfer log can disagree with the actual balance delta, indexers and supply accounting drift from truth, a direct value-integrity bug.", toConfirm: ["model native value moves that emit 7708 logs", "assert emitted log amounts == net balance deltas for every path (incl. fee, refund, self-transfer, failed tx)", "search for a divergence", "confirm on a local devnet against the pinned node"] },
  { id: "node-fee-refund", title: "Gas refund / priority-fee accounting drifts from debited balance", vulnClass: "fee/gas accounting", area: ["refund", "fee", "priority", "base", "gas", "burn", "debit", "usdc", "balance"], rationale: "With USDC as gas, fee debit, base-fee burn, priority-fee credit and refund must sum to exactly the payer's balance change. Any drift mints or destroys value and corrupts supply.", toConfirm: ["model a tx's full fee lifecycle", "assert payer_delta == -(gas_used*effective_price) + refund and burn+tip reconcile", "search for an imbalance", "confirm on a local fork"] },
  { id: "node-sig-replay-chainid", title: "Transaction signature / chainId binding allows cross-chain or cross-fork replay", vulnClass: "replay protection, EIP-155", area: ["chainid", "eip155", "signature", "ecrecover", "replay", "malleab", "tx", "sign"], rationale: "If chainId is not bound into every signed tx type (legacy/2930/1559/7702), a transaction signed for another chain or Arc fork could be replayed onto Arc, double-applying effects.", toConfirm: ["enumerate each tx type's signing payload", "assert chainId is bound and verified for all", "attempt a foreign-chain-signed tx against a local node", "confirm it is rejected"] },
  { id: "node-blockvalidation", title: "Block header / parent / timestamp validation gap enables an invalid block", vulnClass: "block validation", area: ["header", "parent", "timestamp", "gaslimit", "basefee", "validate", "block", "difficulty"], rationale: "A node must reject blocks with an inconsistent header (bad parent hash, non-monotonic timestamp, wrong base-fee formula, gas-limit jump). Accepting one splits honest nodes.", toConfirm: ["model header validation", "mutate each header field off the rules", "assert each invalid header is rejected", "confirm on a local devnet"] },
  { id: "node-mempool-replace", title: "Mempool tx-replacement rule allows underpriced / free replacement or eviction abuse", vulnClass: "mempool integrity", area: ["mempool", "replace", "nonce", "underpriced", "bump", "evict", "pool", "tx"], rationale: "Same-nonce replacement must require the configured fee bump; a bypass lets a sender churn the pool or displace committed-intent txs. (Correctness/authorization framing, not volumetric DoS.)", toConfirm: ["model replacement acceptance", "submit same-nonce txs below the bump threshold", "assert they are rejected", "confirm against the real mempool rules on a local node"] },
  { id: "node-reorg-state", title: "Reorg rollback leaves stale account/storage or nonce state", vulnClass: "state consistency, reorg", area: ["reorg", "rollback", "revert", "state", "nonce", "storage", "canonical", "reapply"], rationale: "On a reorg the node must roll back exactly the orphaned state and reapply the new canonical chain. A missed rollback leaves phantom balances/nonces, diverging the state root.", toConfirm: ["model a two-branch reorg on a local devnet", "compare post-reorg state root against a fresh sync of the canonical branch", "search for divergence", "confirm against pinned code"] },
  { id: "node-precompile-syscontract", title: "System-contract / precompile input decoding mismatch", vulnClass: "system-contract integrity", area: ["precompile", "system", "contract", "decode", "input", "abi", "selector", "gas"], rationale: "Arc ships system contracts/precompiles (fees, USDC, config). A decoding or bounds mismatch between the declared ABI and the handler can let crafted input trigger unintended privileged behavior or a gas/accounting fault.", toConfirm: ["enumerate system-contract/precompile entry points", "fuzz input encodings against the real handler", "assert declared vs actual decoding match and bounds hold", "confirm on a local devnet"] },
  { id: "node-rpc-method-authz", title: "Privileged RPC method reachable without the intended authorization", vulnClass: "authorization boundary, RPC", area: ["rpc", "admin", "debug", "txpool", "personal", "auth", "method", "endpoint", "namespace"], rationale: "Privileged namespaces (admin/debug/txpool/personal/miner) exposed on a public endpoint are direct impact. rpc.testnet.arc.network is itself in scope, so this maps a source-level gap to a live-asset test.", toConfirm: ["enumerate enabled RPC namespaces/methods from config and router", "test authorization on each against a local node", "confirm reachability of any privileged method", "document impact; verify on testnet with own account only"] },
  { id: "node-rpc-stateoverride", title: "eth_call / state-override / trace exposes or mutates unintended state", vulnClass: "RPC state integrity", area: ["eth_call", "state", "override", "trace", "debug", "simulate", "rpc", "read"], rationale: "Simulation/override RPCs must be read-only and sandboxed. A path where an override persists, or a trace reveals data outside the caller's intended view, is an integrity/disclosure bug.", toConfirm: ["drive eth_call with state overrides against a local node", "assert no persisted mutation and no cross-account disclosure", "search for leakage/persistence", "confirm on testnet with own account"] },
  { id: "node-genesis-hardfork", title: "Chain-config / hardfork activation mismatch splits consensus", vulnClass: "consensus determinism, config", area: ["genesis", "config", "hardfork", "activation", "chainspec", "fork", "block", "schedule"], rationale: "If two honest nodes disagree on hardfork activation (block/timestamp) or any consensus-critical chain-config value, they validate different rules and fork. Config edge cases are a classic chain-split source.", toConfirm: ["diff the effective chain config across versions/flags", "model a boundary-block activation", "assert identical rule selection", "confirm on a local devnet"] },
];

// arc-remote-signer: Go, AWS Nitro Enclaves. Secure remote signing for Arc.
const ARC_REMOTE_SIGNER: Seed[] = [
  { id: "signer-authz", title: "Signing request authorized without full policy check", vulnClass: "authorization bypass", area: ["sign", "authoriz", "policy", "approve", "request", "permission"], rationale: "The signer's whole value is that it signs only authorized payloads. Any path that gets a signature without the complete policy/authentication check is critical.", toConfirm: ["model request→policy→sign flow", "search for a check-bypass path", "replay", "confirm against the real handler"] },
  { id: "signer-replay", title: "Replay of a previously-authorized signing request", vulnClass: "replay protection", area: ["replay", "nonce", "idempoten", "request", "duplicate", "timestamp"], rationale: "If a captured, once-authorized request can be replayed to produce a second signature, an attacker gains an unintended signed message.", toConfirm: ["model request identifiers/nonces", "search for a replay path", "replay", "confirm against the real nonce store"] },
  { id: "signer-attest", title: "Enclave attestation accepted without full verification", vulnClass: "attestation verification", area: ["attest", "nitro", "enclave", "verify", "pcr", "quote"], rationale: "Nitro attestation binds the signer to a trusted enclave image. Weak or partial attestation verification lets a rogue enclave obtain keys or trust.", toConfirm: ["review attestation verification", "model a forged/partial attestation", "search for an acceptance path", "confirm against the real verifier"] },
  { id: "signer-keyiso", title: "Key material reachable outside the enclave boundary", vulnClass: "key isolation", area: ["key", "isolat", "enclave", "export", "memory", "secret"], rationale: "Private keys must never leave the enclave. Any logging, error path or debug surface that exposes key bytes is a direct compromise.", toConfirm: ["trace key lifetime", "search for an egress path (logs/errors/debug)", "confirm against the real code"] },
  // SHAKUNI ADDITION, deeper remote-signer / Nitro leads (private-key compromise is the Extreme tier).
  { id: "signer-domain", title: "Missing domain separation lets one request type be signed as another", vulnClass: "signing domain separation", area: ["domain", "separation", "sign", "payload", "prefix", "type", "vote", "tx", "attest"], rationale: "The signer may handle multiple payload kinds (consensus votes, blocks, txs). Without a bound domain tag per kind, a payload authorized as one type could yield a signature valid as another, a cross-use key-abuse bug.", toConfirm: ["enumerate every payload kind the signer signs", "check each prepends a distinct, verified domain", "attempt to get a vote-domain payload signed as a tx (in a model)", "confirm against the real signing handler"] },
  { id: "signer-policy-canon", title: "Policy / request canonicalization ambiguity authorizes the wrong payload", vulnClass: "authorization, parsing/canonicalization", area: ["policy", "canonical", "parse", "json", "duplicate", "unicode", "normaliz", "authoriz"], rationale: "If the bytes the policy check inspects differ from the bytes actually signed (duplicate keys, trailing data, unicode/number canonicalization), an attacker can get a signature over content the policy never approved.", toConfirm: ["diff policy-inspected bytes vs signed bytes", "craft inputs where they differ (dup keys, trailing bytes)", "assert signer refuses or they are identical", "confirm against the real policy/sign path"] },
  { id: "signer-pcr-pinning", title: "Attestation PCR / image measurement not pinned to the expected value", vulnClass: "attestation verification, measurement pinning", area: ["pcr", "measurement", "image", "attest", "nitro", "pin", "expected", "quote"], rationale: "Nitro attestation only protects you if the verifier pins the expected PCR/image measurements. Accepting any well-formed attestation, or not checking all required PCRs, lets a rogue enclave be trusted.", toConfirm: ["review which PCRs are checked and against what pinned values", "model an attestation with mismatched PCRs", "assert rejection", "confirm against the real verifier config"] },
  { id: "signer-nonce-rollover", title: "Request nonce/counter reset or rollover re-enables a used authorization", vulnClass: "replay protection, counter lifecycle", area: ["nonce", "counter", "rollover", "reset", "monoton", "replay", "persist", "restart"], rationale: "Anti-replay via a counter/nonce fails if the counter resets on restart, rolls over, or is not persisted atomically, a previously consumed authorization becomes replayable.", toConfirm: ["model the nonce store across restart/rollover", "replay a consumed request after reset", "assert it is refused", "confirm against the real nonce persistence"] },
  { id: "signer-channel-identity", title: "Client identity binding (mTLS / auth) gap on the signing channel", vulnClass: "authentication, channel binding", area: ["mtls", "tls", "client", "identity", "cert", "auth", "channel", "bind"], rationale: "The signer must only accept signing requests from an authenticated, authorized caller. A missing/weak client-identity check (or identity not bound to the request) opens the signer to unauthorized callers.", toConfirm: ["review caller authentication and its binding to the request", "model an unauthenticated/mis-identified caller", "assert refusal", "confirm against the real transport/auth code"] },
  { id: "signer-error-leak", title: "Error / log / debug path serializes partial secret or seed material", vulnClass: "key isolation, observability egress", area: ["log", "error", "debug", "serialize", "secret", "seed", "panic", "trace"], rationale: "Beyond keys at rest, a panic/error/log path that formats a struct containing seed or intermediate key material leaks secrets to logs that live outside the enclave trust boundary.", toConfirm: ["trace all error/log formatting of key-adjacent structs", "search for Debug/Display that includes secret fields", "assert redaction", "confirm against the real code"] },
  { id: "signer-expiry-window", title: "Request timestamp/expiry window too wide accepts stale authorizations", vulnClass: "replay protection, freshness", area: ["timestamp", "expiry", "window", "freshness", "skew", "ttl", "stale", "replay"], rationale: "A freshness window that is too wide (or clock-skew tolerant without bound) lets a captured, still-'valid' request be replayed long after it was authorized.", toConfirm: ["review the accepted time window and skew tolerance", "replay a request near/after the boundary", "assert the boundary is enforced", "confirm against the real freshness check"] },
];

// SHAKUNI ADDITION, live-asset catalogs. These assets are in scope per the program
// CSV but are URLs/wildcards, not git repos, so they are NOT in SCOPE_TARGETS (which
// drives git ingestion). They live here so the hypothesis lab and scenario generator
// cover the FULL program scope. All leads are testnet-only, own-account-only, and
// carry no volumetric/DoS step (DoS and non-auth rate-limiting are out of scope).
const RPC_TESTNET: Seed[] = [
  { id: "rpc-method-authz", title: "Privileged JSON-RPC namespace reachable unauthenticated on the public endpoint", vulnClass: "authorization boundary, RPC", area: ["rpc", "admin", "debug", "txpool", "personal", "miner", "namespace", "auth", "method"], rationale: "rpc.testnet.arc.network is directly in scope. If a privileged namespace (admin/debug/txpool/personal/miner) answers without authorization, that is direct impact, node control or sensitive internal state.", toConfirm: ["enumerate responding namespaces/methods via introspection on the public endpoint", "for each privileged method confirm whether it executes vs rejects", "demonstrate impact with own account only", "never run a disruptive or state-changing call against shared infra"] },
  { id: "rpc-stateoverride-leak", title: "Simulation/trace RPC (eth_call override, debug_trace*) leaks or persists unintended state", vulnClass: "RPC state integrity/disclosure", area: ["eth_call", "override", "debug", "trace", "simulate", "state", "rpc", "read"], rationale: "Override/trace RPCs must be read-only and scoped to the caller's view. Persistence of an override, or disclosure of data outside the intended view, is an integrity/disclosure finding.", toConfirm: ["issue eth_call with state overrides against testnet using own account", "verify no persisted mutation and no cross-account data return", "compare against a local node baseline", "document any leak/persistence"] },
  { id: "rpc-provider-divergence", title: "Divergent responses between rpc.testnet and rpc.drpc.testnet for the same query", vulnClass: "data-integrity, provider divergence", area: ["rpc", "drpc", "divergence", "consistency", "proxy", "cache", "response", "canonical"], rationale: "Both endpoints are in scope. If a consensus-relevant query (balance, nonce, receipt, block, proof) returns materially different answers between providers, one is serving incorrect chain data, a correctness bug that can mislead dependents.", toConfirm: ["send identical read queries to both endpoints", "diff responses for the same block height/tag", "isolate any non-caching, semantically meaningful divergence", "document with reproducible request/response pairs"] },
  { id: "rpc-proof-integrity", title: "eth_getProof / receipt / log responses are internally inconsistent with the state root", vulnClass: "data-integrity, proofs", area: ["getproof", "merkle", "receipt", "log", "stateroot", "verify", "rpc", "proof"], rationale: "Clients trust Merkle proofs and receipts. A proof that does not verify against the returned state/receipts root, or a receipt/log set inconsistent with the block, lets a client be fed false state.", toConfirm: ["fetch proofs/receipts for own-account state", "independently verify each proof against the block's root", "search for a non-verifying but accepted response", "document the inconsistency"] },
  { id: "rpc-subscription-authz", title: "WebSocket subscription exposes data beyond the caller's intended scope", vulnClass: "authorization boundary, pub/sub", area: ["websocket", "subscribe", "eth_subscribe", "pending", "txpool", "filter", "rpc"], rationale: "Subscription channels (newPendingTransactions, logs, txpool) must only surface data the caller is entitled to. Over-broad exposure of other parties' pending content is a disclosure finding.", toConfirm: ["open subscriptions on testnet with own account", "assess whether returned data exceeds intended scope", "demonstrate any over-exposure with own traffic only", "avoid any volumetric load"] },
];

const WEB_ARC_IO: Seed[] = [
  { id: "web-ato", title: "Unauthenticated or low-interaction account takeover on an *.arc.io product", vulnClass: "authentication, account takeover", area: ["login", "reset", "password", "token", "oauth", "session", "fixation", "takeover"], rationale: "Tier B Critical. ATO via a predictable/leaking reset token, OAuth state/redirect mishandling, session fixation, or a missing ownership check on an auth step is the highest-value web finding ($3k-$10k).", toConfirm: ["map the full auth + recovery flow on a testnet/own account", "test reset-token entropy/binding, OAuth state, session rotation", "demonstrate takeover of an account you own via a second account you own", "never touch a third party's account"] },
  { id: "web-authz-workflow", title: "Authorization bypass into a privileged Portal/Arc product workflow", vulnClass: "authorization bypass", area: ["authz", "role", "privilege", "workflow", "admin", "tenant", "rbac", "forced-browse"], rationale: "Tier B High/Critical. Reaching an admin/privileged workflow as a lower-privileged user (forced browsing, missing server-side role check, tenant boundary bypass) is direct impact.", toConfirm: ["enumerate privileged endpoints/actions from the client", "replay them as a low-privileged own account", "assert server-side authorization blocks them", "demonstrate any bypass between accounts you own"] },
  { id: "web-idor", title: "IDOR exposing or mutating another tenant's object", vulnClass: "authorization, object reference", area: ["idor", "object", "id", "uuid", "reference", "tenant", "ownership", "api"], rationale: "Tier B Medium-High. Direct/sequential/guessable object identifiers that return or modify records across an ownership boundary are classic high-signal web findings.", toConfirm: ["catalog object-id-bearing endpoints", "swap identifiers between two own accounts", "assert each access is ownership-checked server-side", "demonstrate scope of exposed/mutable data with own records only"] },
  { id: "web-stored-xss", title: "Stored XSS in a field rendered to other users", vulnClass: "injection, stored XSS", area: ["xss", "stored", "sanitiz", "render", "html", "script", "csp", "dom"], rationale: "Tier B Medium (and a pivot to ATO). A payload persisted in one account and executed in another user's authenticated context can escalate to session/credential theft.", toConfirm: ["inject benign marker payloads into persisted fields on own account", "observe execution context when rendered to a second own account", "prove script execution without harming others", "assess escalation (session/token reach)"] },
  { id: "web-ssrf", title: "Meaningful SSRF with constrained but real reach", vulnClass: "SSRF", area: ["ssrf", "fetch", "url", "webhook", "metadata", "internal", "proxy", "import"], rationale: "Tier B Medium. A server-side fetch (webhook, URL import, avatar/preview) that can be pointed at internal/metadata endpoints with observable response or side effect is in scope when impact is shown.", toConfirm: ["find server-side fetch features", "point them at a researcher-controlled collaborator and at benign internal targets", "demonstrate reach/response without exfiltrating real secrets", "document the constrained impact"] },
  { id: "web-token-validation", title: "Session/JWT validation flaw (alg confusion, missing/forged signature, weak claim check)", vulnClass: "authentication, token integrity", area: ["jwt", "token", "alg", "none", "signature", "claim", "audience", "session"], rationale: "Tier B High/Critical. If tokens accept alg=none, unverified signatures, or ignore audience/expiry/subject binding, an attacker forges authenticated identity.", toConfirm: ["capture a token on an own account", "test alg/none, signature stripping, claim tampering against the server", "assert each forged token is rejected", "demonstrate any accepted forgery on accounts you own"] },
  { id: "web-mass-assignment", title: "Mass assignment / parameter pollution grants unintended fields or privileges", vulnClass: "authorization, input binding", area: ["massassign", "parameter", "binding", "role", "field", "overpost", "json", "api"], rationale: "Tier B High. If an API binds client-supplied fields it should not (role, ownerId, isAdmin, balance), a normal user can escalate by overposting.", toConfirm: ["diff accepted vs intended request fields on own account", "attempt to set privilege/ownership fields", "assert server ignores/rejects them", "demonstrate any escalation between own accounts"] },
  { id: "web-cors", title: "Permissive CORS exposes an authenticated API to an attacker origin", vulnClass: "authorization, cross-origin", area: ["cors", "origin", "credentials", "acao", "wildcard", "reflect", "api"], rationale: "Tier B. Reflecting arbitrary Origin with Access-Control-Allow-Credentials true lets a malicious page read authenticated responses, demonstrable impact beyond a mere misconfiguration.", toConfirm: ["probe CORS response headers for credentialed endpoints", "build a PoC page on a researcher origin reading own-account data", "prove credentialed cross-origin read", "document the exposed data class"] },
];

const CATALOG: Record<string, Seed[]> = {
  "circlefin/malachite": MALACHITE,
  "circlefin/arc-node": ARC_NODE,
  "circlefin/arc-remote-signer": ARC_REMOTE_SIGNER,
  // Live in-scope assets (URL / wildcard), covered for hypotheses + scenarios, not git ingestion.
  "rpc.testnet.arc.network": RPC_TESTNET,
  "*.arc.io": WEB_ARC_IO,
};

export function hypothesesFor(repo: string): RepoHypothesis[] {
  const seeds = CATALOG[repo.toLowerCase()] ?? [];
  return seeds.map((s) => ({ ...s, status: "UNTESTED" as const, confidence: s.confidence ?? "low", crossRefs: [], priority: 0 }));
}

export function isKnownTarget(repo: string): boolean {
  return repo.toLowerCase() in CATALOG;
}

export const KNOWN_TARGETS = Object.keys(CATALOG);

// ============================================================================
// ADDITION: SHAKUNI LARGE-SCALE SCENARIO INTELLIGENCE
// ============================================================================
//
// IMPORTANT:
// - Everything above this section is ORIGINAL and UNCHANGED.
// - This section only ADDS scenario-generation capability.
// - The existing hypothesis catalog remains the source of security properties.
// - These scenarios are TEST CASES / RESEARCH INPUTS, NOT VULNERABILITY CLAIMS.
// - Scenario generation cannot mark anything as vulnerable.
// - Final truth remains with the existing deterministic gate.ts.
// //
// Design goal:
// Expand the small human-authored hypothesis catalog into thousands of
// deterministic, reproducible situations instead of manually writing thousands
// of repetitive objects.
//
// Default campaign size: 5,000 scenarios.
// ============================================================================

export type ScenarioCategory =
  | "BASELINE"
  | "BOUNDARY"
  | "MIN_VALUE"
  | "MAX_VALUE"
  | "ZERO"
  | "DUPLICATE"
  | "CONFLICT"
  | "REORDERING"
  | "INTERLEAVING"
  | "REPLAY"
  | "REORG"
  | "CRASH_RECOVERY"
  | "PARTIAL_FAILURE"
  | "MALFORMED_INPUT"
  | "ENCODING"
  | "DECODING"
  | "AUTHORIZATION"
  | "AUTHENTICATION"
  | "QUORUM"
  | "VOTING_POWER"
  | "SIGNATURE"
  | "NONCE"
  | "STATE_TRANSITION"
  | "ACCOUNTING"
  | "DECIMAL"
  | "FEE"
  | "ATTESTATION"
  | "KEY_ISOLATION"
  | "RPC"
  | "CONSENSUS"
  | "COMBINED";

export type ScenarioSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface ShakuniScenario {
  id: string;

  hypothesisId: string;

  repository: string;

  title: string;

  category: ScenarioCategory;

  severityFocus: ScenarioSeverity;

  description: string;

  objective: string;

  preconditions: string[];

  actions: string[];

  mutations: string[];

  invariants: string[];

  expectedSafeBehavior: string[];

  failureSignals: string[];

  edgeCases: string[];

  combinations: string[];

  replayRequired: boolean;

  independentReplayRequired: number;

  freshStateRequired: boolean;

  crashRecoveryRelevant: boolean;

  reorgRelevant: boolean;

  adversarial: boolean;

  malformedInput: boolean;

  deterministic: boolean;

  generatedFrom: string;

  generationIndex: number;

  parentScenarioId?: string;

  tags: string[];

  createdAt: string;
}

/**
 * Scenario dimensions.
 *
 * Each dimension gives the generator another axis of exploration.
 */
const SCENARIO_DIMENSIONS = {
  numeric: [
    "zero",
    "one",
    "two",
    "threshold_minus_one",
    "threshold",
    "threshold_plus_one",
    "minimum_valid",
    "maximum_valid",
    "maximum_minus_one",
    "overflow_boundary",
    "underflow_boundary",
  ],

  ordering: [
    "normal_order",
    "reverse_order",
    "rotated_order",
    "random_order",
    "duplicate_adjacent",
    "duplicate_separated",
    "stable_then_reordered",
  ],

  timing: [
    "single_step",
    "rapid_repeat",
    "delayed_repeat",
    "interleaved",
    "restart_between_steps",
    "failure_between_steps",
  ],

  state: [
    "fresh_state",
    "partially_initialized",
    "already_committed",
    "already_locked",
    "pending",
    "recovered",
    "reorged",
    "conflicting_state",
  ],

  attacker: [
    "honest",
    "single_malicious_actor",
    "multiple_malicious_actors",
    "equivocating_actor",
    "replaying_actor",
    "malformed_input_actor",
    "unauthorized_actor",
  ],

  encoding: [
    "canonical",
    "empty",
    "minimal",
    "maximum_length",
    "truncated",
    "duplicated_field",
    "unknown_field",
    "reordered_field",
    "boundary_integer",
  ],

  network: [
    "no_delay",
    "message_delay",
    "message_reordering",
    "message_duplication",
    "message_loss",
    "partial_delivery",
    "restart_during_delivery",
  ],

  authorization: [
    "fully_authorized",
    "unauthorized",
    "expired_authorization",
    "wrong_identity",
    "wrong_role",
    "partial_policy",
    "missing_policy",
    "replayed_authorization",
  ],
} as const;

/**
 * Deterministic pseudo-random number generator.
 *
 * No Math.random().
 *
 * This means:
 *
 * seed X + scenario index X
 *        =
 * same scenario every time
 *
 * That is extremely important for reproducible bug-bounty research.
 */
function shakuniSeed(
  value: string,
): number {
  let hash = 2166136261;

  for (
    let i = 0;
    i < value.length;
    i += 1
  ) {
    hash ^= value.charCodeAt(i);
    hash =
      Math.imul(
        hash,
        16777619,
      );
  }

  return hash >>> 0;
}

function seededIndex(
  seed: string,
  length: number,
): number {
  if (length <= 0) {
    return 0;
  }

  return shakuniSeed(seed) % length;
}

function pickSeeded<T>(
  values: readonly T[],
  seed: string,
): T {
  return values[
    seededIndex(
      seed,
      values.length,
    )
  ];
}

/**
 * Return several deterministic values without duplicates.
 */
function pickManySeeded<T>(
  values: readonly T[],
  seed: string,
  count: number,
): T[] {
  const output: T[] = [];

  if (!values.length) {
    return output;
  }

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const value =
      values[
        seededIndex(
          `${seed}:${i}`,
          values.length,
        )
      ];

    if (
      !output.includes(value)
    ) {
      output.push(value);
    }
  }

  return output;
}

/**
 * Build scenario categories from the hypothesis itself.
 */
function categoriesForHypothesis(
  hypothesis: RepoHypothesis,
): ScenarioCategory[] {
  const text =
    `${hypothesis.id} ${hypothesis.title} ${hypothesis.vulnClass} ${hypothesis.area.join(" ")}`
      .toLowerCase();

  const categories =
    new Set<ScenarioCategory>();

  categories.add("BASELINE");
  categories.add("BOUNDARY");
  categories.add("STATE_TRANSITION");
  categories.add("COMBINED");

  if (
    text.includes("consensus") ||
    text.includes("quorum") ||
    text.includes("vote") ||
    text.includes("commit") ||
    text.includes("lock")
  ) {
    categories.add("CONSENSUS");
    categories.add("QUORUM");
    categories.add("VOTING_POWER");
    categories.add("CONFLICT");
    categories.add("REORDERING");
    categories.add("INTERLEAVING");
  }

  if (
    text.includes("nonce") ||
    text.includes("replay")
  ) {
    categories.add("NONCE");
    categories.add("REPLAY");
    categories.add("DUPLICATE");
  }

  if (
    text.includes("rpc") ||
    text.includes("auth")
  ) {
    categories.add("RPC");
    categories.add("AUTHORIZATION");
    categories.add("AUTHENTICATION");
  }

  if (
    text.includes("codec") ||
    text.includes("encode") ||
    text.includes("decode") ||
    text.includes("serialization") ||
    text.includes("wire")
  ) {
    categories.add("ENCODING");
    categories.add("DECODING");
    categories.add("MALFORMED_INPUT");
  }

  if (
    text.includes("gas") ||
    text.includes("fee") ||
    text.includes("balance") ||
    text.includes("account")
  ) {
    categories.add("ACCOUNTING");
    categories.add("FEE");
    categories.add("DECIMAL");
    categories.add("ZERO");
    categories.add("MAX_VALUE");
  }

  if (
    text.includes("wal") ||
    text.includes("recover") ||
    text.includes("restart") ||
    text.includes("crash")
  ) {
    categories.add("CRASH_RECOVERY");
    categories.add("PARTIAL_FAILURE");
  }

  if (
    text.includes("attest") ||
    text.includes("nitro") ||
    text.includes("pcr") ||
    text.includes("quote")
  ) {
    categories.add("ATTESTATION");
    categories.add("AUTHENTICATION");
  }

  if (
    text.includes("key") ||
    text.includes("secret") ||
    text.includes("isolat")
  ) {
    categories.add("KEY_ISOLATION");
  }

  return [...categories];
}

/**
 * Determine whether a scenario should be treated as adversarial.
 */
function isAdversarialCategory(
  category: ScenarioCategory,
): boolean {
  return [
    "DUPLICATE",
    "CONFLICT",
    "REORDERING",
    "INTERLEAVING",
    "REPLAY",
    "REORG",
    "MALFORMED_INPUT",
    "AUTHORIZATION",
    "AUTHENTICATION",
    "QUORUM",
    "VOTING_POWER",
    "PARTIAL_FAILURE",
    "COMBINED",
  ].includes(category);
}

/**
 * Build scenario-specific mutations.
 */
function mutationsFor(
  category: ScenarioCategory,
  seed: string,
): string[] {
  const numeric =
    pickSeeded(
      SCENARIO_DIMENSIONS.numeric,
      `${seed}:numeric`,
    );

  const ordering =
    pickSeeded(
      SCENARIO_DIMENSIONS.ordering,
      `${seed}:ordering`,
    );

  const state =
    pickSeeded(
      SCENARIO_DIMENSIONS.state,
      `${seed}:state`,
    );

  const attacker =
    pickSeeded(
      SCENARIO_DIMENSIONS.attacker,
      `${seed}:attacker`,
    );

  const network =
    pickSeeded(
      SCENARIO_DIMENSIONS.network,
      `${seed}:network`,
    );

  const encoding =
    pickSeeded(
      SCENARIO_DIMENSIONS.encoding,
      `${seed}:encoding`,
    );

  const authorization =
    pickSeeded(
      SCENARIO_DIMENSIONS.authorization,
      `${seed}:authorization`,
    );

  const mutations: string[] = [];

  mutations.push(
    `Numeric boundary: ${numeric}`,
  );

  mutations.push(
    `Ordering mutation: ${ordering}`,
  );

  mutations.push(
    `State condition: ${state}`,
  );

  mutations.push(
    `Actor condition: ${attacker}`,
  );

  if (
    category === "REORDERING" ||
    category === "INTERLEAVING" ||
    category === "CONSENSUS"
  ) {
    mutations.push(
      `Network mutation: ${network}`,
    );
  }

  if (
    category === "ENCODING" ||
    category === "DECODING" ||
    category === "MALFORMED_INPUT"
  ) {
    mutations.push(
      `Encoding mutation: ${encoding}`,
    );
  }

  if (
    category === "AUTHORIZATION" ||
    category === "AUTHENTICATION" ||
    category === "RPC"
  ) {
    mutations.push(
      `Authorization mutation: ${authorization}`,
    );
  }

  return mutations;
}

/**
 * Build the action sequence.
 */
function actionsFor(
  hypothesis: RepoHypothesis,
  category: ScenarioCategory,
  seed: string,
): string[] {
  const actions = [
    ...hypothesis.toConfirm,
  ];

  const extraActions =
    pickManySeeded(
      [
        "initialize a fresh controlled state",
        "execute the normal valid path",
        "mutate exactly one state variable",
        "repeat the operation",
        "reverse the relevant ordering",
        "introduce a duplicate message or request",
        "remove one expected prerequisite",
        "restore the previous state",
        "compare resulting state with the control execution",
        "record all externally observable effects",
        "capture the exact input and output fingerprint",
        "repeat from a fresh state",
      ],
      `${seed}:actions`,
      5,
    );

  actions.push(
    ...extraActions,
  );

  if (
    category === "CRASH_RECOVERY"
  ) {
    actions.push(
      "terminate execution at a controlled persistence boundary",
      "restart from the persisted state",
      "replay recovery data",
      "compare recovered state against uninterrupted execution",
    );
  }

  if (
    category === "REPLAY"
  ) {
    actions.push(
      "capture the original valid request",
      "re-submit the exact request",
      "re-submit with a changed identifier",
      "compare authorization and state transitions",
    );
  }

  if (
    category === "REORG"
  ) {
    actions.push(
      "create an alternate chain/state branch",
      "remove the original branch",
      "reintroduce the transaction/state transition",
      "verify that effects are not incorrectly duplicated",
    );
  }

  return actions;
}

/**
 * Invariants that every scenario should observe.
 */
function invariantsFor(
  hypothesis: RepoHypothesis,
  category: ScenarioCategory,
): string[] {
  const invariants = [
    `The intended property remains valid: ${hypothesis.title}.`,
    "A failed experiment must not be interpreted as a vulnerability.",
    "The observed result must be reproducible from a captured input state.",
    "The control execution and mutated execution must be distinguishable.",
    "No scenario may bypass the deterministic evidence gate.",
  ];

  if (
    category === "REPLAY"
  ) {
    invariants.push(
      "A previously accepted operation must not gain unintended additional effect merely through replay.",
    );
  }

  if (
    category === "QUORUM" ||
    category === "VOTING_POWER"
  ) {
    invariants.push(
      "Voting power must be counted according to the protocol's actual quorum rules.",
    );
  }

  if (
    category === "ENCODING" ||
    category === "DECODING"
  ) {
    invariants.push(
      "A valid message must preserve all semantically relevant fields through encode/decode.",
    );
  }

  if (
    category === "ACCOUNTING" ||
    category === "DECIMAL" ||
    category === "FEE"
  ) {
    invariants.push(
      "The resulting balance and fee accounting must remain internally consistent.",
    );
  }

  if (
    category === "CRASH_RECOVERY"
  ) {
    invariants.push(
      "Recovery must not create a state transition that could not occur in uninterrupted execution.",
    );
  }

  if (
    category === "AUTHORIZATION"
  ) {
    invariants.push(
      "A request lacking the required authorization must not reach the protected operation.",
    );
  }

  if (
    category === "ATTESTATION"
  ) {
    invariants.push(
      "Only attestations satisfying the complete configured trust policy may be accepted.",
    );
  }

  return invariants;
}

/**
 * Expected safe behavior.
 */
function safeBehaviorFor(
  hypothesis: RepoHypothesis,
  category: ScenarioCategory,
): string[] {
  const result = [
    `The system preserves the intended security property described by "${hypothesis.title}".`,
    "Invalid or adversarial inputs are rejected or handled according to the documented protocol behavior.",
    "No unauthorized state transition occurs.",
    "No hidden state mutation appears outside the expected transition.",
  ];

  if (
    category === "REPLAY"
  ) {
    result.push(
      "Replay is rejected, idempotently ignored, or otherwise produces only the protocol-defined effect.",
    );
  }

  if (
    category === "REORDERING"
  ) {
    result.push(
      "Permitted ordering differences do not create an unauthorized divergent result.",
    );
  }

  if (
    category === "CRASH_RECOVERY"
  ) {
    result.push(
      "Recovery produces the same valid state as the corresponding uninterrupted execution.",
    );
  }

  if (
    category === "AUTHORIZATION" ||
    category === "AUTHENTICATION"
  ) {
    result.push(
      "The protected operation is unreachable without the required security checks.",
    );
  }

  return result;
}

/**
 * Failure signals are observations to collect.
 *
 * They are NOT automatically findings.
 */
function failureSignalsFor(
  hypothesis: RepoHypothesis,
  category: ScenarioCategory,
): string[] {
  const signals = [
    `Observed behavior contradicts the expected property: ${hypothesis.title}.`,
    "Two controlled executions produce an unexplained divergent security-relevant result.",
    "A state transition occurs without the expected prerequisite.",
    "A supposedly rejected operation produces a persistent security-relevant effect.",
    "A replay produces an additional effect that cannot be explained by protocol semantics.",
  ];

  if (
    category === "CONSENSUS" ||
    category === "QUORUM"
  ) {
    signals.push(
      "Different honest executions produce incompatible consensus outcomes.",
    );
  }

  if (
    category === "ACCOUNTING" ||
    category === "DECIMAL" ||
    category === "FEE"
  ) {
    signals.push(
      "Observed debit, credit, fee, or supply accounting cannot be reconciled.",
    );
  }

  if (
    category === "ENCODING" ||
    category === "DECODING"
  ) {
    signals.push(
      "Encode/decode changes a security-relevant field.",
    );
  }

  if (
    category === "KEY_ISOLATION"
  ) {
    signals.push(
      "Sensitive key material appears outside the expected trust boundary.",
    );
  }

  return signals;
}

/**
 * Build one deterministic scenario.
 */
export function buildShakuniScenario(
  hypothesis: RepoHypothesis,
  index: number,
): ShakuniScenario {
  const seed =
    `${hypothesis.id}:${index}`;

  const category =
    pickSeeded(
      categoriesForHypothesis(
        hypothesis,
      ),
      seed,
    );

  const mutations =
    mutationsFor(
      category,
      seed,
    );

  const actions =
    actionsFor(
      hypothesis,
      category,
      seed,
    );

  const now =
    new Date().toISOString();

  const scenarioId =
    `scenario_${hypothesis.id}_${String(index).padStart(5, "0")}`;

  return {
    id: scenarioId,

    hypothesisId:
      hypothesis.id,

    repository:
      "unknown",

    title:
      `${hypothesis.title}, scenario ${index}`,

    category,

    severityFocus:
      category === "CONSENSUS" ||
      category === "QUORUM" ||
      category === "KEY_ISOLATION" ||
      category === "AUTHORIZATION"
        ? "CRITICAL"
        : category === "ACCOUNTING" ||
            category === "REPLAY" ||
            category === "ATTESTATION"
          ? "HIGH"
          : "MEDIUM",

    description:
      `Deterministic scenario ${index} expands the "${hypothesis.id}" hypothesis across controlled state, ordering, boundary, adversarial, and failure dimensions.`,

    objective:
      `Determine whether the real implementation preserves the security property represented by "${hypothesis.title}" under the selected scenario mutations.`,

    preconditions: [
      "Use a controlled local execution environment.",
      "Use the pinned repository commit.",
      "Record the exact initial state.",
      "Do not interact with mainnet or third-party funds.",
      "Record the harness configuration.",
    ],

    actions,

    mutations,

    invariants:
      invariantsFor(
        hypothesis,
        category,
      ),

    expectedSafeBehavior:
      safeBehaviorFor(
        hypothesis,
        category,
      ),

    failureSignals:
      failureSignalsFor(
        hypothesis,
        category,
      ),

    edgeCases: [
      pickSeeded(
        SCENARIO_DIMENSIONS.numeric,
        `${seed}:edge:numeric`,
      ),
      pickSeeded(
        SCENARIO_DIMENSIONS.ordering,
        `${seed}:edge:ordering`,
      ),
      pickSeeded(
        SCENARIO_DIMENSIONS.state,
        `${seed}:edge:state`,
      ),
      pickSeeded(
        SCENARIO_DIMENSIONS.timing,
        `${seed}:edge:timing`,
      ),
    ],

    combinations:
      pickManySeeded(
        [
          "boundary + duplicate",
          "boundary + replay",
          "reordering + delay",
          "restart + replay",
          "partial failure + recovery",
          "malformed input + retry",
          "authorization + replay",
          "quorum + equivocation",
          "nonce + reorg",
          "encoding + boundary integer",
          "accounting + decimal boundary",
          "state transition + reordered messages",
        ],
        `${seed}:combinations`,
        3,
      ),

    replayRequired:
      category !== "BASELINE",

    independentReplayRequired:
      category === "BASELINE"
        ? 1
        : 3,

    freshStateRequired:
      category === "CONSENSUS" ||
      category === "REPLAY" ||
      category === "REORG" ||
      category === "CRASH_RECOVERY",

    crashRecoveryRelevant:
      category ===
        "CRASH_RECOVERY" ||
      category ===
        "PARTIAL_FAILURE",

    reorgRelevant:
      category === "REORG" ||
      category === "REPLAY",

    adversarial:
      isAdversarialCategory(
        category,
      ),

    malformedInput:
      category ===
        "MALFORMED_INPUT" ||
      category ===
        "ENCODING" ||
      category ===
        "DECODING",

    deterministic: true,

    generatedFrom:
      hypothesis.id,

    generationIndex:
      index,

    tags: [
      hypothesis.vulnClass,
      ...hypothesis.area,
      category,
      "generated",
      "reproducible",
    ],

    createdAt: now,
  };
}

/**
 * Generate a campaign of scenarios across ALL known hypotheses.
 *
 * Default = 5,000 total scenarios.
 *
 * Distribution is deterministic and balanced as far as possible.
 */
export function generateShakuniScenarios(
  repository?: string,
  total = 5_000,
): ShakuniScenario[] {
  const hypotheses =
    repository
      ? hypothesesFor(repository)
      : KNOWN_TARGETS.flatMap(
          (target) =>
            hypothesesFor(target),
        );

  if (!hypotheses.length) {
    return [];
  }

  const count =
    Math.max(
      0,
      Math.floor(total),
    );

  const scenarios: ShakuniScenario[] = [];

  for (
    let i = 0;
    i < count;
    i += 1
  ) {
    const hypothesis =
      hypotheses[
        i % hypotheses.length
      ];

    const scenario =
      buildShakuniScenario(
        hypothesis,
        i + 1,
      );

    scenario.repository =
      repository ??
      KNOWN_TARGETS[
        Math.floor(
          i /
            Math.max(
              1,
              Math.ceil(
                count /
                  KNOWN_TARGETS.length,
              ),
            ),
        ) %
          KNOWN_TARGETS.length
      ];

    scenarios.push(
      scenario,
    );
  }

  return scenarios;
}

/**
 * Generate a scenario campaign for ONE hypothesis.
 *
 * Useful when Shakuni discovers a particularly interesting property.
 */
export function generateHypothesisScenarios(
  hypothesisId: string,
  total = 5_000,
): ShakuniScenario[] {
  const hypothesis =
    KNOWN_TARGETS
      .flatMap((target) =>
        hypothesesFor(target),
      )
      .find(
        (h) =>
          h.id === hypothesisId,
      );

  if (!hypothesis) {
    return [];
  }

  return Array.from(
    { length: Math.max(0, total) },
    (_, index) =>
      buildShakuniScenario(
        hypothesis,
        index + 1,
      ),
  );
}

/**
 * Generate a smaller scenario batch.
 *
 * Useful for CI and quick local testing.
 */
export function generateScenarioBatch(
  repository: string,
  batchSize = 100,
  batchNumber = 0,
): ShakuniScenario[] {
  const hypotheses =
    hypothesesFor(repository);

  if (!hypotheses.length) {
    return [];
  }

  const scenarios: ShakuniScenario[] = [];

  for (
    let i = 0;
    i < batchSize;
    i += 1
  ) {
    const globalIndex =
      batchNumber *
        batchSize +
      i +
      1;

    const hypothesis =
      hypotheses[
        globalIndex %
          hypotheses.length
      ];

    const scenario =
      buildShakuniScenario(
        hypothesis,
        globalIndex,
      );

    scenario.repository =
      repository;

    scenarios.push(
      scenario,
    );
  }

  return scenarios;
}

/**
 * Scenario statistics.
 *
 * This gives Shakuni visibility into what it generated.
 */
export interface ShakuniScenarioStats {
  total: number;

  byHypothesis: Record<
    string,
    number
  >;

  byCategory: Record<
    string,
    number
  >;

  adversarial: number;

  malformed: number;

  replayRequired: number;

  crashRecoveryRelevant: number;

  reorgRelevant: number;

  freshStateRequired: number;
}

/**
 * Analyze a generated scenario campaign.
 */
export function analyzeScenarioCampaign(
  scenarios: ShakuniScenario[],
): ShakuniScenarioStats {
  const byHypothesis:
    Record<string, number> = {};

  const byCategory:
    Record<string, number> = {};

  let adversarial = 0;
  let malformed = 0;
  let replayRequired = 0;
  let crashRecoveryRelevant = 0;
  let reorgRelevant = 0;
  let freshStateRequired = 0;

  for (
    const scenario
    of scenarios
  ) {
    byHypothesis[
      scenario.hypothesisId
    ] =
      (byHypothesis[
        scenario.hypothesisId
      ] ?? 0) + 1;

    byCategory[
      scenario.category
    ] =
      (byCategory[
        scenario.category
      ] ?? 0) + 1;

    if (
      scenario.adversarial
    ) {
      adversarial += 1;
    }

    if (
      scenario.malformedInput
    ) {
      malformed += 1;
    }

    if (
      scenario.replayRequired
    ) {
      replayRequired += 1;
    }

    if (
      scenario.crashRecoveryRelevant
    ) {
      crashRecoveryRelevant += 1;
    }

    if (
      scenario.reorgRelevant
    ) {
      reorgRelevant += 1;
    }

    if (
      scenario.freshStateRequired
    ) {
      freshStateRequired += 1;
    }
  }

  return {
    total:
      scenarios.length,

    byHypothesis,

    byCategory,

    adversarial,

    malformed,

    replayRequired,

    crashRecoveryRelevant,

    reorgRelevant,

    freshStateRequired,
  };
}

/**
 * Remove duplicate scenario definitions by their semantic fingerprint.
 *
 * Scenario IDs are already unique, but this catches two generated scenarios
 * that accidentally describe exactly the same test.
 */
export function deduplicateShakuniScenarios(
  scenarios: ShakuniScenario[],
): ShakuniScenario[] {
  const seen =
    new Set<string>();

  const result:
    ShakuniScenario[] = [];

  for (
    const scenario
    of scenarios
  ) {
    const fingerprint =
      JSON.stringify({
        hypothesisId:
          scenario.hypothesisId,

        category:
          scenario.category,

        mutations:
          scenario.mutations,

        actions:
          scenario.actions,

        combinations:
          scenario.combinations,
      });

    if (
      seen.has(fingerprint)
    ) {
      continue;
    }

    seen.add(fingerprint);

    result.push(
      scenario,
    );
  }

  return result;
}

/**
 * Select scenarios that deserve deeper execution.
 *
 * This is prioritization only.
 * It does not assert that a scenario is vulnerable.
 */
export function prioritizeShakuniScenarios(
  scenarios: ShakuniScenario[],
): ShakuniScenario[] {
  return [...scenarios].sort(
    (a, b) => {
      const scoreA =
        scenarioPriorityScore(a);

      const scoreB =
        scenarioPriorityScore(b);

      return scoreB - scoreA;
    },
  );
}

function scenarioPriorityScore(
  scenario: ShakuniScenario,
): number {
  let score = 0;

  if (
    scenario.adversarial
  ) {
    score += 5;
  }

  if (
    scenario.replayRequired
  ) {
    score += 3;
  }

  if (
    scenario.freshStateRequired
  ) {
    score += 2;
  }

  if (
    scenario.reorgRelevant
  ) {
    score += 4;
  }

  if (
    scenario.crashRecoveryRelevant
  ) {
    score += 4;
  }

  if (
    scenario.malformedInput
  ) {
    score += 2;
  }

  if (
    scenario.category ===
    "COMBINED"
  ) {
    score += 5;
  }

  if (
    scenario.category ===
    "QUORUM"
  ) {
    score += 5;
  }

  if (
    scenario.category ===
    "AUTHORIZATION"
  ) {
    score += 5;
  }

  if (
    scenario.category ===
    "KEY_ISOLATION"
  ) {
    score += 5;
  }

  return score;
}

/**
 * Build an execution queue.
 *
 * The queue intentionally separates scenario generation from actual
 * repository execution.
 */
export interface ShakuniScenarioQueueItem {
  scenarioId: string;

  hypothesisId: string;

  priority: number;

  status:
    | "QUEUED"
    | "RUNNING"
    | "HELD"
    | "BROKEN"
    | "ERROR"
    | "BLOCKED"
    | "UNTESTED";

  attempts: number;

  lastResult?: string;
}

/**
 * Convert scenarios into an execution queue.
 */
export function createScenarioQueue(
  scenarios: ShakuniScenario[],
): ShakuniScenarioQueueItem[] {
  const prioritized =
    prioritizeShakuniScenarios(
      scenarios,
    );

  return prioritized.map(
    (scenario, index) => ({
      scenarioId:
        scenario.id,

      hypothesisId:
        scenario.hypothesisId,

      priority:
        index + 1,

      status:
        "QUEUED",

      attempts: 0,
    }),
  );
}

/**
 * Generate the default full campaign.
 *
 * This gives Shakuni one obvious entry point:
 *
 * generateDefaultShakuniCampaign()
 */
export function generateDefaultShakuniCampaign(): ShakuniScenario[] {
  return generateShakuniScenarios(
    undefined,
    5_000,
  );
}

/**
 * Campaign memory.
 *
 * This is intentionally separate from the original RepoHypothesis type.
 */
export interface ShakuniScenarioMemory {
  generated: number;

  executed: number;

  held: number;

  broken: number;

  errors: number;

  blocked: number;

  untested: number;

  previouslyBrokenScenarios: string[];

  previouslyHeldScenarios: string[];

  previouslyErroredScenarios: string[];

  failedScenarioIds: string[];

  successfulReplays: string[];

  updatedAt: string;
}

const SHAKUNI_SCENARIO_MEMORY =
  new Map<
    string,
    ShakuniScenarioMemory
  >();

/**
 * Get scenario memory for a repository.
 */
export function getScenarioMemory(
  repository: string,
): ShakuniScenarioMemory {
  const key =
    repository
      .trim()
      .toLowerCase();

  const existing =
    SHAKUNI_SCENARIO_MEMORY.get(
      key,
    );

  if (existing) {
    return existing;
  }

  const memory: ShakuniScenarioMemory = {
    generated: 0,

    executed: 0,

    held: 0,

    broken: 0,

    errors: 0,

    blocked: 0,

    untested: 0,

    previouslyBrokenScenarios: [],

    previouslyHeldScenarios: [],

    previouslyErroredScenarios: [],

    failedScenarioIds: [],

    successfulReplays: [],

    updatedAt:
      new Date().toISOString(),
  };

  SHAKUNI_SCENARIO_MEMORY.set(
    key,
    memory,
  );

  return memory;
}

/**
 * Remember the existence of a generated campaign.
 */
export function rememberGeneratedScenarios(
  repository: string,
  scenarios: ShakuniScenario[],
): ShakuniScenarioMemory {
  const memory =
    getScenarioMemory(
      repository,
    );

  memory.generated +=
    scenarios.length;

  memory.untested +=
    scenarios.length;

  memory.updatedAt =
    new Date().toISOString();

  return memory;
}

/**
 * Record one scenario execution.
 *
 * This does not decide whether the underlying property is vulnerable.
 */
export function rememberScenarioResult(
  repository: string,
  scenario: ShakuniScenario,
  result:
    | "HELD"
    | "BROKEN"
    | "ERROR"
    | "BLOCKED",
): ShakuniScenarioMemory {
  const memory =
    getScenarioMemory(
      repository,
    );

  memory.executed += 1;

  memory.untested =
    Math.max(
      0,
      memory.untested - 1,
    );

  if (
    result === "HELD"
  ) {
    memory.held += 1;

    memory.previouslyHeldScenarios.push(
      scenario.id,
    );
  }

  if (
    result === "BROKEN"
  ) {
    memory.broken += 1;

    memory.previouslyBrokenScenarios.push(
      scenario.id,
    );
  }

  if (
    result === "ERROR"
  ) {
    memory.errors += 1;

    memory.previouslyErroredScenarios.push(
      scenario.id,
    );
  }

  if (
    result === "BLOCKED"
  ) {
    memory.blocked += 1;
  }

  memory.updatedAt =
    new Date().toISOString();

  return memory;
}

/**
 * Return scenarios that have not previously been executed.
 */
export function untestedScenarios(
  repository: string,
  scenarios: ShakuniScenario[],
): ShakuniScenario[] {
  const memory =
    getScenarioMemory(
      repository,
    );

  const completed =
    new Set([
      ...memory.previouslyBrokenScenarios,
      ...memory.previouslyHeldScenarios,
      ...memory.previouslyErroredScenarios,
    ]);

  return scenarios.filter(
    (scenario) =>
      !completed.has(
        scenario.id,
      ),
  );
}

/**
 * Return scenarios that produced a BROKEN result in memory.
 *
 * NOTE:
 * BROKEN means the harness observed the property violation.
 * It is NOT equivalent to a confirmed vulnerability.
 */
export function previouslyBrokenScenarios(
  repository: string,
  scenarios: ShakuniScenario[],
): ShakuniScenario[] {
  const memory =
    getScenarioMemory(
      repository,
    );

  const broken =
    new Set(
      memory.previouslyBrokenScenarios,
    );

  return scenarios.filter(
    (scenario) =>
      broken.has(
        scenario.id,
      ),
  );
}

/**
 * Create an execution summary.
 */
export function scenarioCampaignSummary(
  repository: string,
): ShakuniScenarioMemory {
  return structuredClone(
    getScenarioMemory(
      repository,
    ),
  );
}
