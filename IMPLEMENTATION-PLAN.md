# Implementation Plan

1. Implement `contracts/main.py` from the locked specification, keeping helpers in the single deployable module.
2. Add deterministic, mocked-consensus, validator, serialization, and exact-schema tests before any Studio action.
3. Implement the functional React/Vite frontend: contract adapter, canonical wallet store, Web Locks journal, bounded RPC client, all role journeys, lifecycle progress, and authoritative readback.
4. Run exact-source contract and frontend verification; repair only demonstrated root causes and record mechanical changes.
5. Prepare the PRE_DEPLOY package and first-contact anonymous review prompt. Do not deploy without exact-revision approval.
6. After PRE_DEPLOY approval, probe Studio RPC measurement mode, deploy, execute the approved matrix, and obtain POST_DEPLOY_TEST approval.
7. Lock user-supplied GitHub and Vercel targets, complete manual Claude presentation redesign (maximum two iterations), publish only approved public artifacts, then run Vercel E2E only after explicit user permission.
8. Complete POST_GITHUB_VERCEL_FINAL and EXPLORER_PRE_SUBMISSION reviews; provide the judge-facing submission form for manual submission.

No step authorizes a material Stage 1/2 change, duplicate transaction, inferred release target, direct Claude invocation, or optimistic success.
