# M0 Codegen And Persistence Audit

GitHub issue: <https://github.com/tharpta/citybound/issues/6>

Status: ACTIVE

## Generated Actor Glue

- The repository contains 44 committed `kay_auto.rs` files.
- The revival codegen check copies source to an isolated directory, regenerates
  those files, compares the path set, and requires byte-for-byte equality.
- No `kay_auto.rs` file differs between original fork point `817de55` and the
  current branch.
- Generated files define actor ID wrappers, trait IDs, message structures,
  handler registration, spawners, and trait-implementor mappings.

Provisional conclusion: committed actor glue has remained stable through the
revival and can currently be regenerated identically. This does not prove that a
future codegen/compiler change preserves numeric actor/trait identity unless the
result and registration mapping remain byte-for-byte stable.

## Persistence Startup

The native server:

1. Reads `__cb_version.txt` if present.
2. Prints `POTENTIALLY INCOMPATIBLE SAVEGAME!` when it differs.
3. Opens `kay::ActorSystem::new_mmap_persisted` on the city directory.
4. Registers current actor types through `cb_simulation::setup_common`.
5. Finds the persisted global `Time` actor, or spawns a new city.

The version marker is advisory only. It does not:

- refuse an incompatible save
- migrate a save
- record a schema version separate from the build description
- verify actor registration/type layout compatibility

## Save Representation

The temporary M0 city contains actor-type-named mmap files for instances,
inboxes, slot entries, free lists, version lists, and bin sizes. Examples include
`Lane_*`, `Building_*`, `Construction(CBPrototypeKind)_*`, and
`PlanManager(CBPlanningLogic)_*`.

This makes at least the following part of the compatibility contract:

- registered actor type names and ordering/IDs
- actor and message memory layouts
- `compact`/`chunky` allocation and collection representation
- generic type names used in storage paths
- graceful message processing and shutdown behavior

## What Existing Checks Prove

The codegen smoke proves reproducible generated source under its historical
toolchain and copied source tree.

The save/reload smoke proves:

- a new actor store is created
- the same binary can reopen it after graceful shutdown
- expected core files exist
- initial storage paths do not disappear

It does not prove semantic persistence of a road, zone, building, household,
vehicle, plan, or construction state.

## Runtime Counterexample

During the visible M0 run, an implemented road rendered before a graceful
shutdown but was absent after loading the same city. The binary was stale
relative to source, so the result must be reproduced on a clean-current build,
but it demonstrates why path-count assertions are insufficient.

Bug: <https://github.com/tharpta/citybound/issues/8>

## Required Semantic Fixture

A trustworthy fixture should:

1. Start a new city from a clean-current compatibility build.
2. Record stable identifiers and observable counts before player actions.
3. Create and implement a deterministic road and residential zone.
4. Wait until construction completes.
5. Record semantic state for planning, lanes, lots, buildings, and time.
6. Shut down through the supported graceful path.
7. Reload with the same binary and compare semantic state.
8. Later repeat against an intentionally changed build to exercise version
   refusal or migration.

Browser pixels alone are not sufficient. Add a narrow debug export or
test-only query that reports stable domain state without decoding mmap bytes in
the test.

## Provisional Compatibility Policy

- Original Citybound saves: UNKNOWN; preserve samples if available, but make no
  compatibility promise yet.
- Saves from the current revival compatibility build: EXPERIMENTAL until the
  semantic fixture passes.
- Future modernized saves: require an explicit schema version, migration policy,
  and stable domain IDs independent of raw ECS/actor storage.
- Any change to generated actor glue, registration order, compact layout, or
  storage crates is save-breaking until proven otherwise.

## Exit Work

- Independently rerun the codegen check and confirm the checkout stays clean.
- Rebuild a clean-current binary through the trusted compatibility path.
- Reproduce or disprove issue #8.
- Add the semantic fixture/export.
- Decide whether incompatible saves warn, refuse, migrate, or import.
