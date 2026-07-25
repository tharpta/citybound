# M0 Codegen And Persistence Audit

GitHub issue: <https://github.com/tharpta/citybound/issues/6>

Status: REVIEW

Evidence date: 2026-07-24 America/Los_Angeles

Audited commit: `48fd9dd285d95b293fa72baa66d5fdcc6e36d95f`

## Evidence Snapshot

The audit was run in the isolated `issue-6-persistence` worktree on
`codex/issue-6-codegen-persistence`. At the start of the audit, local `HEAD`,
the local remote-tracking ref, and the pushed branch all resolved to accepted
integration commit `48fd9dd`.

### Codegen

`CITYBOUND_CODEGEN_CHECK_ROOT=/tmp/citybound-issue6-codegen-check npm run
check-codegen-compat` passed under the pinned
`nightly-2020-03-10-x86_64-apple-darwin` toolchain:

```text
Codegen compatibility passed: 44 kay_auto.rs files regenerated identically.
```

The configured check root contained no spaces. The script copied source there,
regenerated the files, compared the sorted path set, required exactly 44 files,
and compared every file byte-for-byte. The ticket worktree remained clean.

Two independent fork-point checks also passed:

- both `817de551d2bc96c90d0b7c74af4872454f42b44c` and `48fd9dd` contain
  exactly 44 tracked `kay_auto.rs` paths
- `git diff --exit-code 817de55 48fd9dd -- ':(glob)**/kay_auto.rs'` reported no
  path or content change
- per-file SHA-256 inventories from the two commits were identical; the
  SHA-256 of the current inventory was
  `9149a685e082d4ca1bc55a11ab681d9d5ca640078d23d6391c941f846ed2ee57`

These checks prove current generated-source reproducibility and no committed
generated-glue drift from the original fork point. They do not prove that
handwritten setup order, actor definitions, dependency behavior, or future
compiler/codegen output preserves persistence compatibility.

### Native build and same-binary reload

The browser prerequisite was built with `npm run build-browser-compat` in its
no-spaces compatibility copy. `npm run build-server-debug-compat` then built
the native server from the audited commit through the trusted compatibility
path. The embedded version was `v0.1.2-864-g48fd9dd`.

`npm run smoke-save-reload-compat` passed:

```text
Save reload smoke passed: 260 files created, 261 present after reload.
```

The debug binary's SHA-256 was identical immediately before and after the
command:

```text
b5bbf3dc861161d20b73fd29add68b45bbaceb1d1633fe4bea7209af99026e99
```

The script runs `target/debug/citybound` twice against the same temporary city,
sends `SIGINT` each time, requires a zero exit within ten seconds, and requires
both `Simulation running.` and `Stopping Citybound safely...` in each log. It
also requires the first run to report creation, the second not to report
creation, `Time_n` and `PlanManager(CBPlanningLogic)_n` to exist, at least 20
files after the first run, and no first-run path to disappear after reload.

A separate preserved-log replay with the same binary directly observed:

```text
initial: Savegame folder ... not found, creating...
initial: Stopping Citybound safely...
reload:  Loading from savegame ...
reload:  Stopping Citybound safely...
first file count: 259
second file count: 260
missing first-run paths after reload: 0
version marker: v0.1.2-864-g48fd9dd
```

The one-file count difference between the scripted run and the direct replay is
further evidence that timing-dependent file counts are not semantic state.

## Actor And Trait Registration

Locked `kay 0.5.1` source uses separate in-memory `TypeRegistry` instances for
actor/trait recipient types and message types. Each registry starts at short ID
1 and assigns the next `u16` ID on the first `get_or_register` call. Therefore:

- actor and trait numeric IDs depend on first-registration order
- message numeric IDs depend on first-registration order in the separate
  message registry
- `register_implementor` records the already-assigned actor ID under a trait ID
- persisted `RawID` values contain the short actor/trait type ID, and queued
  messages contain the short message type ID

The server calls `cb_simulation::setup_common`, whose handwritten order begins
with time, logging, planning, construction, transport, economy, land use, and
environment setup. Those setup functions mix handwritten `system.register`
calls with generated `auto_setup` calls. The generated files define ID
wrappers, trait representatives, messages, handlers, spawners, trait
registration, and implementor mappings, but they do not own the complete
cross-module setup order.

Consequently, byte-identical `kay_auto.rs` output protects the generated portion
of the registration sequence only. A handwritten setup reorder, new early
registration, changed generic instantiation, or changed locked Kay behavior can
renumber types or messages without changing a generated file. No committed
actor/message registration manifest is compared by the current checks.

## Version Marker Behavior

`cb_server/main.rs` treats `__cb_version.txt` as follows:

1. If `read_to_string` succeeds, it reports loading and compares the complete
   marker text with the binary's build description.
2. If the strings differ, it prints `POTENTIALLY INCOMPATIBLE SAVEGAME!` and
   continues.
3. If the read fails for any reason, it reports the save as not found, creates
   the directory if needed, writes the current build description, and takes the
   new-city spawn path.
4. It opens `ActorSystem::new_mmap_persisted`, registers current types, and
   either constructs the global `Time` ID for the load path or spawns a new
   city.

The marker is advisory build identity, not a persistence schema version. A
mismatch does not refuse, migrate, import, validate, or rewrite a save. The
load path constructs the expected global `Time` ID; it does not first prove
that a corresponding persisted instance exists.

There is also a source-evidenced risk when an existing city directory has a
missing or unreadable marker: the server takes the new-city path while opening
the existing mmap directory. This audit did not exercise that destructive
case.

## Mmap Representation And Layout Risks

Locked `kay 0.5.1` derives each actor class's storage prefix from Rust
`type_name`, strips module prefixes, and rewrites generic angle brackets to
parentheses. That explains paths such as `Time_*`,
`PlanManager(CBPlanningLogic)_*`, and
`Construction(CBPrototypeKind)_*`.

Locked `chunky 0.3.7` maps each identifier directly to a file. Its persisted
values, vectors, queues, arenas, and multi-arenas cast mapped bytes to the
current Rust types and use current `size_of` values and collection metadata.
Kay compacts actor state directly into those arena bins. Existing value files
are opened without a schema/layout header or a check that their length matches
the current type size.

Evidence therefore bounds these compatibility risks:

- actor type-name or generic-name changes can select different storage paths
- actor, `RawID`, slot-map, queue-state, or message layout changes can cause
  existing bytes to be interpreted under a different current layout
- changed base/typical sizes or compact dynamic representation can change bin
  selection and offsets
- changed registration order can change short IDs embedded in actor state and
  queued messages even when actor-named file paths remain unchanged

The audit does not claim that every source change in these areas breaks every
save. It establishes that the current format has no independent schema metadata
or migration layer to make such changes safe by construction.

## Precisely Bounded Smoke Claim

The current save/reload evidence proves only that, for a freshly created
temporary city:

- the audited native binary reaches a running simulation
- `SIGINT` reaches the logged safe-shutdown path and the process exits zero
- that exact binary can reopen the same city directory
- the version marker records the embedded build description
- expected core actor-store paths exist
- the first-run path inventory is not reduced on the second run

It does not inspect persisted values or compare actor counts. It does not prove
that a road, zone, building, household, vehicle, plan, construction state, or
simulation time survives with the same meaning. It also does not prove
compatibility with an original Citybound save, an earlier revival build, a
future build, another compiler/target, or any changed layout/registration
sequence.

## Semantic Fixture Contract

Semantic persistence remains explicitly unproven and is tracked by existing
bug #8: <https://github.com/tharpta/citybound/issues/8>. No duplicate fixture
ticket was created.

A future fixture should:

1. Start a new city from a clean-current compatibility build.
2. Record stable identifiers and semantic counts before player actions.
3. Create and implement a deterministic road and residential zone.
4. Wait until construction completes.
5. Record semantic planning, lane, lot, building, household, vehicle, and time
   state.
6. Shut down through the supported graceful path.
7. Reload with the same binary and compare that semantic state.
8. Separately test any intentionally changed build only after a compatibility
   policy is accepted.

Browser pixels and mmap path counts alone are insufficient. A narrow debug
export or test-only query should expose stable domain state without teaching
the test to decode raw mmap bytes.

Implementing that export/fixture, reproducing the visible road loss, and
diagnosing persistence versus construction, replication, or rendering remain
in #8, not #6.

## Compatibility Expectations And Decision Gate

- Original Citybound saves: `UNKNOWN`; no compatibility promise is supported by
  this evidence.
- Saves from the audited revival build: same-binary structural reload
  `PROVEN`; semantic persistence and cross-build compatibility `UNPROVEN`.
- Future modernized saves: expectations remain `UNDECIDED` until an explicit
  schema, identity, and migration/import policy is accepted.

This audit does not choose warn, refuse, migrate, or import behavior and does
not change actor IDs, layouts, or persistence formats. Those are
hard-to-reverse persistence decisions and require the repository's ADR gate
before implementation.

## Follow-Ups

- Semantic road/zone/building/household/vehicle persistence: #8.
- Deterministic linker-wrapper scratch leak discovered while producing this
  evidence: #31. The 342 validated `citybound-rmeta-linker.*` directories
  occupied 4.9 GiB and caused `No space left on device`; they were removed so
  the audit could continue. The cleanup fix is intentionally outside #6.
