# RPC Budgets

Studio and frontend RPC accounting are separate. This file defines the frontend plan only; the Studio capability probe and Studio matrix are created at PRE_DEPLOY.

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

STATUS: DEFERRED_TO_PRE_DEPLOY

Before Studio opens, probe whether physical request totals are observable. Lock either measured-count mode or observable-action-ledger mode, then define the separate Studio matrix for deploy and the approved positive, negative, no-write, and retry scenarios. No frontend count may substitute for Studio evidence.
