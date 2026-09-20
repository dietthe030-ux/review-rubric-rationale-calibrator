# Review Rubric Rationale Calibrator — Studio Deployment Manifest

This is the secret-free recovery manifest for the current Studio Next deployment. It records the exact deployed bytes and identity; it does not claim POST_DEPLOY_TEST acceptance until the complete live matrix is complete.

## Deployment identity

- Classification: `INTENTIONALLY_FROZEN`
- Network: Studio Devnet / `studio-dev`
- Chain ID: `61997`
- RPC: `https://studio-dev.genlayer.com/api`
- Explorer: `https://explorer-studio-dev.genlayer.com/`
- Contract address: `0x939b18947EA1125668eD622c4f49c77167AAA4a5`
- Explorer transaction: `https://explorer-studio-dev.genlayer.com/tx/0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c`
- Deployment transaction: `0x87cd13fcaef7e2cc627f6a2adbc98819e06c47716ce457d4849236530c7c0e5c`
- Exact Git revision: `4eae82d9a372684ef6291970716fa30d61dfad32`
- Deployed source: `contracts/main.py`
- Deployed source SHA-256: `09A239AC767BDBD34BC86E71D09087C8D330FF577D52454065A47D6E39E69FB1`
- Constructor arguments: `[]`
- Deployer/owner actor: `actor7` / `0x8581c4a532dd3f9b163b12809b1bd089f367147f`
- Upgrader: `null` — intentionally frozen; no upgrade method or upgrader authority exists
- Linked contracts: none
- Configuration transactions: none

## Verified deployment result

- Receipt lifecycle: `FINALIZED` / `accepted`
- Semantic execution: `FINISHED_WITH_RETURN`
- Consensus: `MAJORITY_AGREE`
- Sender/origin: actor7 address above
- Fee deposit: `100000000000010352`
- Execution consumed: `78628000000000`
- Finalized refund: `99921372000009529`
- Source parity: `gen_getContractCode` returned 18128 bytes with the exact deployed source SHA-256 above
- Live schema: constructor `0`; 14 methods, 7 views and 7 writes
- Initial authoritative state: `get_count() = 0`; `get_id_by_nonce(actor7, a1b2c3d4e5f60718293a4b5c6d7e8f90) = 0`

## Recovery limits

This contract is intentionally frozen. A post-deployment defect requires a new deployment from the recorded source and constructor manifest; this address cannot be upgraded. If the recorded actor becomes unavailable, the contract remains readable but cannot be upgraded (and has no upgrade path). If Studio Next resets chain state, redeploy the recorded source and rerun live verification; do not assume this address survives the reset. No private key, password, seed phrase, token or credential is stored in this manifest.

## Acceptance boundary

The deployment is reconciled, but it is not the final release acceptance by itself. The ordered `POST_DEPLOY_TEST` Studio matrix in `docs/preflight/studio-next-e2e-plan.md` must still be executed with independent receipt, consensus, semantic-result and authoritative-readback evidence for every required case.
