# Implementation Plan

1. Implement `contracts/main.py` from the locked specification, keeping helpers in the single deployable module.
2. Add deterministic, mocked-consensus, validator, serialization, and exact-schema tests before any Studio action.
3. Implement the functional React/Vite frontend: contract adapter, canonical wallet store, Web Locks journal, bounded RPC client, all role journeys, lifecycle progress, and authoritative readback.
4. Run exact-source contract and frontend verification; repair only demonstrated root causes and record mechanical changes.
5. Prepare the PRE_DEPLOY package and first-contact anonymous review prompt. Do not deploy without exact-revision approval.
6. Before PRE_DEPLOY review, classify the contract as `INTENTIONALLY_FROZEN`, lock the Studio Next `studio-dev` tool/readiness record and the minimum-sufficient Studio E2E plan under `STUDIO.TOOL_EXECUTION`; after approval, deploy once, execute that approved plan with bounded reconciliation, and obtain POST_DEPLOY_TEST approval. Studio has no RPC budget, request-count, measurement-mode, instrumentation or RPC evidence gate; the separate frontend RPC matrix remains in `docs/RPC-BUDGET.md`.
7. Lock user-supplied GitHub and Vercel targets, complete manual Claude presentation redesign (maximum two iterations), publish only approved public artifacts, then run Vercel E2E only after explicit user permission.
8. Complete POST_GITHUB_VERCEL_FINAL and EXPLORER_PRE_SUBMISSION reviews; provide the judge-facing submission form for manual submission.

No step authorizes a material Stage 1/2 change, duplicate transaction, inferred release target, direct Claude invocation, or optimistic success.

## Current governance/evidence adaptation record

- `EXPERIENCE.MANDATORY_APPLICATION`: the storage/recovery experience remains applied by the existing frontend journal and transaction tests; it is unaffected by this Studio-only documentation delta.
- The shared-RPC-capacity experience applies to the frontend matrix and proof tooling only. It does not authorize a Studio request-count or measurement gate because current `STUDIO.TOOL_EXECUTION` explicitly removes that gate.
- The historical upgrade-rehearsal experience is non-applicable: `contracts/main.py` has no upgrade/upgrader method, so the contract is explicitly `INTENTIONALLY_FROZEN` and actor7 is bound to deployer only.
- The historical runner-header incident is non-applicable: this batch does not change `contracts/main.py`, its source envelope, dependency pin or schema bytes.
- Vercel-release correction: `genlayer-js@1.1.8` exports stable `studionet` as chain `61999`, while the locked Studio Next deployment is chain `61997`; the frontend now clones the installed Studio chain profile with the current Studio Next RPC/explorer and has a direct chain-config regression. Public UI copy no longer exposes technical chain IDs, provider-routing terms or SDK/RPC implementation labels. This is a frontend-only configuration/presentation correction; contract bytes and Studio evidence remain valid, while frontend build, Vercel deployment and Vercel E2E are downstream-invalidated until rerun.
