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
| Create rubric | explicit submit | optional get_id_by_nonce only during reconciliation | create_rubric once | transaction object at 2, 4, 8 seconds; stop after 3 | no automatic retry; retain hash and use explicit Resume | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus version 1 match | 6 | 1 | get_id_by_nonce then get_version(id,1), within two readbacks |
| Replace or lock rubric | explicit authorized submit | prestate already displayed; no automatic refresh | replace_rubric or lock_rubric once | transaction object at 2, 4, 8 seconds; stop after 3 | no automatic retry; retain hash and use explicit Resume | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus exact r+1 operation/postcondition | 6 | 1 | get_version(id,r+1), at most two readbacks |
| Put or freeze review | explicit reviewer submit | prestate already displayed; no automatic refresh | put_review or freeze_review once | transaction object at 2, 4, 8 seconds; stop after 3 | no automatic retry; retain hash and use explicit Resume | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus exact r+1 operation/postcondition | 6 | 1 | get_version(id,r+1), at most two readbacks |
| Calibrate or retry | explicit submit | prestate already displayed; no automatic refresh | calibrate_review or retry_review once | transaction object at 2, 4, 8 seconds; stop after 3 | no automatic retry; retain hash and use explicit Resume | no consequential cache | one measured wallet/write-context invalidation signal after authoritative readback | FINALIZED plus successful execution plus exact r+1 outcome/result | 6 | 1 | get_version(id,r+1), at most two readbacks |
| Resume journal | explicit Resume per entry | transaction object once and exact view once | none | none | no automatic retry; user may resume again | no cache | archive only after verified or proven finalized error | classified transaction plus authoritative state | 2 | 0 | stored-context nonce lookup/version readback |
| Hidden or disconnected | visibility/account/chain event | none | none | zero polls and teardown active timers | none | quarantine old-context records | reconnect never auto-resubmits | idle/quarantined | 0 | 0 | none |

Global controls: one shared client per chain/contract; normalized in-flight read deduplication; no consequential read cache; no render-driven portfolio polling; maximum two explicit journal reconciliations concurrently; maximum four visible journal entries per page; every timer is abortable and stops on hidden, unmount, disconnect, settlement, or context change. Wallet/write-context invalidation signals are emitted at the actual boundary even though no stale consequential cache is retained. A delayed or mismatched readback remains `RECONCILE` and never displays success.

## FRONTEND RPC BUDGET EVIDENCE

FRONTEND_RPC_EVIDENCE_STATUS: COMPLETE
MEASURED_CODE_RELEASE: `a92fa6c21a24249e67d63ea8cfb5424ec5fbf41d`
MEASURED_CODE_TREE: `b1898c37fd0b57b7943789dfa3ca59e63a35148d`
EVIDENCE_ARTIFACT: `docs/preflight/frontend-rpc-evidence-r11.md`
EVIDENCE_ARTIFACT_SHA256: `10E21B8FD463B76F7BC1A9FEBA1D41A9E53452640AF6F71960D87C53EAC0052B`
MEASUREMENT_RESULT: `AUTOMATED_EXACT_RELEASE_EVIDENCE: PASS`
BROWSER_VERCEL_TELEMETRY: `NOT_STARTED_BY_USER_BOUNDARY`

The bound artifact contains actual coordinator/helper call counts for Landing, Connect wallet, Case detail, Historical revision, every state-changing method, cancellation/quarantine, and Resume journal. It records request source/method, polling interval and attempts, retry/delay, cache hit/miss, in-flight deduplication, invalidation, authoritative readback, and transaction count. These are adapter/coordinator/helper observations from the exact measured release, not a claim of physical HTTP totals; browser/Vercel telemetry remains a later E2E requirement.

## HISTORICAL STUDIO RPC TEXT — NON-GOVERNING — DO NOT USE

The remainder of this file is retained only as a historical R8 record of the retired stable-network Studio measurement experiment. It is not a current requirement, not a Studio plan, not a readiness gate, and must not be used as PRE_DEPLOY evidence. The current Studio target is `https://studio-dev.genlayer.com/api`, chain `61997`, and its plan is `docs/preflight/studio-next-e2e-plan.md` under `STUDIO.TOOL_EXECUTION`.

STUDIO_CAPABILITY_PROBE_STATUS: COMPLETE
STUDIO_MEASUREMENT_MODE: OBSERVABLE_ACTION_LEDGER
STUDIO_MEASUREMENT_TIMING: PRE_E2E
STUDIO_CAPABILITY_PROBE_AT: 2026-09-07T03:44:50+07:00
STUDIO_CAPABILITY_TOOL_OR_API: Codex in-app Browser control surface (`cua.getState`, browser-tab accessibility state, and primary-AI action log)
STUDIO_CAPABILITY_CHECK: Before any Studio source load, deploy, signature, contract write, or E2E action, enumerate browser surfaces and inspect the Studio tab control surface for network/performance/request-log telemetry.
STUDIO_CAPABILITY_RESULT: Physical network-request events and totals are not exposed. Every primary-AI browser action, transaction submission, existing hash, bounded status poll, terminal receipt read, authoritative readback, retry, and duplicate-transaction decision is observable and can be entered into an action ledger.
STUDIO_PHYSICAL_COUNT_CLAIM: NONE
STUDIO_ACTION_LEDGER_STATUS: READY

Target environment: stable hosted Studionet at `https://studio.genlayer.com`, chain ID `61999`. The read-only account-selector check found the currently active accessible deployer `0xeF5D2119416A2f5afa35dCFA209766EFC1BE5902`, displaying `998 GEN`. This selection is Task-local and does not authorize a transaction before PRE_DEPLOY approval.

## STUDIO RPC BUDGET MATRIX

Every row is an observable-action ceiling, not a physical-request claim. One transaction submission is followed by at most three status polls at bounded intervals, one terminal receipt read, and one authoritative readback. Stop immediately on terminal error, quota/rate-limit cooldown, or an actual blocker. Reuse existing hashes; never redeploy or resubmit to obtain measurement.

| Scenario | Observable setup/read actions | Transaction submissions | Max status polls | Terminal receipt reads | Authoritative readbacks | Retry/duplicate rule | Terminal evidence |
|---|---:|---:|---:|---:|---:|---|---|
| Network, account, exact-source envelope and schema | 4 | 0 | 0 | 0 | 0 | one source load/probe only | Studionet 61999, selected account, exact source hash, constructor and 14-method schema inventory |
| Exact-source deployment | 1 | 1 | 3 | 1 | 1 | no redeploy; preserve hash on interruption | contract address, `FINALIZED`, semantic `SUCCESS`, consensus/finality, deployed-source parity |
| Case A positive lifecycle: create, replace, lock, put, freeze, calibrate | 0 | 6 | 18 | 6 | 6 | no automatic retry; each next write waits for prior readback | exact revisions 1–6 and terminal non-ambiguous outcome |
| Case B retry lifecycle: create, lock, put, freeze, calibrate to agreed ambiguity, then retry after on-chain cooldown | 0 | 6 | 18 | 6 | 6 | retry only if authoritative phase is `UNRESOLVED` and timestamp gate is open | exact revisions 1–6; retry result or honest model-dependent inability to enter retry state |
| Negative/no-write controls: wrong authority and stale revision | 2 | 2 | 6 | 2 | 2 | never repeat a rejected control | finalized execution error and exact unchanged authoritative version/state |
| Diagnostic reserve | 2 | 0 | 2 | 1 | 2 | only for an evidenced ambiguous hash/receipt/readback; no new transaction | classified existing transaction and reconciled state |
| **Maximum planned total** | **9** | **15** | **47** | **16** | **17** | **0 blind retries; 0 duplicate transactions** | complete action ledger with explained variance |

The retry branch is consensus-output dependent. It may execute only from an actually read-back `UNRESOLVED` state; a terminal non-ambiguous result must not be relabeled, replayed, or replaced merely to force the branch. Any inability to obtain a genuine agreed ambiguity is reported as a matrix variance for checkpoint review, never hidden or fabricated.
