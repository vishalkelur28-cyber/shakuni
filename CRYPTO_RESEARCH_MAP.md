# Crypto / Blockchain Research Expansion

Shakuni now models protocol-specific security surfaces rather than treating every chain as an identical blockchain.

Domains include:
- EVM/account chains
- Bitcoin/UTXO
- Solana/SVM
- Cosmos/CometBFT
- Move/resource chains
- Rollups/L2
- bridges/cross-chain messaging
- stablecoins/token issuers
- wallets/remote signers/custody
- DeFi/AMMs/lending/perps
- oracles
- governance/upgrades
- P2P/gossip
- MEV/sequencing
- privacy/ZK
- data availability
- node/RPC/indexer/cloud infrastructure

Universal dimensions include authenticity, authorization, replay, nonce/sequence,
serialization, state transition, atomicity, value conservation, domain separation,
cross-chain binding, finality, consensus, P2P, oracle, governance, signing and
secret-boundary checks.

Each domain has its own invariants, mutation families and safe research environments.
Unknown or unsupported runtime capability remains an explicit coverage gap.
