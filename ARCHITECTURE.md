# Shakuni Blockchain Security Intelligence

Shakuni now contains a typed multi-language and multi-blockchain research registry.

## Profiles

- Arc
- Circle
- Ethereum
- Bitcoin
- Solana
- Cosmos
- Polkadot
- Move ecosystems

## Circle coverage

The Circle profile models:

- USDC
- CCTP V2
- TokenMessenger
- MessageTransmitter
- Gateway
- Gateway Minter
- Circle Wallets
- Circle Contracts
- Paymaster
- Circle APIs
- Webhooks
- Attestation
- Arc integration

## Language registry

Rust, Go, C/C++, Solidity, Vyper, Yul, Move, Cairo, Haskell, TypeScript,
JavaScript, Python, Protobuf, Bitcoin Script, TEAL, Motoko, Bash, YAML, JSON and TOML.

## Security model

The registries connect languages and blockchain components to security properties
and executable invariant specifications. The UI at `/research` exposes the
current registry and Circle coverage.

This is a research architecture/registry layer. It does not claim a runtime
vulnerability or production exploitability merely from static metadata.


## Vulnerability behavior layer

The vulnerability layer contains 49 named behavioral definitions and 1224 deterministic dummy scenarios. It sits before hypothesis generation and after repository/architecture understanding. It does not bypass invariant, scope, safety, runtime, evidence, or reproducibility gates.

Scenario data flow: vulnerability behavior → scenario fixture → context match → hypothesis → safe experiment → invariant evaluation → disproof/reproduction → impact/scope → evidence/report.
