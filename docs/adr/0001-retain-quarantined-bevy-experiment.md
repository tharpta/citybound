# ADR-0001: Retain The Bevy Experiment Without Adopting It

- Status: Accepted
- Date: 2026-07-24
- Decision owners: Product owner; integration/technical lead
- Reviewers: M0 provenance and architecture review
- Decision issue: [#7](https://github.com/tharpta/citybound/issues/7)
- Implementation: experiment commit
  [`2ee0db7`](https://github.com/tharpta/citybound/commit/2ee0db7);
  ADR workflow [#16](https://github.com/tharpta/citybound/issues/16);
  implementation [PR #24](https://github.com/tharpta/citybound/pull/24)
- Supersedes: None
- Superseded by: None

## Context And Evidence

Commit `2ee0db7` was created accidentally before the revival had approved a
simulation-framework replacement. It adds the standalone `cb_simulation_next`
workspace, Bevy ECS 0.19, a logical-time implementation, and focused time tests.
The [provenance audit](../audit/PROVENANCE.md) therefore classifies it as
`INVESTIGATE / QUARANTINED`.

The experiment preserves the old strict sleeper deadline comparison and shows
that one small behavior can be expressed in ECS. It does not implement or
validate Kay actor identity, generated messages, browser networking,
memory-mapped persistence, save migration, planning, transport, land use, or
the economy. Meanwhile, the compatibility runtime has browser networking and
same-build save/reload smoke coverage documented in
[the safety net](../SAFETY_NET.md).

Inference: adopting Bevy from this probe would turn an isolated experiment into
a whole-engine migration without evidence that Citybound's critical
compatibility contracts can be preserved.

## Decision Boundary

This ADR decides only the disposition of `cb_simulation_next` and whether it is
an approved replacement path for Kay.

It does not choose Kay's permanent future, authorize production code to depend
on Bevy, change actor or message identity, alter saves or networking, or approve
another simulation-framework experiment.

## Decision

Retain `cb_simulation_next` in the repository as quarantined research and
provenance evidence. Do not adopt it as the revival architecture, connect it to
the production workspace/runtime, migrate another subsystem into it, or extend
its dependency graph.

The compatibility runtime remains authoritative. Any future proposal to replace
Kay or reuse this experiment requires a new ADR supported by behavioral
fixtures for the affected production boundary.

## Alternatives Considered

- **Adopt and extend Bevy now.** Rejected because the probe covers only logical
  time and supplies no actor-ID, codegen, networking, browser, or persistence
  migration evidence.
- **Delete or revert the experiment immediately.** Rejected because retaining a
  standalone, unused workspace has no production-runtime impact and preserves
  the provenance of work already committed. Deletion can occur later through a
  scoped cleanup issue.
- **Retain and quarantine it.** Selected because it preserves evidence without
  allowing an accidental implementation to dictate architecture.

## Compatibility Impact

- Existing saves and mmap layouts: none; the experiment remains standalone.
- Actor identity, generated glue, and messages: none; production continues to
  use Kay and committed `kay_auto.rs`.
- Network and browser behavior: none; the server and WASM client do not depend
  on `cb_simulation_next`.
- Build and tooling: the historical workspace remains unchanged. The separate
  `npm run test-simulation-next` command may test the experiment explicitly,
  but it is not part of `build-compat` or `test-compat`.
- Dependencies: Bevy remains confined to `cb_simulation_next/Cargo.lock`.

These statements remain true only while the quarantine boundary is preserved.

## Migration And Verification

There is no production migration.

Closure verification for issue #7 must confirm:

1. `cb_simulation_next` remains a standalone workspace.
2. Production manifests and runtime code do not depend on it or Bevy.
3. Compatibility build, browser, network, codegen, and save checks remain
   authoritative.
4. No follow-on subsystem was migrated into the experiment.

A future replacement proposal must link a new ADR and staged issues covering
actor identity, deterministic codegen, network protocol, save migration,
browser integration, and behavior fixtures before production adoption.

## Rollback

Because this decision changes no production runtime, rollback means superseding
this ADR. If retention becomes a maintenance or security burden, a scoped issue
may remove `cb_simulation_next`, its lockfile, and
`test-simulation-next`. Git history preserves the experiment.

No Citybound save is created by this decision, so rollback has no data-migration
step.

## Cost

- Implementation: no additional migration work.
- Maintenance: small repository and dependency-audit surface while retained.
- Operational/performance/storage: no runtime cost; repository size includes
  the separate Bevy lockfile and source.
- Monetary: none. No service, runner, license, or paid dependency is approved.
- Opportunity cost: the experiment receives no continued engineering capacity
  unless a future ADR authorizes it.

## Consequences And Follow-ups

The production architecture remains coherent while the experiment remains
available for comparison. The drawback is carrying visibly non-production code,
mitigated by its standalone workspace, explicit documentation, and quarantine.

Issue #7 may close after independent verification of this record. Reconsidering
Kay remains a separate future architecture decision, not an implicit follow-up
to the experiment.

## Review Record

- Product-owner decision: the user requested that accidental revival work be
  audited before it influences the game architecture.
- Technical review: M0 evidence does not support Bevy adoption.
- Independent verification: required on the issue #16 pull request.
- Accepted integration commit: Pending merge of
  [PR #24](https://github.com/tharpta/citybound/pull/24).
