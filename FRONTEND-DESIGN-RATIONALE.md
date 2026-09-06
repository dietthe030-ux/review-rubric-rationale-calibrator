# Frontend Design Rationale

Status: functional frontend complete; presentation redesign pending manual Claude handoff.

## Product expression

The interface treats the product as a durable calibration record, not an AI scoring toy. The primary question is whether a written rationale supports the selected frozen anchor. Public copy explicitly excludes submission quality and external-fact verification.

## Information architecture

- The opening section explains the decision boundary and permanent-public-data warning before any action.
- Record lookup and immutable status appear before role-specific writes.
- Owner, reviewer, and evaluator actions share one workspace but remain disabled unless wallet role and on-chain phase permit them.
- Transaction state, hash recovery, and the local journal remain visible as evidence rather than being hidden behind optimistic success UI.
- Public documentation explains the four-step workflow and repeats the exact limitation statement.

## Visual direction

The functional version uses a quiet archival palette, high-contrast typography, restrained borders, and minimal motion. Claude may substantially improve composition, hierarchy, responsive behavior, accessibility, and create a small original logo/brand mark, while preserving every mechanism and public claim.

The final direction should feel like a public evidence instrument: precise, calm, legible, and distinctive enough for a GenLayer judge to recognize after one visit. It should not imitate a trading dashboard, chat product, generic SaaS landing page, or AI image generator. Deliberately rejected patterns include repetitive card grids, decorative gradients/glows, excessive pills, fake metrics/testimonials, oversized empty hero space, generic three-feature marketing rows, and ornamental blockchain imagery. The core visual metaphor may draw from calibration, ruled measurement, anchor marks, or an evidence ledger, but it must not imply mathematical certainty beyond the contract's recorded classification.

## Non-negotiable behavior

The redesign must preserve detected-wallet cardinality, read-only behavior without a verified contract address, all seven contract actions, phase/role guards, transaction lifecycle states, hash copy/explorer access, journal visibility/export, text-node rendering, and the exact public boundary language. It must not add backend services, analytics, remote assets, new dependencies, architecture changes, deployment assumptions, or claims that GenLayer verifies external truth or submission quality.
