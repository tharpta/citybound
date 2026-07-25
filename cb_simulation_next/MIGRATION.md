# Quarantined Bevy ECS Research

`cb_simulation_next` is a historical experiment created before Citybound
Revival adopted an architecture-decision process. ADR-0001 retains it as
quarantined research and provenance evidence; it is not an approved migration
target or Kay replacement.

It deliberately does not participate in the historical Citybound Cargo
workspace or production runtime. Do not connect production code to it, migrate
another subsystem into it, or extend its dependency graph without a new
accepted ADR.

Decision record:
[ADR-0001](../docs/adr/0001-retain-quarantined-bevy-experiment.md).

## Historical probe: time

The experiment mirrors a small part of `cb_time/src/actors/mod.rs`:

| Kay behavior | Bevy ECS replacement |
| --- | --- |
| `Time.current_instant` | `LogicalTick.current` resource field |
| `Time.speed` | `LogicalTick.speed` resource field |
| `Temporal::tick` broadcast | ordered temporal ECS system |
| sorted `SleeperID` deadlines | `SleepUntil` component query |
| `Sleeper::wake` dispatch | ordered wake ECS system |

The strict Kay wake condition, `deadline < current_instant`, is preserved even
though `<=` might appear more intuitive. Changing it is a gameplay decision,
not evidence for a framework migration.

## Run

```sh
cargo test --manifest-path cb_simulation_next/Cargo.toml
```

## Quarantine boundary

There is no approved next subsystem or production consumer. The earlier
suggestion to migrate vegetation is revoked by ADR-0001. Any future proposal to
reuse this experiment must begin with a new ADR and compatibility evidence for
the affected production boundary.
