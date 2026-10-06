## What this changes

<!-- A short description of the change and why. -->

## How I verified it

<!-- Say what you ran and what you saw. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Manually tested the affected tool or page

## Safety checklist

- [ ] Any new network or process route goes through the local-only guard (`lib/security/local-only.ts`)
- [ ] No mainnet path added; chain operations stay testnet-only and non-destructive
- [ ] The change stays non-volumetric (no DoS, mass scanning, or brute force)
- [ ] No secrets, tokens, `.env` files, or real target data are committed
- [ ] No em-dashes in UI copy or docs
