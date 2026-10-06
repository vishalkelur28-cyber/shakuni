export type LanguageCategory =
  | "systems"
  | "smart-contract"
  | "zk"
  | "protocol"
  | "web"
  | "configuration"
  | "script";

export interface LanguageProfile {
  id: string;
  name: string;
  category: LanguageCategory;
  extensions: string[];
  securityFocus: string[];
}

export const languageRegistry: LanguageProfile[] = [
  { id: "rust", name: "Rust", category: "systems", extensions: [".rs"], securityFocus: ["consensus", "p2p", "state", "cryptography", "ffi"] },
  { id: "go", name: "Go", category: "systems", extensions: [".go"], securityFocus: ["p2p", "rpc", "grpc", "mempool", "state", "concurrency"] },
  { id: "cpp", name: "C++", category: "systems", extensions: [".cpp", ".cc", ".hpp", ".h"], securityFocus: ["memory-safety", "serialization", "networking", "cryptography"] },
  { id: "c", name: "C", category: "systems", extensions: [".c", ".h"], securityFocus: ["memory-safety", "native-boundaries", "cryptography"] },
  { id: "solidity", name: "Solidity", category: "smart-contract", extensions: [".sol"], securityFocus: ["access-control", "reentrancy", "oracle", "upgradeability", "token-accounting"] },
  { id: "vyper", name: "Vyper", category: "smart-contract", extensions: [".vy"], securityFocus: ["access-control", "external-calls", "state-integrity"] },
  { id: "yul", name: "Yul", category: "smart-contract", extensions: [".yul"], securityFocus: ["memory", "storage", "call-boundaries", "assembly"] },
  { id: "move", name: "Move", category: "smart-contract", extensions: [".move"], securityFocus: ["resources", "capabilities", "signers", "state-transition"] },
  { id: "cairo", name: "Cairo", category: "zk", extensions: [".cairo"], securityFocus: ["constraints", "proof-verification", "field-arithmetic", "serialization"] },
  { id: "haskell", name: "Haskell", category: "protocol", extensions: [".hs", ".lhs"], securityFocus: ["ledger-rules", "validation", "serialization", "state-transition"] },
  { id: "typescript", name: "TypeScript", category: "web", extensions: [".ts", ".tsx"], securityFocus: ["api", "authentication", "authorization", "webhooks"] },
  { id: "javascript", name: "JavaScript", category: "web", extensions: [".js", ".jsx"], securityFocus: ["api", "authentication", "authorization", "webhooks"] },
  { id: "python", name: "Python", category: "web", extensions: [".py"], securityFocus: ["automation", "api", "signing", "research-harness"] },
  { id: "protobuf", name: "Protobuf", category: "protocol", extensions: [".proto"], securityFocus: ["rpc", "serialization", "service-boundaries"] },
  { id: "bitcoin-script", name: "Bitcoin Script", category: "script", extensions: [".script"], securityFocus: ["spend-conditions", "signatures", "transaction-validation"] },
  { id: "teal", name: "TEAL", category: "smart-contract", extensions: [".teal"], securityFocus: ["transaction-logic", "authorization", "state"] },
  { id: "motoko", name: "Motoko", category: "smart-contract", extensions: [".mo"], securityFocus: ["actor-state", "authorization", "upgradeability"] },
  { id: "bash", name: "Bash", category: "script", extensions: [".sh", ".bash"], securityFocus: ["deployment", "credentials", "command-execution"] },
  { id: "yaml", name: "YAML", category: "configuration", extensions: [".yml", ".yaml"], securityFocus: ["deployment", "permissions", "secrets", "networking"] },
  { id: "json", name: "JSON", category: "configuration", extensions: [".json"], securityFocus: ["api", "configuration", "policy"] },
  { id: "toml", name: "TOML", category: "configuration", extensions: [".toml"], securityFocus: ["configuration", "toolchain", "runtime"] },
];
