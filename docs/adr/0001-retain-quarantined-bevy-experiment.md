# ADR-0001: Retain The Bevy Experiment Without Adopting It

- Status: Accepted
- Date: 2026-07-24
- Evidence audit: 2026-07-24 America/Los_Angeles
- Decision owners: Product owner; integration/technical lead
- Reviewers: M0 provenance and architecture review; issue #7 independent
  verification pending
- Decision issue: [#7](https://github.com/tharpta/citybound/issues/7)
- Implementation: experiment commit
  [`2ee0db7`](https://github.com/tharpta/citybound/commit/2ee0db7), parent
  [`7d7172f`](https://github.com/tharpta/citybound/commit/7d7172f);
  ADR workflow [#16](https://github.com/tharpta/citybound/issues/16);
  quarantine implementation [PR #24](https://github.com/tharpta/citybound/pull/24);
  issue #7 evidence update
  [PR #35](https://github.com/tharpta/citybound/pull/35)
- Supersedes: None
- Superseded by: None

## Context And Evidence

Commit `2ee0db7` was created accidentally before the revival had approved a
simulation-framework replacement. Its parent is `7d7172f`. The complete commit
adds 1,182 lines in six paths:

- a 941-line standalone `Cargo.lock`
- a 12-line manifest with a nested `[workspace]` and only `bevy_ecs = "0.19.0"`
- a 9-line library root and a 178-line logical-time module
- a 41-line migration note
- one root package script that invokes the standalone tests

The [provenance audit](../audit/PROVENANCE.md) therefore classified the commit
as `INVESTIGATE / QUARANTINED`. PR #24 later removed its active migration
language and integrated the quarantine decision as commit `9a7b4bd`.

### What The Probe Implements

The authored runtime surface is one in-memory Bevy `World`, one ordered
`Schedule`, and five data types:

- `LogicalTick { current: u64, speed: u16 }` is a resource.
- `TemporalProbe` counts ticks and records the last numeric instant.
- `SleepUntil(u64)` is a deadline component.
- `WakeProbe` counts wakes and records the last numeric instant.
- `NextSimulation` owns the world and chains `tick_temporals`,
  `wake_sleepers`, then `advance_clock`.

`progress_frame` runs that schedule `speed` times. The wake system preserves
Kay's strict `deadline < current` comparison and removes `SleepUntil` after one
wake. Three unit tests cover speed `3`, a single strict-deadline wake, and speed
`0`. On the audited base `bcd850b`, all three pass with the locked graph on
stable Rust 1.97.0.

This proves only that the selected tick count and strict comparison can be
represented in this small ECS schedule. The probes are not production
`Temporal` or `Sleeper` implementations, and no Citybound subsystem calls the
crate.

### What The Probe Omits

Compared with `cb_time`, Kay, the server, and the browser client, it has no:

- `Instant`, `Ticks`, `Duration`, or `dt = 1 / TICKS_PER_SIM_SECOND` domain
  behavior
- `TimeID`, global actor identity, `TemporalID`, `SleeperID`, or `RawID`
- `wake_up_in` API, sorted sleeper collection, typed sleeper target, or coverage
  for multiple sleepers and equal deadlines
- actor mailbox, global broadcast, queued message, handler, spawner, or
  message-processing semantics
- real planning, transport, land-use, economy, vegetation, or browser consumer
- network machine identity, message serialization, replication, turn
  synchronization, or reconnect behavior
- `Compact` representation, `CVec`, mmap actor storage, save version, importer,
  migration, or reload path
- generated `kay_auto.rs` output, registration order, trait/implementor mapping,
  or actor/message type-ID manifest
- Rust-WASM entry point, `stdweb`/JavaScript bridge, browser actor system, React
  state update, Monet/WebGL renderer payload, or browser build

The ECS systems also mutate probes directly. That is not evidence that Kay's
queued broadcast and wake messages have equivalent ordering or failure
behavior.

### Existing M0 Evidence

The compatibility runtime has stronger evidence at the boundaries the probe
omits:

- [the codegen/persistence audit](../audit/CODEGEN_PERSISTENCE.md) proves all 44
  committed `kay_auto.rs` files regenerate byte-for-byte and that the same
  native binary can structurally reopen a freshly created mmap save
- that audit also establishes that actor and message short IDs depend on
  registration order, mmap state has no independent schema/layout header, and
  semantic and cross-build save compatibility remain unproven
- [the safety net](../SAFETY_NET.md) records an end-to-end browser smoke in
  which the Rust/WASM client starts, network turns advance, and a master-plan
  update crosses the actor network boundary
- [the browser audit](../audit/BROWSER_DEPENDENCIES.md) establishes that the
  `stdweb`/cargo-web/Parcel path is a coupled compatibility boundary
- [the dependency audit](../audit/RUST_DEPENDENCIES.md) places storage and Kay
  modernization before the browser boundary

Inference: adopting Bevy from this probe would turn an isolated time comparison
into a storage, identity, messaging, network, browser, and renderer migration
without evidence that any of those compatibility contracts can be preserved.

## Decision Boundary

This ADR decides only the disposition of `cb_simulation_next` and whether it is
an approved replacement path for Kay.

It does not choose Kay's permanent future, authorize production code to depend
on Bevy, change actor or message identity, alter saves or networking, or approve
another simulation-framework experiment.

## Decision

Select **retain isolated research**. Keep `cb_simulation_next` in the repository
as quarantined provenance and comparison evidence. Do not adopt it as the
revival architecture, connect it to the production workspace/runtime, migrate
another subsystem into it, or extend its dependency graph.

The compatibility runtime remains authoritative. Any future proposal to replace
Kay or reuse this experiment requires a new ADR supported by behavioral
fixtures for every affected production boundary. This decision authorizes no
implementation follow-up and no future spike.

### Decision Drivers

1. Preserve provenance without allowing accidental code to choose architecture.
2. Protect save layout and identity while semantic persistence is still
   unproven.
3. Preserve the working Kay network/browser path until a replacement can prove
   the same observable contracts.
4. Avoid coupling the historical runtime to a second Rust toolchain and
   dependency graph during M0.
5. Prefer the reversible state: isolation has no production data effect, and
   later removal is a small repository cleanup.

## Alternatives Considered

- **Retain isolated research. Selected.** It preserves the exact experiment and
  its negative evidence while production remains unchanged.
- **Authorize a future bounded spike. Not authorized now.** A bounded spike
  could answer a specific question after the existing semantic save fixture and
  identity/network/browser contracts exist. The current probe has no such
  question, prerequisite evidence, production-safe adapter, or exit criterion.
  Authorization would be premature, not a conclusion about Bevy's general
  suitability.
- **Revise as an approved proposal. Rejected.** Renaming probe components or
  adding a migration plan would not supply identity, persistence, network, or
  browser compatibility. Approval would misstate the evidence.
- **Revert or remove. Rejected for now.** Removal would reduce maintenance and
  dependency-audit surface, but isolation already prevents runtime impact and
  retention preserves provenance. If that carrying cost becomes material,
  deletion remains the concrete rollback.

## Compatibility Impact

- Existing saves and mmap layouts: no change while isolated. The experiment has
  no persistence and produces no Citybound save. Its Bevy components and entity
  identities are not compatible representations of Kay mmap actors.
- Actor identity, generated glue, and messages: no change while isolated.
  Production continues to use Kay and committed `kay_auto.rs`. A Bevy `Entity`
  cannot be assumed to preserve Kay's registration-ordered actor/trait IDs,
  message IDs, or `RawID` values.
- Network replication: no change while isolated. The experiment defines no
  protocol, message serialization, machine ID, or network-turn behavior.
- Rust-WASM, browser replication, and rendering: no change while isolated. The
  server and WASM client both still register the shared Kay model, and the
  browser-only actors and renderer bridge have no experiment counterpart.
- Build and tooling: the historical workspace remains unchanged. The separate
  `npm run test-simulation-next` command may test the experiment explicitly,
  but it is not part of `build-compat` or `test-compat`.
- Dependencies and toolchains: Bevy remains confined to
  `cb_simulation_next/Cargo.lock`. Its package manifest uses edition 2024;
  locked `bevy_ecs 0.19.0` declares Rust 1.95.0; and the standalone locked
  resolution contains 101 packages. Production compatibility remains on the
  2020 nightly/Rust 1.43-era track. Combining them would be a toolchain and
  dependency migration, not a workspace edit.

These statements remain true only while the quarantine boundary is preserved.
No claim about Bevy's current popularity, feature set, or general quality drives
this decision; the missing Citybound contracts do.

## Prerequisites For Any Future Proposal

There is no production migration and no implementation follow-up from this
decision. Before a future issue may request a bounded spike or replacement ADR,
it must:

1. Name one decision question, affected boundary, time/size bound, exit
   criterion, and production non-interference rule.
2. Start from the accepted compatibility runtime and preserve its checks as the
   reference.
3. Complete or explicitly depend on a semantic save fixture, not only mmap file
   counts.
4. Inventory the actor/trait/message IDs and handwritten/generated registration
   order that the spike would preserve or deliberately version.
5. Define save identity, layout, migration/import/refusal behavior, and the last
   safe rollback point before writing a new format.
6. Define the server/browser message protocol, turn behavior, reconnect
   behavior, Rust-WASM boundary, and renderer-facing contract.
7. Keep the spike isolated from production manifests and saves until an
   independently reviewed ADR accepts a migration.

These are authorization gates, not an approved backlog.

## Verification

Issue #7 closure verification consists of:

1. `git show`, parent, and complete diff inspection for `2ee0db7`.
2. `cargo +stable test --locked --manifest-path
   cb_simulation_next/Cargo.toml`: 3 passed, 0 failed.
3. Separate locked metadata inspection confirming the nested workspace,
   `bevy_ecs 0.19.0`, its Rust requirement, and the 101-package resolution.
4. Root metadata and manifest/source searches confirming no production crate,
   server, browser, or generated actor file depends on `cb_simulation_next` or
   Bevy.
5. Comparison against Kay time, server boot, browser boot, codegen/persistence,
   dependency, and browser audit evidence.
6. Final diff and whitespace review confirming that issue #7 changes evidence
   only.

The hosted PR checks remain the independent repository-level verification for
this evidence update.

## Rollback

The last safe point is the current quarantine: no production manifest, runtime,
network protocol, or save depends on the experiment.

If retention becomes a maintenance, security, or dependency-audit burden,
rollback is a scoped change that removes the `cb_simulation_next/` directory and
the root `test-simulation-next` package script, then verifies production
manifests and compatibility checks are unchanged. Git history preserves the
experiment. No Citybound save is created by this decision, so rollback has no
data-migration step.

Changing the architectural decision itself requires a superseding ADR. Once any
future implementation writes a new save format or changes the protocol, this
simple rollback no longer applies; that future ADR must define data treatment.

## Cost

- Implementation: no additional migration work.
- Maintenance: a small but real test, lockfile, and dependency-audit surface
  while retained.
- Operational/performance/storage: no production runtime or save cost. Local or
  hosted execution of the optional test compiles the separate dependency graph.
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

- Product-owner decision: accidental revival work must be audited before it
  influences the architecture; the Producer authorized issue #7 for the final
  M0 disposition audit.
- Technical review: the experiment implements a three-test time probe but none
  of the identity, save, network, codegen, browser, or renderer contracts needed
  for adoption. Retain isolated research; authorize no spike or migration.
- Independent verification: PR #24 independently verified the initial
  quarantine. A separate visible read-only reviewer must verify this issue #7
  evidence update in [PR #35](https://github.com/tharpta/citybound/pull/35)
  before integration.
- Accepted quarantine integration commit:
  [`9a7b4bd`](https://github.com/tharpta/citybound/commit/9a7b4bd).
- Issue #7 evidence integration commit: Pending review and merge.
