# Revival Provenance Ledger

Status: initial M0 record. Classifications are provisional until the related
diff and verification evidence have been reviewed.

## Repository Lineage

- Upstream repository: `https://github.com/citybound/citybound.git`
- Revival origin: `https://github.com/tharpta/citybound.git`
- Declared original fork point: `817de55`
- Mechanically verified merge base with current `HEAD`:
  `817de551d2bc96c90d0b7c74af4872454f42b44c`
- Audit starting branch: `codex/revival-bootstrap`

The verified merge base agrees with the fork point declared in
`REVIVAL_PLAN.md`. This establishes lineage, but it does not by itself approve
the changes made after that commit.

## Provenance Layers

1. Original Citybound source through `817de55`.
2. Revival work after `817de55`.
3. New M0-controlled work beginning with the audit documents.

Generated artifacts, ignored build output, and persisted cities are not treated
as authored source without separate reproduction evidence.

## Current Working Tree At M0 Start

The working tree was clean when M0 began. Two other Codex tasks using the same
checkout were idle:

- `Citybound Revival` had completed its latest browser/save/codegen baseline
  work.
- `Evaluate Kay framework replacement` had accidentally continued long enough
  to commit the Bevy ECS experiment described below.

No running task needed to be interrupted.

## Initial Commit Ledger

| Commit | Change | Initial classification | M0 note |
| --- | --- | --- | --- |
| `8ca0a04` | Document compatibility baseline | INVESTIGATE | Verify recorded commands and host claims. |
| `7d3a5e0` | Map core architecture | INVESTIGATE | Compare map against original source. |
| `2bfd7d0` | Add planning safety tests | INVESTIGATE | Review behavioral assumptions and test isolation. |
| `689476f` | Add compatibility smoke checks | INVESTIGATE | Audit mutation and cleanup behavior. |
| `066dea6` | Add planning compatibility CI | INVESTIGATE | Verify reproducibility and pinning. |
| `cf6cd6f` | Document toolchain modernization strategy | INVESTIGATE | Reassess after dependency audit. |
| `423678b` | Document local revival workflow | INVESTIGATE | Re-run commands from a clean state. |
| `4f47072` | Template browser simulation port | INVESTIGATE | Verify browser/server behavior and security assumptions. |
| `02e4e26` | Document observability baseline | INVESTIGATE | Compare claims to runtime evidence. |
| `e3080fd` | Define gameplay readiness gate | REVISE | Pre-dates M0 and assumes revival work is trusted. |
| `3288fb3` | Add real browser compatibility smoke | INVESTIGATE | Review browser dependency, lifecycle, and assertions. |
| `69fd4c9` | Define engine ownership strategy | INVESTIGATE | Treat as a proposal until dependency review completes. |
| `df3d40e` | Verify generated actor glue | INVESTIGATE | Re-run without accepting source churn. |
| `7d7172f` | Add save reload compatibility smoke | INVESTIGATE | Determine what persistence guarantees it actually proves. |
| `2ee0db7` | Start Bevy ECS simulation core | INVESTIGATE / QUARANTINED | Accidental implementation before an approved replacement decision. Do not extend during M0. |

## Next Evidence

- Review each post-fork diff and update its classification.
- Inventory compatibility-script mutations and cleanup guarantees.
- Inventory Cargo/npm dependency sources, licenses, maintenance, and advisories.
- Run the game visibly and record a factual gameplay/runtime baseline.
- Verify generated code and save/reload claims independently.
