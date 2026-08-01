# M0 Runtime Baseline

GitHub issue: <https://github.com/tharpta/citybound/issues/5>

Status: READY FOR REVIEW

## Clean-Current Run Context

- Date: 2026-08-01 (America/Los_Angeles)
- Branch: `codex/issue-5-current-runtime-baseline`
- Tested source commit: `012429715b6ce4703e04d7fa6ef1f3e3a845ed16`
- Accepted integration included:
  `456095abe88c0fa2e0855b2f3f915b4a8370f86c`
- Audited build command:
  `CITYBOUND_ALLOW_LEGACY_LIFECYCLE=1 npm run build-compat`
- Built identity: `Citybound v0.1.2-883-g0124297`
- Server command:
  `target/debug/citybound --mode local --bind 127.0.0.1:43330 --bind-sim 127.0.0.1:43331 /private/tmp/citybound-issue-5-0124297/city`
- City: newly created temporary city, then reloaded from the same path
- Browser: visible Google Chrome through the connected extension
- Evidence root: `/private/tmp/citybound-issue-5-0124297/`

The audited compatibility build completed the historical Rust/WASM release
build, Parcel bundle, browser artifact copy-back, and native debug server build.
Root `npm ci --ignore-scripts` was required once for the documented
`playwright-core` smoke-test prerequisite. No paid service or hosted build was
used.

## Build And Automated Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Compatibility build | WORKS | `CITYBOUND_ALLOW_LEGACY_LIFECYCLE=1 npm run build-compat` passed. |
| Built identity | WORKS | Browser About panel, server output, `.version`, and the save's `__cb_version.txt` report `v0.1.2-883-g0124297`. |
| Legacy install containment | WORKS | `npm run test-legacy-install-containment` passed. |
| Linker-wrapper regression | WORKS | `npm run test-linker-wrapper-compat` passed. |
| Full compatibility suite | WORKS | `npm run test-compat` passed, including teardown, planning, codegen, browser-distribution, server, save/reload, and headless-browser checks. |

The earlier discovery that the contained install has no wall-clock timeout was
duplicate-linked to issue #37 in
<https://github.com/tharpta/citybound/issues/37#issuecomment-5152820981>.

## Visible Startup And Networking

| Check | Result | Evidence |
| --- | --- | --- |
| Native debug server | WORKS | Server reported `Citybound v0.1.2-883-g0124297` and reached `Simulation running.` |
| New persisted city initializes | WORKS | Server created `/private/tmp/citybound-issue-5-0124297/city`; the final save contains 280 files. |
| HTTP browser page loads visibly | WORKS | Chrome visibly rendered Citybound at `http://127.0.0.1:43330/`. |
| Rust/WASM module loads | WORKS | Console recorded `Finished loading Rust wasm module 'cb_browser_ui'`, `Before setup`, and `After setup`. |
| Browser/server networking | WORKS | Server logged the page load, WebSocket handshake, and `machine ID 1 connected!`; Chrome logged continuing master-plan updates. |
| Initial simulation content | WORKS | Chrome logged `Rebuilt vegetation`, and the visible map rendered vegetation. |
| Browser warnings or errors | NONE OBSERVED | The captured Chrome console JSON contains no warning- or error-level entries. |

## First-Town Workflow

| Step | Result | Notes |
| --- | --- | --- |
| Start a new city | WORKS | Fresh city loaded visibly in Chrome with the expected build identity. |
| Create a planning project | WORKS | Project `B56` opened and received project updates. |
| Place connected roads | WORKS | A road-tool gesture produced a visible connected-road preview. |
| Zone nearby land | BROKEN | Residential zoning was attempted twice adjacent to the road, once in project `B56` and once in separate project `254`. Project changes were logged, but no visible zone appeared. |
| Implement the project | WORKS | Implement completed; at 32× speed the preview became a constructed visible road network. |
| Observe lot subdivision | NOT TESTED | No visible residential zone appeared, so subdivision could not be exercised. |
| Observe building development | NOT TESTED | Blocked downstream of the zoning failure. |
| Observe households | NOT TESTED | Blocked downstream of the zoning failure. |
| Observe vehicles and traffic | NOT TESTED | No developed households or vehicles were available to observe. |
| First shutdown | PARTIAL | SIGINT stopped the process and cleared both listeners, but the `tee` pipeline did not preserve the expected safe-stopping line. |
| Reload the same city | WORKS | Server reported `Loading from savegame`, reached `Simulation running.`, and Chrome reconnected. |
| Road persistence after reload | WORKS | The implemented road network remained visibly present after reload. |
| Final shutdown | WORKS | Direct SIGINT printed `Stopping Citybound safely...`; ports `43330`/`43331` and PID `61044` were absent afterward. |

The zoning failure is a factual outcome of this audit, not a fix in issue #5.
It is tracked separately in
<https://github.com/tharpta/citybound/issues/59> after an open-and-closed
duplicate search.

## Save And Reload Finding

The clean-current disappearing-road symptom tracked in
<https://github.com/tharpta/citybound/issues/8> was **not reproduced in this one
run**: after reload, Chrome reconnected and the implemented road network was
still visibly present. This single successful observation does not fully
resolve #8 or establish a semantic persistence regression guarantee.

The save contained 280 files after the run. File presence plus one visible road
reload is stronger evidence than the automated file-inventory smoke alone, but
does not cover zones, lots, buildings, households, or vehicles because zoning
did not produce visible state.

## Evidence Inventory

The reviewable evidence subset is committed under
`docs/audit/evidence/runtime-baseline-0124297/`:

- [`server-first-run.log`](evidence/runtime-baseline-0124297/server-first-run.log):
  build identity, save creation, simulation startup, page load, WebSocket
  handshake, and machine-ID connection.
- [`browser-console-before-implement.json`](evidence/runtime-baseline-0124297/browser-console-before-implement.json):
  WASM loading, browser setup, vegetation, master-plan, and project-change
  logs without warning/error entries.
- [`01-visible-load.jpg`](evidence/runtime-baseline-0124297/01-visible-load.jpg):
  visible Chrome startup and build identity.
- [`02-road-zone-attempt.jpg`](evidence/runtime-baseline-0124297/02-road-zone-attempt.jpg):
  project `B56`, road preview, and residential-zone tool state.
- [`03-after-implement.jpg`](evidence/runtime-baseline-0124297/03-after-implement.jpg):
  constructed visible road network.
- [`04-zone-project-after-implement.jpg`](evidence/runtime-baseline-0124297/04-zone-project-after-implement.jpg):
  later zoning attempt with no visible zone.
- [`05-before-shutdown.jpg`](evidence/runtime-baseline-0124297/05-before-shutdown.jpg):
  visible state before the first shutdown.
- [`06-after-reload-road-visible.jpg`](evidence/runtime-baseline-0124297/06-after-reload-road-visible.jpg):
  implemented roads still visible after reload.

The full local evidence remains under
`/private/tmp/citybound-issue-5-0124297/`. It additionally contains the
280-file city used for both runs and the repetitive first-run/post-reload
master-plan console captures. Those larger mutable runtime artifacts are not
treated as repository fixtures or a semantic persistence regression.

## Earlier Stale-Artifact Evidence

The earlier visible run used branch `codex/revival-bootstrap` and an existing
debug binary reporting `v0.1.2-837-gdf3d40e`. That binary was stale relative to
the source, so the observations below remain historical evidence and are not
the accepted clean-current baseline.

| Step | Result | Historical observation |
| --- | --- | --- |
| Visible page and Rust/WASM startup | WORKS | Page rendered; console reported Rust WASM loading and browser actor setup. |
| Create a planning project | WORKS | Project opened and received server updates. |
| Place connected roads | WORKS | Road preview rendered from a completed gesture. |
| Zone nearby land | PARTIAL | Zoning tools opened, but the gesture produced no visible zone. |
| Implement the project | WORKS | A constructed road rendered after implementation. |
| Observe lot subdivision | NOT TESTED | |
| Observe building development | NOT TESTED | |
| Observe households and vehicles | NOT TESTED | |
| Clean shutdown | WORKS | SIGINT reported `Stopping Citybound safely...`. |
| Reload the same city | BROKEN | The implemented road was no longer visible after reload. |

That stale-artifact symptom motivated #8. The accepted clean-current run above
did not reproduce it, but the one-run result is intentionally not treated as a
full resolution.
