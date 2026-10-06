import { SecurityProperty } from "../security/registry";

export interface BlockchainProfile {
  id: string;
  name: string;
  ecosystems: string[];
  languages: string[];
  components: string[];
  securityProperties: SecurityProperty[];
  surfaces: string[];
}

export const blockchainProfiles: BlockchainProfile[] = [
  {
    id: "arc",
    name: "Arc",
    ecosystems: ["EVM", "Arc"],
    languages: ["rust", "go", "typescript", "protobuf", "yaml", "json", "toml"],
    components: ["Arc Node", "Malachite", "consensus", "P2P", "Engine API", "execution", "mempool", "remote signer", "attestation", "KMS"],
    securityProperties: ["consensus-safety", "consensus-liveness", "authentication", "authorization", "replay-resistance", "signature-integrity", "state-integrity", "key-isolation", "serialization-safety", "deserialization-safety"],
    surfaces: ["P2P", "consensus messages", "Engine API", "transactions", "remote signer", "attestation", "KMS"],
  },
  {
    id: "circle",
    name: "Circle",
    ecosystems: ["USDC", "CCTP", "Gateway", "Wallets", "Payments", "Arc"],
    languages: ["solidity", "rust", "go", "typescript", "protobuf", "yaml", "json"],
    components: ["USDC", "CCTP V2", "TokenMessenger", "MessageTransmitter", "Gateway", "Gateway Minter", "Circle Wallets", "Circle Contracts", "Paymaster", "Circle APIs", "Webhooks", "Arc"],
    securityProperties: ["authentication", "authorization", "replay-resistance", "signature-integrity", "state-integrity", "transaction-integrity", "key-isolation", "serialization-safety", "deserialization-safety", "access-control", "economic-integrity", "cross-chain-message-integrity", "attestation-integrity", "webhook-authenticity"],
    surfaces: ["mint/burn", "cross-chain messaging", "attestation", "gateway deposits", "signed burn intents", "wallet signing", "contract deployment", "paymaster", "API authentication", "webhooks"],
  },
  {
    id: "ethereum",
    name: "Ethereum",
    ecosystems: ["EVM"],
    languages: ["solidity", "vyper", "yul", "go", "rust", "typescript"],
    components: ["execution client", "consensus client", "EVM", "smart contracts", "mempool", "RPC", "P2P"],
    securityProperties: ["consensus-safety", "replay-resistance", "signature-integrity", "state-integrity", "transaction-integrity", "access-control", "economic-integrity"],
    surfaces: ["EVM", "smart contracts", "RPC", "P2P", "mempool", "consensus"],
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    ecosystems: ["UTXO"],
    languages: ["cpp", "c", "bitcoin-script"],
    components: ["Bitcoin Core", "UTXO", "Script", "mempool", "P2P", "wallet"],
    securityProperties: ["consensus-safety", "replay-resistance", "signature-integrity", "state-integrity", "transaction-integrity"],
    surfaces: ["Script", "transactions", "mempool", "P2P", "wallet"],
  },
  {
    id: "solana",
    name: "Solana",
    ecosystems: ["SVM"],
    languages: ["rust", "typescript"],
    components: ["programs", "runtime", "validator", "accounts", "transactions", "P2P"],
    securityProperties: ["authorization", "state-integrity", "transaction-integrity", "replay-resistance", "signature-integrity"],
    surfaces: ["programs", "accounts", "runtime", "validator", "RPC"],
  },
  {
    id: "cosmos",
    name: "Cosmos",
    ecosystems: ["Cosmos SDK", "CometBFT"],
    languages: ["go", "rust", "protobuf"],
    components: ["Cosmos SDK", "CometBFT", "ABCI", "IBC", "modules", "mempool", "P2P"],
    securityProperties: ["consensus-safety", "consensus-liveness", "authorization", "replay-resistance", "state-integrity", "cross-chain-message-integrity"],
    surfaces: ["consensus", "IBC", "ABCI", "modules", "P2P"],
  },
  {
    id: "polkadot",
    name: "Polkadot",
    ecosystems: ["Substrate"],
    languages: ["rust", "typescript"],
    components: ["Substrate", "runtime", "pallets", "consensus", "P2P", "parachains"],
    securityProperties: ["consensus-safety", "state-integrity", "authorization", "replay-resistance", "cross-chain-message-integrity"],
    surfaces: ["runtime", "pallets", "consensus", "parachains", "P2P"],
  },
  {
    id: "move",
    name: "Move Ecosystems",
    ecosystems: ["MoveVM"],
    languages: ["move", "rust", "typescript"],
    components: ["modules", "resources", "capabilities", "transactions", "state"],
    securityProperties: ["authorization", "access-control", "resource-integrity", "state-integrity", "transaction-integrity"],
    surfaces: ["modules", "resources", "capabilities", "transactions"],
  },
];
