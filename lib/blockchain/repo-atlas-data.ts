// Data for the Repo Atlas: blockchain fundamentals, the layer/link taxonomy, and
// the Circle bug-bounty scope as a pre-loaded worked example. Plain-English and
// technical copy sit side by side so one toggle can switch the whole page's depth.

export type LayerId = "web2" | "gateway" | "bridge" | "token" | "payments" | "wallet";

export interface Layer {
  id: LayerId;
  name: string;
  /** Hex tuned for the dark theme (readable on #06080c). */
  color: string;
}

export const LAYERS: Layer[] = [
  { id: "web2", name: "Control plane (web2)", color: "#8099e8" },
  { id: "gateway", name: "Gateway / reserve", color: "#ab8df1" },
  { id: "bridge", name: "CCTP bridge", color: "#3ac1d9" },
  { id: "token", name: "USDC token", color: "#e0a94a" },
  { id: "payments", name: "Payments", color: "#53c18b" },
  { id: "wallet", name: "Wallet", color: "#e585a7" },
];

export const LAYER: Record<LayerId, Layer> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l]),
) as Record<LayerId, Layer>;

export type LinkTypeId = "builton" | "shares" | "mints" | "controls" | "protocol";

export interface LinkType {
  id: LinkTypeId;
  name: string;
  /** A verified, high-leverage code link (drawn in accent). */
  key: boolean;
  dashed?: boolean;
  simple: string;
  tech: string;
}

export const LINK_TYPES: LinkType[] = [
  {
    id: "builton",
    name: "Built on",
    key: true,
    simple: "One is built on top of the other and can't work without it.",
    tech: "Compile-time import plus runtime dependency. A bug in the base contract affects both repositories.",
  },
  {
    id: "shares",
    name: "Shares code",
    key: true,
    simple: "They use the exact same shared code for part of their job.",
    tech: "Shared library/crate pinned at one version. A single bug there counts against both repositories.",
  },
  {
    id: "mints",
    name: "Mints via",
    key: false,
    simple: "The transfer service creates USDC by going through the token contract.",
    tech: "The bridge/gateway holds a minter role on the FiatToken; mint authority flows through the token's role model.",
  },
  {
    id: "controls",
    name: "Controls",
    key: false,
    simple: "The website or API drives this on-chain piece.",
    tech: "Off-chain control plane orchestrates on-chain actions (mint, transfer, configuration).",
  },
  {
    id: "protocol",
    name: "Shares protocol",
    key: false,
    dashed: true,
    simple: "Same design on different blockchains, trusting the same Circle signer.",
    tech: "Common message format and off-chain attester trust root; a design flaw is systemic, a porting bug is per-chain.",
  },
];

export const LINK_TYPE: Record<LinkTypeId, LinkType> = Object.fromEntries(
  LINK_TYPES.map((t) => [t.id, t]),
) as Record<LinkTypeId, LinkType>;

export interface LearnItem {
  title: string;
  color: LayerId;
  simple: string;
  tech: string;
  term: string;
}

export const LEARN: LearnItem[] = [
  {
    title: "Blockchain",
    color: "bridge",
    simple: "A shared record book that everyone keeps a copy of. Once something is written, nobody can quietly change the past.",
    tech: "An append-only, replicated ledger secured by cryptographic hashing and consensus; state changes are deterministic and publicly verifiable.",
    term: "ledger · consensus · immutable",
  },
  {
    title: "Smart contract",
    color: "gateway",
    simple: "A small program that lives on the blockchain and runs exactly as written. It can hold and move money on its own.",
    tech: "Code deployed at an address with its own storage, invoked by transactions; executes deterministically on-chain and enforces rules without a trusted intermediary.",
    term: "address · storage · deterministic",
  },
  {
    title: "USDC (stablecoin)",
    color: "token",
    simple: "A digital dollar. One USDC is meant to always be worth $1, backed by real reserves.",
    tech: "A fiat-collateralized token (Circle's FiatToken) pegged 1:1 to USD reserves; mint and burn are gated by role-based minters.",
    term: "peg · reserves · FiatToken",
  },
  {
    title: "Mint & burn",
    color: "token",
    simple: "“Minting” creates new digital dollars; “burning” destroys them. Only approved parties may do either.",
    tech: "mint() raises supply to a recipient within a minter allowance; burn() lowers it. masterMinter / minter roles decide who mints and how much.",
    term: "minter allowance · masterMinter",
  },
  {
    title: "Cross-chain transfer (CCTP)",
    color: "bridge",
    simple: "A way to move your digital dollars between blockchains: it burns them on the first chain and creates the same amount on the second.",
    tech: "Burn on the source chain emits a message; Circle's attester signs it; the destination verifies the signature and mints the equal amount, with nonce-based replay protection.",
    term: "burn → attest → mint · nonce",
  },
  {
    title: "Attestation & signer",
    color: "web2",
    simple: "Circle acts like a notary: it signs a note saying “yes, this really happened.” The other chain only acts if it sees that signature.",
    tech: "An off-chain attester set produces threshold ECDSA signatures over the message; on-chain code recovers the signers, checks they are enabled and meet the threshold, and binds the destination domain.",
    term: "threshold ECDSA · attester set",
  },
  {
    title: "Gateway",
    color: "gateway",
    simple: "A newer “one balance you can spend on any chain” service: deposit once, then spend wherever you need.",
    tech: "A deposit into the wallet contract credits a unified balance; a signed burn intent plus attestation authorizes a mint on the destination; a withdrawal delay blocks double-spend.",
    term: "unified balance · withdrawal delay",
  },
  {
    title: "Sandbox / testnet",
    color: "payments",
    simple: "A safe practice version of everything, using fake money, so you can test without risking real funds.",
    tech: "Test chains plus sandbox APIs with non-production keys and faucet-funded test tokens; bug-bounty rules require it so testing never touches mainnet value.",
    term: "testnet · faucet · api-sandbox",
  },
];

export interface SeedRepo {
  name: string;
  url: string;
  lang: string;
  layer: LayerId;
  simple: string;
  tech: string;
}

export const SEED_REPOS: SeedRepo[] = [
  { name: "api.circle.com", url: "https://api-sandbox.circle.com", lang: "Web2", layer: "web2", simple: "The developer API you call to mint USDC, send transfers and manage wallets.", tech: "Public REST API orchestrating on-chain actions; test on api-sandbox.circle.com." },
  { name: "app.circle.com", url: "https://app-sandbox.circle.com", lang: "Web2", layer: "web2", simple: "The web app customers log into to manage their account and money.", tech: "Customer-facing web application; test on app-sandbox.circle.com." },
  { name: "console.circle.com", url: "https://console.circle.com", lang: "Web2", layer: "web2", simple: "The developer dashboard for keys and settings (web2 parts only).", tech: "Developer console; only the web2 portion is in scope, no web3 features." },
  { name: "stablecoin-evm", url: "https://github.com/circlefin/stablecoin-evm", lang: "Solidity", layer: "token", simple: "The USDC digital dollar on Ethereum and EVM chains.", tech: "Canonical FiatToken: role-gated mint/burn, blocklist, pausable." },
  { name: "stablecoin-sui", url: "https://github.com/circlefin/stablecoin-sui", lang: "Move", layer: "token", simple: "USDC on the Sui blockchain.", tech: "FiatToken port in Move for Sui." },
  { name: "stablecoin-aptos", url: "https://github.com/circlefin/stablecoin-aptos", lang: "Move", layer: "token", simple: "USDC on the Aptos blockchain.", tech: "FiatToken port in Move for Aptos." },
  { name: "stablecoin-starknet", url: "https://github.com/circlefin/stablecoin-starknet", lang: "Cairo", layer: "token", simple: "USDC on Starknet.", tech: "FiatToken port in Cairo." },
  { name: "stablecoin-near", url: "https://github.com/circlefin/stablecoin-near", lang: "Rust", layer: "token", simple: "USDC on NEAR.", tech: "FiatToken port in Rust for NEAR." },
  { name: "stablecoin-xlm", url: "https://github.com/circlefin/stablecoin-xlm", lang: "Rust", layer: "token", simple: "USDC on Stellar, also supplies shared permission code.", tech: "FiatToken on Soroban; exports the role/auth crates reused by stellar-cctp." },
  { name: "noble-fiattokenfactory", url: "https://github.com/circlefin/noble-fiattokenfactory", lang: "Go", layer: "token", simple: "USDC on the Noble (Cosmos) chain.", tech: "FiatToken factory as a Cosmos SDK module." },
  { name: "evm-cctp-contracts", url: "https://github.com/circlefin/evm-cctp-contracts", lang: "Solidity", layer: "bridge", simple: "Moves USDC between EVM chains by burning on one and minting on another.", tech: "Reference CCTP: MessageTransmitter + TokenMessenger/Minter." },
  { name: "noble-cctp", url: "https://github.com/circlefin/noble-cctp", lang: "Go", layer: "bridge", simple: "Cross-chain transfer on the Noble chain.", tech: "CCTP as a Cosmos SDK module." },
  { name: "solana-cctp-contracts", url: "https://github.com/circlefin/solana-cctp-contracts", lang: "Rust", layer: "bridge", simple: "Cross-chain transfer on Solana.", tech: "CCTP Anchor programs for Solana." },
  { name: "sui-cctp", url: "https://github.com/circlefin/sui-cctp", lang: "Move", layer: "bridge", simple: "Cross-chain transfer on Sui.", tech: "CCTP Move implementation (V1 + V2)." },
  { name: "aptos-cctp", url: "https://github.com/circlefin/aptos-cctp", lang: "Move", layer: "bridge", simple: "Cross-chain transfer on Aptos.", tech: "CCTP Move implementation (V1 + V2)." },
  { name: "starknet-cctp", url: "https://github.com/circlefin/starknet-cctp", lang: "Cairo", layer: "bridge", simple: "Cross-chain transfer on Starknet.", tech: "CCTP Cairo implementation." },
  { name: "stellar-cctp", url: "https://github.com/circlefin/stellar-cctp", lang: "Rust", layer: "bridge", simple: "Cross-chain transfer on Stellar.", tech: "CCTP on Soroban; reuses stablecoin-xlm's role crates." },
  { name: "evm-gateway-contracts", url: "https://github.com/circlefin/evm-gateway-contracts", lang: "Solidity", layer: "gateway", simple: "One USDC balance you can spend across chains, deposit once, mint where you need it.", tech: "GatewayWallet + GatewayMinter; attested mint with a withdrawal delay." },
  { name: "solana-gateway-contracts", url: "https://github.com/circlefin/solana-gateway-contracts", lang: "Rust", layer: "gateway", simple: "Gateway unified balance on Solana.", tech: "Gateway programs for Solana." },
  { name: "evm-xreserve-contracts", url: "https://github.com/circlefin/evm-xreserve-contracts", lang: "Solidity", layer: "gateway", simple: "A cross-chain reserve built on top of Gateway.", tech: "xReserve; imports Gateway's libraries and calls its contracts." },
  { name: "evm-cpn-contracts", url: "https://github.com/circlefin/evm-cpn-contracts", lang: "Solidity", layer: "payments", simple: "On-chain payment settlement (Circle Payments Network).", tech: "PaymentSettlement with Permit2 and attester-gated settle/refund." },
  { name: "buidl-wallet-contracts", url: "https://github.com/circlefin/buidl-wallet-contracts", lang: "Solidity", layer: "wallet", simple: "A smart-contract crypto wallet (account abstraction).", tech: "ERC-4337 / ERC-6900 modular smart accounts." },
];

export interface SeedLink {
  from: string;
  to: string;
  type: LinkTypeId;
}

export const SEED_LINKS: SeedLink[] = [
  { from: "evm-xreserve-contracts", to: "evm-gateway-contracts", type: "builton" },
  { from: "stellar-cctp", to: "stablecoin-xlm", type: "shares" },
  { from: "evm-cctp-contracts", to: "stablecoin-evm", type: "mints" },
  { from: "evm-gateway-contracts", to: "stablecoin-evm", type: "mints" },
  { from: "sui-cctp", to: "stablecoin-sui", type: "mints" },
  { from: "aptos-cctp", to: "stablecoin-aptos", type: "mints" },
  { from: "starknet-cctp", to: "stablecoin-starknet", type: "mints" },
  { from: "stellar-cctp", to: "stablecoin-xlm", type: "mints" },
  { from: "noble-cctp", to: "noble-fiattokenfactory", type: "mints" },
  { from: "api.circle.com", to: "evm-gateway-contracts", type: "controls" },
  { from: "api.circle.com", to: "evm-cctp-contracts", type: "controls" },
  { from: "sui-cctp", to: "evm-cctp-contracts", type: "protocol" },
  { from: "stellar-cctp", to: "evm-cctp-contracts", type: "protocol" },
];

export const MAX_REPOS = 30;
