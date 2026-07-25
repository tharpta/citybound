# Kay Replacement: Parallel Simulation Core

`cb_simulation_next` is the executable migration target for replacing Kay with
standalone Bevy ECS. It deliberately does not participate in the historical
Citybound Cargo workspace yet.

## Why it is parallel

The running game still relies on Kay for actor dispatch, browser networking,
and memory-mapped saves. Replacing those responsibilities simultaneously would
make behavioral regressions and save incompatibility difficult to isolate.
Instead, each simulation subsystem moves here with tests while the Kay runtime
remains the reference implementation.

## First migrated behavior: time

The first slice mirrors `cb_time/src/actors/mod.rs`:

| Kay behavior | Bevy ECS replacement |
| --- | --- |
| `Time.current_instant` | `LogicalTick.current` resource field |
| `Time.speed` | `LogicalTick.speed` resource field |
| `Temporal::tick` broadcast | ordered temporal ECS system |
| sorted `SleeperID` deadlines | `SleepUntil` component query |
| `Sleeper::wake` dispatch | ordered wake ECS system |

The strict Kay wake condition, `deadline < current_instant`, is preserved even
though `<=` might appear more intuitive. Changing it is a gameplay decision,
not part of the framework migration.

## Run

```sh
cargo test --manifest-path cb_simulation_next/Cargo.toml
```

## Next boundary

Replace the temporary probe components with real time messages and migrate one
small production consumer. Vegetation is the preferred first consumer because
it is narrower than transport, planning, land use, or the economy.
