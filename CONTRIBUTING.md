# Contributing to Shakuni

Thanks for your interest in improving Shakuni. This project is a local-first, safety-gated toolkit for ethical security research. Contributions that make the tools sharper, safer or easier to use are very welcome.

## Ground rules

Shakuni is built for authorized testing only. Every contribution must keep that true:

- Keep the safety gates intact. Any API route that touches the network or runs a process must go through the local-only guard (`lib/security/local-only.ts`), the same way the existing routes do. Do not add a route that can be reached cross-origin or from a non-loopback host.
- Chain operations stay testnet-only and read-only where they are today. Do not add a path that can send a mainnet transaction or fork mainnet.
- Keep tools non-volumetric. No feature should enable denial of service, mass scanning, or brute force against authentication.
- Do not commit secrets, tokens, `.env` files, or any real target's data or findings. The `.gitignore` already excludes private research artifacts; keep it that way.

## Development setup

Requirements: Node.js 20+ (22 recommended) and npm.

```bash
npm install
npm run dev        # http://localhost:3000, bound to 127.0.0.1
```

Before you open a pull request:

```bash
npm run typecheck  # must pass with zero errors
npm run lint
```

## Conventions

- TypeScript throughout. Match the style of the file you are editing.
- UI uses the shared Tailwind component classes (see `app/globals.css`); reuse `.card`, `.btn`, `.input`, `.badge`, `.callout` rather than inventing new ones.
- New tool pages follow the existing pattern: a server page that renders `PageHeader` plus a client component.
- Register new tools or reference pages in `lib/workspace/flow.ts` so they appear in the navigation.
- Do not use em-dashes in UI copy or docs; use a comma or a regular hyphen.

## Pull requests

- Describe what the change does and, importantly, how you verified it (what you ran, what you saw).
- One focused change per pull request is easier to review than a large mixed one.
- If you add a tool that reaches the network, say in the PR how you kept it within the safety model.

## Reporting a security issue in Shakuni itself

If you find a vulnerability in Shakuni's own code (for example a way to bypass the local-only guard), please open a private report to the maintainer rather than a public issue, and give enough detail to reproduce it.
