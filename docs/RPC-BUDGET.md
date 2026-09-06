# RPC Budgets

Studio and frontend RPC accounting are separate. Both plans are locked before PRE_DEPLOY review; Studio evidence will be recorded separately after approval.

## FRONTEND RPC BUDGET MATRIX

FRONTEND_MATRIX_STATUS: READY

| Screen/workflow | Trigger | Read(s) | Write | Polling | Retry/backoff | Cache key/TTL | Invalidation | Terminal condition | Max RPC requests | Max transactions | Authoritative readback |
|---|---|---|---|---|---|---|---|---|---:|---:|---|
| Landing | route load | none | none | none | none | none | none | static render | 0 | 0 | none |
| Connect wallet | explicit Connect then provider choice | chain ID once after connect | none | none | provider request only, no RPC retry | no cache | account or chain event clears session-bound state | supported chain and account synchronized | 1 | 0 | wallet chain/account event state |
| Case list | explicit list route or page action | list_cases once per page | none | none | one user-triggered retry after bounded transport backoff | chain+contract+list_cases+page / current view session | successful relevant create; chain or contract change | page returned or explicit error | 1 | 0 | list_cases response |
| Case detail | explicit case selection | get_case once | none | none | one user-triggered retry after bounded transport backoff | chain+contract+get_case+id / until mutation or context change | any accepted write for case; chain or contract change | exact case returned or not found | 1 | 0 | get_case response |
| Historical revision | explicit revision click | get_version once | none | none | one user-triggered retry after bounded transport backoff | chain+contract+get_version+id+revision / immutable | chain or contract change only | exact revision returned or not found | 1 | 0 | get_version response |
| Create rubric | explicit submit | optional get_id_by_nonce only during reconciliation | create_rubric once | transaction object at 2, 4, 8 seconds; stop after 3 | honor Retry-After or bounded exponential delay; never resubmit | no consequential cache | invalidate list and actor list after verified readback | FINALIZED plus successful execution plus version 1 match | 6 | 1 | get_id_by_nonce then get_version(id,1), within two readbacks |
| Replace or lock rubric | explicit authorized submit | prestate already displayed; no automatic refresh | replace_rubric or lock_rubric once | transaction object at 2, 4, 8 seconds; stop after 3 | honor Retry-After or bounded exponential delay; never resubmit | no consequential cache | invalidate case and target history after verified readback | FINALIZED plus successful execution plus exact r+1 operation/postcondition | 6 | 1 | get_version(id,r+1), at most two readbacks |
| Put or freeze review | explicit reviewer submit | prestate already displayed; no automatic refresh | put_review or freeze_review once | transaction object at 2, 4, 8 seconds; stop after 3 | honor Retry-After or bounded exponential delay; never resubmit | no consequential cache | invalidate case and target history after verified readback | FINALIZED plus successful execution plus exact r+1 operation/postcondition | 6 | 1 | get_version(id,r+1), at most two readbacks |
| Calibrate or retry | explicit submit | prestate already displayed; no automatic refresh | calibrate_review or retry_review once | transaction object at 2, 4, 8 seconds; stop after 3 | honor Retry-After or bounded exponential delay; never resubmit | no consequential cache | invalidate case and target history after verified readback | FINALIZED plus successful execution plus exact r+1 outcome/result | 6 | 1 | get_version(id,r+1), at most two readbacks |
| Resume journal | explicit Resume per entry | transaction object once and exact view once | none | none | no automatic retry; user may resume again | no cache | archive only after verified or proven finalized error | classified transaction plus authoritative state | 2 | 0 | stored-context nonce lookup/version readback |
| Hidden or disconnected | visibility/account/chain event | none | none | zero polls and teardown active timers | none | quarantine old-context records | reconnect never auto-resubmits | idle/quarantined | 0 | 0 | none |

Global controls: one shared client per chain/contract; normalized in-flight read deduplication; no render-driven portfolio polling; maximum two explicit journal reconciliations concurrently; maximum four visible journal entries per page; every timer is abortable and stops on hidden, unmount, disconnect, settlement, or context change. A delayed or mismatched readback remains `RECONCILE` and never displays success.

## STUDIO RPC BUDGET

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
