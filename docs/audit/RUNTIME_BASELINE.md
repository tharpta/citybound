# M0 Runtime Baseline

GitHub issue: <https://github.com/tharpta/citybound/issues/5>

Status: BLOCKED

## Clean-Current Run Context

- Date: 2026-07-24 (America/Los_Angeles)
- Branch: `codex/issue-5-current-runtime-baseline`
- Accepted source commit:
  `48fd9dd285d95b293fa72baa66d5fdcc6e36d95f`
- Audited build command: `npm run build-compat`
- Built identity: `Citybound v0.1.2-864-g48fd9dd`
- Server command:
  `target/debug/citybound --mode local --bind 127.0.0.1:43320 --bind-sim 127.0.0.1:43321 /tmp/citybound-issue-5-current.PwqWnX/city`
- City: newly created temporary city
- Browser requirement: visible Google Chrome in the selected `Default` profile
- Source working tree: clean before and after the build and server run

The audited compatibility build completed the historical Rust/WASM release
build, Parcel bundle, browser artifact copy-back, and native debug server build.
The build used only local tooling and did not dispatch CI or provision a paid
service.

## Clean-Current Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Compatibility build | WORKS | `npm run build-compat` completed successfully from commit `48fd9dd`. |
| Browser distribution | WORKS | The build produced `cb_browser_ui/dist/index.html` and `cb_browser_ui.wasm`; browser execution is not implied. |
| Native debug server | WORKS | The built executable reported `Citybound v0.1.2-864-g48fd9dd`. |
| New persisted city initializes | WORKS | Server reported that the save folder was absent, created it, and reached `Simulation running.` |
| HTTP browser page loads visibly | NOT TESTED | Required Chrome control did not connect. |
| Rust/WASM module loads in Chrome | NOT TESTED | No visible page or browser console was available. |
| Browser/server networking | NOT TESTED | No browser network evidence was available. |
| Browser console errors | NOT TESTED | No browser console was available. |
| Clean shutdown | WORKS | SIGINT reported `Stopping Citybound safely...`. |
| Server reload of the same city | WORKS | Restart reported `Loading from savegame ...` and reached `Simulation running.` |
| Second clean shutdown | WORKS | The reloaded server again reported `Stopping Citybound safely...`. |
| Semantic gameplay persistence | NOT TESTED | No gameplay state could be created through the required visible browser. |

The temporary city contained 262 persisted files after the startup/reload
sequence. This is file-level server evidence only; it does not prove that a
road, zone, building, household, or vehicle survives reload.

## First-Town Workflow

| Step | Result | Notes |
| --- | --- | --- |
| Start a new city | PARTIAL | The server created a fresh city, but the city was not displayed in Chrome. |
| Create a planning project | NOT TESTED | Blocked before visible interaction. |
| Place connected roads | NOT TESTED | Blocked before visible interaction. |
| Zone nearby land | NOT TESTED | Blocked before visible interaction. |
| Implement the project | NOT TESTED | Blocked before visible interaction. |
| Observe lot subdivision | NOT TESTED | Blocked before visible interaction. |
| Observe building development | NOT TESTED | Blocked before visible interaction. |
| Observe households and vehicles | NOT TESTED | Blocked before visible interaction. |
| Clean shutdown | WORKS | Both server runs used the safe SIGINT path. |
| Reload the same city | PARTIAL | Server reload works; visible and semantic gameplay reload remain untested. |

## External Blocker

Google Chrome 150.0.7871.186 was installed and running. The ChatGPT Chrome
Extension was installed and enabled in the selected `Default` profile, and its
native messaging host manifest existed, matched `com.openai.codexextension`,
and allowed the expected extension origin.

The initial Chrome connection, a delayed retry, and the single supported retry
after opening a fresh Chrome window all returned:

```text
Browser is not available: extension
```

The approved Chrome-control procedure prohibits substituting the in-app
browser, AppleScript, or shell-driven browser control. Issue #5 therefore cannot
meet its visible-browser, browser-console, networking, or first-town acceptance
criteria until the user-visible Chrome extension connection responds.

Producer blocker decision:
<https://github.com/tharpta/citybound/issues/5#issuecomment-5076938598>

Unblock condition: restore the user-visible Chrome extension connection, then
resume the first-town workflow from a fresh city on the accepted source.

## Earlier Stale-Artifact Evidence

The earlier visible run used branch `codex/revival-bootstrap` and an existing
debug binary reporting `v0.1.2-837-gdf3d40e`. That binary was stale relative to
the source, so the observations below remain historical evidence and are not
accepted as the clean-current baseline.

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

The stale-artifact road persistence symptom is tracked in
<https://github.com/tharpta/citybound/issues/8>. The clean-current run did not
reproduce or disprove it because visible gameplay interaction was blocked.
