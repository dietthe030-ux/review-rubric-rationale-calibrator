# Rubric Rationale Calibrator

Rubric Rationale Calibrator records whether a reviewer's written rationale supports the integer anchor they selected, then stores the validator-consensus classification as an auditable on-chain result.

## Verified links

- Live app: https://review-rubric-rationale-calibrator.vercel.app
- Studio Next contract: [`0x939b18947EA1125668eD622c4f49c77167AAA4a5`](https://explorer-studio-dev.genlayer.com/address/0x939b18947EA1125668eD622c4f49c77167AAA4a5)
- Deployment transaction: [`0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c`](https://explorer-studio-dev.genlayer.com/tx/0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c)

## Trust problem

A score can look precise while its explanation supports a different rubric anchor. Reviewers, submitters and evaluators need a shared record of the exact rubric, selected score and written rationale; a mutable off-chain display cannot provide that history.

## Why GenLayer matters

The contract freezes the rubric and review, then asks independent validators to classify the rationale against the selected anchor. Only the agreed stable label vector is stored, so the on-chain consequence is a reproducible calibration result rather than an unverifiable prose opinion.

## How it works

1. Define one to four dimensions and every integer anchor, assign a distinct reviewer, and submit the rubric.
2. Lock the rubric so its anchors cannot change.
3. The assigned reviewer submits one bounded score and rationale per dimension, then freezes the review.
4. Anyone may request calibration. The result is `CALIBRATED`, `RATIONALE_SCORE_CONFLICT`, `ANCHOR_MISSING`, or `UNRESOLVED`, with the exact submitted material preserved.
5. Use the historical record to inspect the revision that produced the result.

All submitted text is public and permanent. Do not submit private information, credentials or personal records. The contract assesses the exact submitted material only; it does not verify external facts, submission quality, reviewer competence or fairness.

## Architecture

- `contracts/main.py` is the single Intelligent Contract and source of truth for rubrics, reviews, revisions and calibration outcomes.
- `frontend/` is a React/Vite client using `genlayer-js`, a single shared read client, detected MetaMask/OKX Wallet/Rabby providers and a restart-safe transaction journal.
- Studio Next is the execution network: chain `61997`, RPC `https://studio-dev.genlayer.com/api`.
- The contract is intentionally frozen after deployment; there is no upgrade or linked-contract path.

## Transaction lifecycle

Every write is signed by the selected wallet, retains its real transaction hash, waits for final network confirmation, verifies successful execution and checks the exact historical revision before showing success. Rejected, failed or uncertain writes remain visible for safe reconciliation and are never automatically resubmitted.

## Run locally

```powershell
npm --prefix frontend install
$env:VITE_CONTRACT_ADDRESS="0x939b18947EA1125668eD622c4f49c77167AAA4a5"
npm --prefix frontend run dev -- --host 127.0.0.1
```

Use a supported injected wallet on Studio Next. A production build is created with `npm --prefix frontend run build`.

## Tests and verification

```powershell
python -m pytest -q -p no:cacheprovider
python -m py_compile contracts/main.py
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

The release verification record is [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Security and trust boundaries

The browser never contains a private key or deployment credential. Wallet choice, account and network are explicit; writes are disabled unless the selected provider, account and Studio Next network remain synchronized. Contract authorization and compare-and-swap revisions are enforced on-chain.

## Known limitations

- The contract has no upgrade path; a material contract defect requires a new deployment.
- The product deliberately classifies rationale-to-anchor consistency only. It does not establish objective truth or reviewer competence.
- Wallet availability depends on the user's installed MetaMask, OKX Wallet or Rabby provider.
