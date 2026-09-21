# Verification

## Current code-bearing release

- Source revision: `de2895280e93472b22defa7ac8507cadec6f1a9e`
- Contract source SHA-256: `09A239AC767BDBD34BC86E71D09087C8D330FF577D52454065A47D6E39E69FB1`
- Studio Next contract: [`0x939b18947EA1125668eD622c4f49c77167AAA4a5`](https://explorer-studio-dev.genlayer.com/address/0x939b18947EA1125668eD622c4f49c77167AAA4a5)
- Deployment transaction: [`0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c`](https://explorer-studio-dev.genlayer.com/tx/0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c)
- Network: GenLayer Studio Next, chain `61997`
- Contract/source state: intentionally frozen; no upgrade authority is claimed.

## Automated verification

- Frontend: `npm --prefix frontend test -- --run` — 22 passed.
- Frontend build: `npm --prefix frontend run build` — passed; Vite reports only the disclosed large-chunk warning.
- Contract: `python -m pytest -q -p no:cacheprovider` — 17 passed.
- Contract syntax: `python -m py_compile contracts/main.py` — passed.
- Contract lint/schema: `genvm-lint check contracts/main.py --json` — passed; 14 methods, 7 views, 7 writes, zero constructor parameters; informational I200 only.
- Frontend request limits: [`docs/RPC-BUDGET.md`](RPC-BUDGET.md) records the bounded matrix, cancellation controls, two-reconciliation ceiling, and exact-release automated evidence. Browser/Vercel E2E is tracked as a separate running gate.

## Studio evidence

The deployed contract source, lifecycle receipts, consensus/finality, semantic execution and authoritative readbacks are recorded in [`DEPLOYMENT-MANIFEST.md`](../DEPLOYMENT-MANIFEST.md) and the internal Studio evidence ledger. The browser-based Vercel E2E remains a separate required release gate; this document does not claim that it has passed.

## Public release targets

- Repository: `https://github.com/dietthe030-ux/review-rubric-rationale-calibrator`
- Planned production URL: `https://review-rubric-rationale-calibrator.vercel.app`
