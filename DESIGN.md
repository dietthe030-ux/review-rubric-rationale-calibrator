# Design — Rubric Rationale Calibrator

<!-- Hallmark · macrostructure: Narrative Workflow · genre: editorial · theme: Almanac · anchor hue: 48 -->
<!-- Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 -->
<!-- Hallmark · nav: N1b · footer: Ft4 · slop: pass (42–45) · contrast: pass (40–41) · honest: pass (46) · tokens: pass (48) · responsive: pass (49, 50–57) -->

A locked design brief for the GenLayer public Rubric Rationale Calibrator.

## Product & Aesthetic Identity

The Rubric Rationale Calibrator is a public verification and evidence instrument on GenLayer Studionet. It operates under a strict decision boundary: it independently evaluates whether a reviewer's written rationale supports the integer anchor they selected on a locked rubric. It deliberately **excludes** verification of external facts, submission quality, reviewer competence, or subjective fairness, and never alters submitted scores.

The interface is designed as an **archival evidence instrument** — drawing from calibration gauges, ruled measurement marks, and ledger spec sheets. It is quiet, high-contrast, mathematically precise, and legible, communicating auditability without false claims of empirical certainty.

## Hallmark Architecture Choices

- **Genre**: `editorial` — Canonical anti-slop voice. Appropriate for governance, legal-technical instruments, and public consensus records.
- **Macrostructure**: `14 · Narrative Workflow` (with `F3 · Tabular Spec Sheet` ledger elements) — Organizes the interface around the four sequential stages of on-chain calibration:
  1. Rubric Definition & Anchor Locking (Owner)
  2. Review Submission & Freezing (Reviewer)
  3. GenLayer Validator Consensus Calibration (Validators)
  4. Authoritative Historical Readback & Verification (Public Evidence)
- **Theme**: `Almanac` (Archival Reference Ledger)
  - Paper Band: Light (`oklch(96.8% 0.010 82)`) — warm parchment vellum
  - Display Style: Roman Serif (`Newsreader`, `Charter`, `Georgia`, serif) — dignified, upright, non-italic headers
  - Accent Hue: 48° warm copper/amber calibration indicator (`oklch(56% 0.17 48)`)
- **Navigation Archetype**: `N1b · Canonical SaaS/App Three-Section` — Wordmark + compact gauge mark left, section jump links center, network pill and wallet connection right.
- **Footer Archetype**: `Ft4 · Dense Typographic Colophon` — High-density monospace archival ledger block detailing contract limitations, public record disclaimers, chain configuration, and historical readback verification.

## Design Tokens (OKLCH, 4px Spacing, Zero Remote Dependencies)

### Color System
- `--color-paper`: `oklch(96.8% 0.010 82)` (Base archival surface)
- `--color-paper-subtle`: `oklch(94.8% 0.012 82)` (Secondary panels, table strips)
- `--color-paper-elevated`: `oklch(98.6% 0.006 82)` (Card surfaces, dialogs, inputs)
- `--color-paper-contrast`: `oklch(91.5% 0.015 82)` (Recessed ledgers, code surfaces)
- `--color-rule`: `oklch(83% 0.012 82)` (Hairline measurement rules)
- `--color-rule-subtle`: `oklch(88% 0.009 82)` (Minor dividers)
- `--color-rule-strong`: `oklch(68% 0.015 82)` (Active bounds, selected borders)
- `--color-ink`: `oklch(20% 0.015 65)` (Primary archival iron ink)
- `--color-ink-secondary`: `oklch(40% 0.012 65)` (Secondary annotations, timestamps)
- `--color-ink-muted`: `oklch(56% 0.010 65)` (Muted labels, metadata)
- `--color-ink-inverse`: `oklch(98% 0.005 82)` (Light ink on dark surfaces)
- `--color-accent`: `oklch(56% 0.17 48)` (Calibration copper / indicator accent, < 4% viewport)
- `--color-accent-ink`: `oklch(98% 0.005 82)` (High-contrast ink on accent fill)
- `--color-accent-subtle`: `oklch(93.5% 0.035 48)` (Light copper tint for badges)
- `--color-status-calibrated`: `oklch(50% 0.13 145)` (Calibrated / agreement green)
- `--color-status-conflict`: `oklch(52% 0.16 32)` (Needs revision / conflict red)
- `--color-status-unresolved`: `oklch(54% 0.13 85)` (Unresolved consensus amber)
- `--color-role-reviewer-bg`: `oklch(93% 0.04 245)` (Reviewer role background)
- `--color-role-reviewer-ink`: `oklch(35% 0.12 245)` (Reviewer role text)
- `--color-focus`: `oklch(50% 0.18 245)` (Instrument sapphire focus ring, >= 3:1 contrast)

### Typography
- Display: `"Newsreader", "Charter", "Bitstream Charter", "Georgia", serif` (Roman, weight 600, tight tracking `-0.02em`, strictly no italic headers)
- Body: `"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif` (Weight 400, line-height 1.55)
- Mono/Ledger: `"Geist Mono", "JetBrains Mono", "SF Mono", "Consolas", monospace` (Weight 450, tabular nums)
- Wordmark Outlier: `"Fraunces", "Charter", "Georgia", serif` (Weight 600)
- Zero remote runtime font requests: uses system-installed serif/sans/mono stacks with zero network dependencies.

### Spacing Scale (4px increments)
- `--space-3xs`: `0.25rem` (4px)
- `--space-2xs`: `0.5rem` (8px)
- `--space-xs`: `0.75rem` (12px)
- `--space-sm`: `1rem` (16px)
- `--space-md`: `1.5rem` (24px)
- `--space-lg`: `2rem` (32px)
- `--space-xl`: `3rem` (48px)
- `--space-2xl`: `4rem` (64px)
- `--space-3xl`: `6rem` (96px)

### Motion & Microinteractions
- Three purposeful primitives: subtle fade, micro translateY (`-1px` on hover/active), smooth indicator rotate.
- Only transforms and opacity are transitioned; layout properties are never animated.
- Full `@media (prefers-reduced-motion: reduce)` support: pauses spinners and disables transforms.
- Silent success discipline: no confetti or celebratory toasts; state updates authoritatively via readback.

## Public Boundary & Contract Invariants
- Immutable limitation statement: "Assessment of this exact submitted material only; not verification of external facts."
- Public data notice: "All submitted text will be public and permanent. Do not include private information, credentials or personal records."
- Seven preserved write operations: `create_rubric`, `replace_rubric`, `lock_rubric`, `put_review`, `freeze_review`, `calibrate_review`, `retry_review`.
- Strict EIP-6963 + window discovery cardinality: only detected MetaMask, OKX Wallet, and Rabby are rendered.
