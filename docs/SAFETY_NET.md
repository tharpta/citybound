# Citybound Safety Net

This document tracks revival checks that protect behavior before larger
modernization starts.

## Current Checks

### `npm run test-compat`

Current status: passes.

This is the umbrella local safety command. It currently runs:

- `npm run test-planning-compat`
- `npm run check-codegen-compat`
- `npm run check-browser-dist-compat`
- `npm run smoke-server-compat`
- `npm run smoke-save-reload-compat`
- `npm run smoke-browser-compat`

### `npm run check-browser-dist-compat`

Current status: passes.

This verifies that `cb_browser_ui/dist` contains the browser artifacts the
server needs to embed:

- `index.html`
- `cb_browser_ui.wasm`
- at least one JavaScript bundle
- at least one CSS bundle

### `npm run smoke-server-compat`

Current status: passes.

This verifies that `target/debug/citybound` can start with a temporary city,
serve the browser UI over HTTP, return status `200`, and shut down through the
Ctrl-C/SIGINT path.

This verifies the HTTP/server path independently of browser startup. It also
checks that the served HTML includes the configured simulation port so the
browser does not silently fall back to `9999`.

All runtime smokes use bounded child teardown. The shell smokes validate the
direct parent PID, process start token, canonical executable identity
(path plus inode/device evidence), and exact argv
before every signal; they fail closed when the host cannot prove all four.
Darwin uses `ps` plus `lsof`; Linux uses `/proc/PID/stat`,
`/proc/PID/exe`, and `ps`. Other
platforms are intentionally unsupported rather than falling back to a command
substring. POSIX has no portable pidfd-equivalent, so validation occurs
immediately before each exact-PID signal. The smokes then escalate SIGINT to
SIGTERM and SIGKILL and never wait without a deadline. A surviving child is a surfaced
failure: process state, command, cwd/executable, and listening-port diagnostics
are preserved beside the smoke log, and the disposable city is retained for
inspection rather than deleted underneath the process.

Run `npm run test-runtime-teardown-compat` for deterministic fake-child coverage
of signal escalation, timeout/identity reporting, sibling safety, and dynamic
port reuse. It also covers a deliberately surviving fake child, end-to-end
server-smoke failure propagation with diagnostics/fixture preservation, and
the shared browser SIGINT/SIGTERM cleanup coordinator through an actual
SIGTERM integration path. These tests do not launch
Citybound or Chrome.

### Runtime teardown classification

| Factor | Evidence | Classification |
| --- | --- | --- |
| Compatibility harness | Source allowed unbounded waits and incomplete escalation; deterministic fake-child tests cover the replacement | Confirmed harness reliability defect; fixed here |
| Application shutdown | Historical child printed/received prior signal attempts, but no bounded isolated reproduction is safe while it remains present | Unresolved; no root-cause claim |
| Fixture/mmap/filesystem I/O | Historical child uses a disposable mmap city and is in an uninterruptible state; no kernel wait-channel evidence identifies the blocked operation | Possible factor, not established |
| macOS/Rosetta state | Historical x86 process remains `UNE` after SIGKILL and retains its port | Confirmed uncontrollable host state; restart recovery required |

The deterministic checks are sufficient to validate controllable harness
teardown. A trustworthy real-runtime acceptance pass still requires a clean
host where the historical child and retained port are gone.

### `npm run smoke-save-reload-compat`

Current status: passes.

This starts the same temporary city twice and verifies:

- the initial boot creates the mmap save directory and core actor files
- both boots reach a running simulation and use the safe SIGINT shutdown path
- the second boot loads instead of recreating the city
- every file from the initial actor-state inventory survives reload
- startup, shutdown, or persistence regressions fail within a bounded timeout

The first run exposed a real reload crash. `ConfigFileWatcher` persisted a
process-local `notify` watcher pointer through `kay::External`; the next process
dereferenced the stale address on its first temporal tick. Its runtime handle now
lives in non-persisted thread-local state while the actor retains its historical
96-byte mmap layout.

### `npm run smoke-browser-compat`

Current status: passes.

This launches the app in a real headless Chromium process against an isolated
server and temporary city. It verifies:

- the Rust/WASM API and React app initialize
- the WebGL canvas renders at a nonzero size
- the browser receives the configured simulation port
- server and browser networking turn counters both advance
- a master-plan update crosses the actor networking boundary
- the error overlay remains hidden and no console/page errors occur

The first run exposed the retired live-build, patron, and GitHub milestone
services. Those automatic requests have been removed from the revival UI so the
local game starts cleanly without unrelated internet access.

### `npm run check-codegen-compat`

Current status: passes.

This runs the locked `kay_codegen 0.3.10` in an isolated source copy and compares
the generated path set and contents with the real checkout. All 44 committed
`kay_auto.rs` files currently regenerate byte-for-byte:

- 36 native simulation/planning/time/utility files
- 8 browser actor files

The checker uses a tiny workspace tool instead of compiling the full game. This
keeps the check focused on generated actor identity and prevents the generator
from rewriting a contributor's working tree.

### `npm run test-planning-compat`

Current status: passes.

This runs `cargo test -p cb_planning` through the macOS linker compatibility
wrapper. It ensures only the historical Rust toolchain, not the browser
`cargo-web` toolchain, so it can run as the first lightweight CI check. It
currently covers:

- deterministic `PrototypeID` generation from hashed influences
- `PlanHistory::update_for` plus `apply_update`
- `PlanResult::actions_to` grouping for destruct, morph, and construct actions

Verified output:

```text
running 3 tests
test tests::prototype_id_is_deterministic_from_influences ... ok
test tests::plan_result_actions_group_destruct_morph_and_construct ... ok
test tests::plan_history_update_can_recreate_newer_history ... ok

test result: ok. 3 passed; 0 failed
```

## Notes

- A macOS process in uninterruptible state (for example `U`/`UNE`) can remain
  after SIGKILL because the kernel has not returned from the blocked operation.
  Do not launch more probes or kill broad process sets. Preserve `ps`/`lsof`
  evidence, close unrelated work, and restart the host to recover the process
  and port. The harness cannot safely repair that OS state.

- Root `cargo fmt -- ./cb_planning/src/lib.rs` currently scans broader workspace
  modules and fails on pre-existing long lines in unrelated files. Use targeted
  formatting carefully until the old formatting baseline is handled separately.
- These tests intentionally use a tiny test-only `PrototypeKind` instead of
  Citybound road/zone types. That keeps the first safety net focused on generic
  planning behavior.
- Save smoke coverage is same-build reload coverage. We still need committed
  historical fixtures and an explicit migration policy before actor layouts can
  change.
- `.github/workflows/revival-compat.yml` runs the planning safety tests on
  pull requests, pushes to revival branches, and manual dispatch.
