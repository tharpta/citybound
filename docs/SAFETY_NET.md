# Citybound Safety Net

This document tracks revival checks that protect behavior before larger
modernization starts.

## Current Checks

### `npm run test-compat`

Current status: passes.

This is the umbrella local safety command. It currently runs:

- `npm run test-planning-compat`
- `npm run check-browser-dist-compat`
- `npm run smoke-server-compat`
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

- Root `cargo fmt -- ./cb_planning/src/lib.rs` currently scans broader workspace
  modules and fails on pre-existing long lines in unrelated files. Use targeted
  formatting carefully until the old formatting baseline is handled separately.
- These tests intentionally use a tiny test-only `PrototypeKind` instead of
  Citybound road/zone types. That keeps the first safety net focused on generic
  planning behavior.
- The next checks should cover save startup/reload and deterministic
  `kay_auto.rs` regeneration.
- `.github/workflows/revival-compat.yml` runs the planning safety tests on
  pull requests, pushes to revival branches, and manual dispatch.
