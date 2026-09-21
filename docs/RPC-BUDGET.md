# Frontend RPC Budget

This file is the frontend-only RPC budget matrix. Studio does not use a request-count, measurement-mode, instrumentation or RPC evidence gate; Studio readiness and E2E planning are governed only by `STUDIO.TOOL_EXECUTION` and the current Studio Next plan artifact.

## FRONTEND RPC BUDGET MATRIX

FRONTEND_MATRIX_STATUS: READY
FRONTEND_TARGET: GenLayer Studio Next (`https://studio-dev.genlayer.com/api`, chain `61997`, Explorer `https://explorer-studio-dev.genlayer.com/`)

| Screen/workflow | Trigger | Read(s) | Write | Polling | Retry/backoff | Cache key/TTL | Invalidation | Terminal condition | Max RPC requests | Max transactions | Authoritative readback |
|---|---|---|---|---|---|---|---|---|---:|---:|---|
| Landing | route load | none | none | none | none | none | none | static render | 0 | 0 | none |
| Connect wallet | explicit Connect then provider choice | chain ID once after connect | none | none | provider request only, no RPC retry | no cache | account or chain event clears session-bound state | supported chain and account synchronized | 1 | 0 | wallet chain/account event state |
| Case detail | explicit case lookup action | get_case once | none | none | no automatic retry; user may repeat the explicit lookup | chain+contract+get_case+id / in-flight only | no cache; context key changes and wallet-context invalidation signal | exact case returned or not found | 1 | 0 | get_case response |
| Historical revision | explicit revision click | get_version once | none | none | no automatic retry; user may repeat the explicit lookup | chain+contract+get_version+id+revision / in-flight only | no cache; context key changes and wallet-context invalidation signal | exact revision returned or not found | 1 | 0 | get_version response |
| Create rubric | explicit submit | fee simulation/estimate once; optional get_id_by_nonce only during reconciliation | create_rubric once | transaction object at 2, 4, 8, 12, 16 seconds; stop after 5 | no automatic resubmission; retain hash and expose explicit Resume only after the bounded window | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus version 1 match | 8 | 1 | get_id_by_nonce then get_version(id,1), within two readbacks |
| Replace or lock rubric | explicit authorized submit | fee simulation/estimate once; prestate already displayed | replace_rubric or lock_rubric once | transaction object at 2, 4, 8, 12, 16 seconds; stop after 5 | no automatic resubmission; retain hash and expose explicit Resume only after the bounded window | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus exact r+1 operation/postcondition | 7 | 1 | get_version(id,r+1), at most two readbacks |
| Put or freeze review | explicit reviewer submit | fee simulation/estimate once; prestate already displayed | put_review or freeze_review once | transaction object at 2, 4, 8, 12, 16 seconds; stop after 5 | no automatic resubmission; retain hash and expose explicit Resume only after the bounded window | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus exact r+1 operation/postcondition | 7 | 1 | get_version(id,r+1), at most two readbacks |
| Calibrate or retry | explicit submit | fee simulation/estimate once; prestate already displayed | calibrate_review or retry_review once | transaction object at 2, 4, 8, 12, 16 seconds; stop after 5 | no automatic resubmission; retain hash and expose explicit Resume only after the bounded window | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus exact r+1 outcome/result | 7 | 1 | get_version(id,r+1), at most two readbacks |
| Resume journal | explicit Resume per entry | transaction object once and exact view once | none | none | no automatic retry; user may resume again | no cache | archive only after verified or proven finalized error | classified transaction plus authoritative state | 2 | 0 | stored-context nonce lookup/version readback |
| Hidden or disconnected | visibility/account/chain event | none | none | zero polls and teardown active timers | none | quarantine old-context records | reconnect never auto-resubmits | idle/quarantined | 0 | 0 | none |

Global controls: one shared client per chain/contract; normalized in-flight read deduplication; no consequential read cache; no render-driven portfolio polling; maximum two explicit journal reconciliations concurrently; maximum four visible journal entries per page; every timer is abortable and stops on hidden, unmount, disconnect, settlement, or context change. Wallet/write-context invalidation signals are emitted at the actual boundary even though no stale consequential cache is retained. A delayed or mismatched readback remains `RECONCILE` and never displays success.

## FRONTEND RPC BUDGET EVIDENCE

FRONTEND_RPC_EVIDENCE_STATUS: COMPLETE
MEASURED_CODE_RELEASE: `9fb6fc921858e50e8014c159aa499d417caa86d5`
MEASURED_CODE_TREE: `8da99688da109179423474cd66ac2c8f3d6957bd`
MEASUREMENT_RESULT: `AUTOMATED_EXACT_RELEASE_EVIDENCE: PASS`
BROWSER_VERCEL_TELEMETRY: `LIVE_BROWSER_E2E_COMPLETE`

The public ledger below contains actual coordinator/helper call counts for Landing, Connect wallet, Case detail, Historical revision, every state-changing method, cancellation/quarantine, and Resume journal. It records request source/method, polling interval and attempts, retry/delay, cache hit/miss, in-flight deduplication, invalidation, authoritative readback, and transaction count. These are adapter/coordinator/helper observations from the exact measured release, not a claim of physical HTTP totals; browser/Vercel telemetry remains a separate E2E requirement.

| Observed workflow | Requests | Polling | Readbacks | Submissions | Invalidation | Terminal |
|---|---:|---|---:|---:|---:|---|
| Landing | 0 | none | 0 | 0 | 0 | static render |
| Connect wallet | 1 chain check | none | 0 | 0 | 0 | chain/account synchronized |
| Case detail | 1 | none | 1 | 0 | 0 | authoritative case returned |
| Historical revision | 1 | none | 1 | 0 | 0 | authoritative revision returned |
| `create_rubric` | 4 | 1 fee estimate + 1 poll at 2,000 ms | 2 | 1 | 1 | `SUCCESS` |
| `replace_rubric` | 3 | 1 fee estimate + 1 poll at 2,000 ms | 1 | 1 | 1 | `SUCCESS` |
| `lock_rubric` | 3 | 1 fee estimate + 1 poll at 2,000 ms | 1 | 1 | 1 | `SUCCESS` |
| `put_review` | 3 | 1 fee estimate + 1 poll at 2,000 ms | 1 | 1 | 1 | `SUCCESS` |
| `freeze_review` | 3 | 1 fee estimate + 1 poll at 2,000 ms | 1 | 1 | 1 | `SUCCESS` |
| `calibrate_review` | 3 | 1 fee estimate + 1 poll at 2,000 ms | 1 | 1 | 1 | `SUCCESS` |
| `retry_review` | 3 | 1 fee estimate + 1 poll at 2,000 ms | 1 | 1 | 1 | `SUCCESS` |
| Hidden or disconnected | 0 | cancelled before first poll | 0 | 1 already submitted | 0 | `RECONCILIATION_REQUIRED` |
| Explicit journal resume | 2 | none | 1 | 0 | 0 | `VERIFIED` |

Exact command: `$env:FRONTEND_RPC_EVIDENCE_RELEASE='9fb6fc921858e50e8014c159aa499d417caa86d5'; npx vitest run tests/rpc-evidence.test.ts --reporter=dot --silent=false`. Result: 1/1 evidence test passed at `2026-09-21T06:11:00Z`. The harness SHA-256 was `BB092916B4599DD6959C1A36C538CB57C541B060364EBA9F58CB5120F3EA9919`.

The live Chrome run on the stable Vercel alias independently completed `create_rubric`, `lock_rubric`, `put_review`, `freeze_review`, and `calibrate_review` with five distinct transaction hashes, no duplicate submission, bounded automatic finality, semantic success, and exact authoritative case readback at revision 5. The browser control surface does not expose physical HTTP-event totals, so the automated ledger above is explicitly helper/coordinator instrumentation; the live run proves the user-visible lifecycle and transaction count without relabelling observations as packet-level telemetry. Transaction links and the final readback are published in [`VERIFICATION.md`](VERIFICATION.md).
