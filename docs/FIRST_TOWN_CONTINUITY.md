# Same-version first-town continuity

Issue: <https://github.com/tharpta/citybound/issues/41>

Risk lane: HIGH-RISK. Accepted starting commit:
`f804d15c4c6ab4b713c7c8a2422b3e94a9c61fcc`.
This check changes test tooling only. It does not change actor definitions,
registration order, generated actor glue, dependencies, or save representation.

## Bounded fixture

Build with the pinned nightly explicitly selected (the default-selection defect
is tracked separately by [#68](https://github.com/tharpta/citybound/issues/68)):

```sh
RUSTUP_TOOLCHAIN=nightly-2020-03-10-x86_64-apple-darwin \
  CITYBOUND_ALLOW_LEGACY_LIFECYCLE=1 npm run build-compat
```

Then run:

```sh
npm run test-first-town-continuity
npm run smoke-first-town-continuity-compat
```

The smoke extends the existing FamilyHouse/first-town probe. In a fresh,
probe-owned disposable city it implements the existing connected-town road
skeleton: one lane in each direction from `[-320, -300]` to `[-220, -300]`,
joined to a perpendicular road from `[-220, -400]` to `[-220, -200]`, then a
Residential polygon with corners
`[-300, -300]`, `[-240, -300]`, `[-240, -240]`, `[-300, -240]`.
It uses the same exported Rust planning commands as the UI and lets normal
immigration/development create occupied FamilyHouses at the UI's 32x speed.
The older 10x setup can reach its wall-clock limit before a local dwelling
develops; this probe does not retry or inject a household when that happens. It never injects actors
or edits mmap bytes. Development has a 90-second deadline; individual browser
waits default to 30 seconds and startup to 20 seconds. The caller should also
apply a whole-command deadline (acceptance uses 240 seconds).

The probe pauses and waits for the server's speed acknowledgement and refreshed
browser projections, then records:

- all three implemented road/zone master-plan gestures;
- canonical constructed road triangles and Residential fill/outline triangles;
- every developed FamilyHouse's ID, style, position, resident IDs, and wall,
  roof, and fence triangles;
- each resident's exposed household core, including resources and member tasks;
- exact simulation ticks, clock time, and paused speed.

It compares that state after a fresh page and after clean SIGINT shutdown plus
same-binary server restart. It checks the normal Town activity counts, building
focus, household inspector, absence of an active/dummy planning project, and
browser errors through existing probes. Finally it resumes at 4x and requires
increasing authoritative ticks, a changed visible clock minute, and changed
resident member resources through the household protocol, records
the advanced state/screenshot, and safely stops again.

Triangle canonicalization ignores batch order and cyclic vertex reindexing but
preserves winding, position, and duplicate counts. Household comparisons include
the existing UI protocol's decision-state serialization workaround; they do not
prove raw mmap byte equality or hidden actor fields.

## Evidence and recovery

Every continuity run prints its unique `citybound-first-town-continuity-*`
directory outside the checkout. `city/` is the disposable save. `manifest.json`
records the accepted baseline, source HEAD, exact native binary and browser-asset SHA-256 digests, city path, and
last safe phase. Semantic snapshots, screenshots, and server logs stay beside
it; none belong in git. A failure writes `failure.json` with its stack and
bounded server-log tail, plus a screenshot and the available browser time,
networking, planning, building, and household state. Successful fixtures are retained too.

To exercise a failed harness run after the first clean save:

```sh
CITYBOUND_CONTINUITY_FAIL_AFTER_SAVE=1 npm run smoke-first-town-continuity-compat
```

This command must exit nonzero. With the *same binary*, use the printed path:

```sh
CITYBOUND_CONTINUITY_RECOVERY_DIR=/absolute/path/from/failed/run \
  npm run smoke-first-town-continuity-compat
```

The injected-failure/recovery path is available for a future dedicated drill;
it is not part of the bounded acceptance pass and has not yet been exercised
end to end. Do not treat its presence as a passing recovery result.

Recovery accepts only a probe manifest at the safe-first-shutdown phase, the
recorded `city/` path, and identical native/browser digests. It does not recreate the
fixture: it reloads and compares the retained pre-failure town, repeats the
restart check, and proves time advances. The original `failure.json` remains
available after recovery. Arbitrary user save paths are rejected by the reload
probe.

Rollback is to stop the probe, retain its evidence, and discard only its
probe-owned disposable city when no process is using it. Code rollback is to
return to the accepted commit in a separate worktree. Never open a user save or
this disposable save with a different build as a rollback test. A teardown that
cannot stop its child is a host-recovery failure; do not launch more runtime
probes until it is resolved.

## Claim boundary

This is a same-native-binary, same-browser-build continuity check for one bounded
residential fixture. It makes no cross-version, historical-save, migration,
crash-consistency, power-loss, arbitrary-town, hidden-state, or long-run economy
claim. Any actor identity/layout or save-format change requires a separate
compatibility decision before implementation.
