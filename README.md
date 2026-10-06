# Shakuni

A local-first, safety-gated workspace and toolkit for ethical security research and bug-bounty work. Shakuni gives you a Burp-and-Linux-style tool suite plus an evidence-first research engine in one Next.js app that runs entirely on your own machine.

> Authorized testing only. Shakuni is for security research you are permitted to do: your own systems, or targets covered by a bug-bounty program whose scope and rules you follow. It does not grant authorization to test anything. See [Responsible use](#responsible-use).

## Why Shakuni

Most research needs a scatter of tools: a proxy, an encoder, a diff tool, a chain console, a scanner, a notebook. Shakuni brings the common ones into one place, keeps everything on localhost, and wraps the dangerous parts in explicit safety gates (testnet-only, no mainnet, local-only API routes, non-volumetric by default). It is built to help you get to a reproducible proof of concept, not to spray payloads.

## The tool suite

Workbench tools:

- Request Workbench: an HTTP repeater, an Intruder-style fuzzer, and a cross-tenant IDOR/BOLA matrix.
- Recon Suite: passive subdomain enumeration, DNS records, host probing, content discovery, and historical URLs.
- Decoder: Base64, URL, HTML, Hex, Unicode, ROT13, JWT decode, and SHA hashes.
- Comparer: line-by-line diff of two responses or payloads.
- Terminal: an allowlisted command runner (forge, anvil, cast, git, npm, node) confined to the project folder.

Smart-contract tools:

- Contract Scanner: offline vulnerability-pattern rules across Solidity, Rust/Anchor, Move, Cairo and Go, with per-asset methodology checklists.
- Solidity Analyzer: AST-level detectors via solc (structural, not regex).
- Foundry PoC Harness: write and run a forge test to capture a reproducible proof of concept.
- Chain Lab: testnet RPC reads plus an attestation lab (keccak, ECDSA sign/recover, EIP-712).

Research and reporting:

- Knowledge Base: a searchable reference across web, API, web3, mobile, network, cloud and binary domains.
- Asset Playbook: what to do for each bug-bounty asset type, and which tool to reach for.
- Repo Atlas: map how a program's repositories connect.
- Prior-Art Checker: search a repo's issues and PRs before you report, to avoid duplicates.
- Report Builder: turn a verified finding into a clean, reproducible report.
- An evidence-first research engine (constitution, deep-research loop, readiness gate) that refuses to promote a static signal to a "confirmed" bug without reproducible evidence.

## Quick start

Requirements: Node.js 20+ (22 recommended) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The dev server binds to 127.0.0.1 on purpose; Shakuni is meant to run only on your machine.

Production build:

```bash
npm run build
npm start
```

Useful scripts:

```bash
npm run lint       # eslint via next lint
npm run typecheck  # tsc --noEmit
```

## Safety model

- Local only. The app binds to 127.0.0.1, and the API routes that touch the network or run processes (Terminal, Request Workbench, Recon, Foundry harness) refuse any request whose Host is not loopback and any cross-origin browser call.
- Testnet only for chain operations. The Chain Lab is read-only, and the Foundry harness refuses a mainnet fork.
- Non-volumetric by default. The fuzzer and recon tools pace themselves; they are not load-testing tools and must not be used for denial of service.
- Nothing leaves your machine except calls you explicitly make (a request you send, a GitHub search, a testnet RPC read). Tokens are not stored.

## Optional: Foundry PoC Harness setup

The Foundry PoC Harness runs real `forge` tests. It expects a Foundry workspace at `foundry/` (not committed). To set it up locally:

```bash
# install Foundry: https://book.getfoundry.sh/getting-started/installation
forge init foundry --no-git
cd foundry && forge install foundry-rs/forge-std
```

The harness then writes each test into `foundry/test/` and runs it. If `foundry/` is absent, the rest of the app still works; only that one tool needs it.

## Project layout

- `app/` Next.js app-router pages and API routes.
- `components/` the UI for each tool.
- `lib/` the engine: scanner rules, knowledge base, the autonomous research pipeline, security guards, and the terminal runner.
- `ARCHITECTURE.md`, `RESEARCH_OS.md`, `DEEP_RESEARCH_ENGINE.md` the design and research philosophy.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md). In short: keep the safety gates intact, keep new network or process tools behind the local-only guard, and add a clear description of what a change does and how you verified it.

## Responsible use

Shakuni is a research tool. Use it only against systems you own or are explicitly authorized to test, stay within a program's scope and rules, use your own accounts and sandbox or testnet environments, never degrade a service, and never access other people's data. You are responsible for your own conduct. The authors provide the software as is, with no warranty, and accept no liability for misuse.

## License

[MIT](LICENSE).
