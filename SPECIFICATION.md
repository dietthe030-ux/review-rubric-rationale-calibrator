# Review Rubric Rationale Calibrator — Build Specification

Status: SPEC_LOCK candidate  
Workflow: Build  
Task ID: `review-rubric-rationale-calibrator`  
Research baseline: C7 / R12, unchanged

## Product boundary

A rubric owner freezes one to four complete integer-anchor dimensions before a distinct reviewer submits and freezes one score plus rationale per dimension. GenLayer independently classifies whether each rationale supports the selected anchor, supports an incompatible anchor, omits anchor-linked reasoning, or remains ambiguous. The contract records calibration consistency only. It never verifies submission quality, external facts, reviewer competence, or fairness, and it never rewrites a score.

## Locked architecture

- One Python Intelligent Contract at `contracts/main.py`; no backend, external API, linked contract, token, payment, timer, or upgrade mechanism.
- Exact common storage, case record, capacities, canonical JSON, authority model, revision history, parent rules, public views, and write profiles remain those in `STAGE-2.md`.
- Candidate-specific base, response, result, reducer, seven write signatures, UI journeys, labels, bounds, and tests remain exactly `STAGE-2.md` lines 115–140.
- One custom `gl.vm.run_nondet_unsafe` call per accepted evaluation attempt. Both leader and validators independently classify the same primitive frozen JSON. Only the exact four-label vector is compared; no free-form model prose is stored or compared.
- All deterministic validation, output parsing, result reduction, record-size checks, capacity checks, and prospective history checks occur before mutation. Model failure, malformed output, validator disagreement, or VM failure leaves all declared maps and counters unchanged.
- React/Vite frontend with one shared GenLayer client, one canonical wallet-session store, and one restart-safe Web Locks journal. Presentation redesign remains a later manual Claude handoff after the functional frontend exists.

## Exact result consequence

For the four frozen dimensions in order:

1. Any `UNKNOWN` produces `UNRESOLVED`.
2. Otherwise any `SUPPORTS_OTHER` produces `DONE / RATIONALE_SCORE_CONFLICT`.
3. Otherwise any `MISSING_ANCHOR_REASON` produces `DONE / ANCHOR_MISSING`.
4. Otherwise all `SUPPORTS_SELECTED` produces `DONE / CALIBRATED`.

The public copy is limited to “Rationale matches the selected rubric anchors”, “Review needs revision”, or “Unresolved”. It must also state: “Assessment of this exact submitted material only; not verification of external facts.”

## Runtime feasibility and version lock

Checked 2026-09-07 (Asia/Saigon) against current official GenLayer documentation for Intelligent Contract structure, storage, equivalence, LLM calls, nondeterminism, transaction context, and `genvm-lint`.

- Installed: Python 3.13, `genvm-linter 0.11.0`, Node 22.22.2, npm 12.0.2.
- Probe: `docs/preflight/schema-feasibility-probe.py` SHA-256 `2880D04B56607E82E0BC5BC4151CC10A97F2D380D1F71CA22D0E877ED217A1F3`.
- Compatible official-doc dependency: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` from cached GenVM `v0.2.16`.
- `genvm-lint check ... --json`: PASS, 3 lint checks, contract discovered, 3 probe methods, zero constructor parameters.
- Schema SHA-256: `091469E70928D224BD110ABD9EB52CB149A14E1B3479CC85525CC082E06E538D`; required `Address`, `u256`, `str`, view/write and return boundaries were extracted.
- Newer runner `1zr6nqk...` from `v0.3.0-rc7` was also tested and failed SDK validation with `No module named 'genlayer.py'`. Its package layout is a different API generation and is incompatible with the latest available linter's current schema loader. It is not used. This does not alter product behavior or Stage 2 architecture.
- The production source will pin the compatible dependency above. Before PRE_DEPLOY it must pass exact-source lint/schema and a read-only current Studio source-envelope/schema probe. A different current Studio requirement reopens only the version/header decision and invalidates source-dependent evidence.

## Experience application map

- Independent consensus rederivation: validator reruns the same bounded classification and compares every consequential label; semantic-forgery regression required.
- Narrow GenVM doubles: pure helpers are tested without pretending mocks prove runtime serialization; exact-source lint/schema and Direct Mode remain separate evidence.
- Protocol-schema parity: one checklist must compare contract result keys/types/order with frontend parser, tests, and evidence.
- Git initialized before implementation: baseline commit `34db3a49a33f9930ea83e8809b689dec440fbd63` preserves the approved Research handoff before source changes.
- Durable storage fail-closed and transaction-hash recovery: no wallet write before a journal reservation; no resubmit after ambiguous hash/return; reconcile finality, execution, and exact historical readback.
- Wallet discovery/provider binding: display only detected MetaMask, OKX, and Rabby providers and bind writes to the selected provider.
- Source-envelope and runner bundle: pin the compatible runner; verify current Studio header before PRE_DEPLOY rather than copying a historical header.
- Finality/readback: success requires `FINALIZED`, semantic execution success, and method-specific authoritative historical readback.

## Verification plan

- Pure deterministic/state tests: exact key sets, duplicate-key rejection, UTF-8 caps, bool-as-int rejection, anchor interval completeness, authority, every phase transition, CAS, idempotent create, parent/history/capacity/revision reservation, and no-write failures.
- Mocked consensus tests: every label and reducer precedence, generic/copied rationale, contrary anchor, ambiguity, malformed/oversized output, leader/validator disagreement, accepted retry cooldown, third unresolved exhaustion, and unchanged storage on non-accepted execution.
- Schema/runtime: exact source `genvm-lint check`, `schema`, public-signature diff, serialization/pickling checks, and current Studio read-only schema probe.
- Frontend: all owner/reviewer/evaluator actions, wallet discovery/session synchronization, journal mutex/crash recovery/capacity, same-case conflict, provider/account/chain switch quarantine, bounded RPC counts, transaction lifecycle, exact historical readback, and accessible public states.
- Live stages remain gated in order: PRE_DEPLOY approval → Studio deploy/E2E → POST_DEPLOY_TEST approval → locked GitHub/Vercel targets → explicit user permission for Vercel E2E → final checkpoints and Explorer package.

## Adaptation decision

No material Stage 1/2 adaptation is proposed. The idea, trust problem, actors, authority, states, API surface, nondeterministic mechanism, consequence, UI journey, acceptance criteria, and evidence requirements remain unchanged. Pinning the documented compatible runner is the Build-time version resolution required by the Research plan, not a product or architecture change.
