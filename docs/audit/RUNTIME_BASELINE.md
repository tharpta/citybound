# M0 Runtime Baseline

GitHub issue: <https://github.com/tharpta/citybound/issues/5>

Status: ACTIVE

## Run Context

- Date: 2026-07-24 (America/Los_Angeles)
- Branch: `codex/revival-bootstrap`
- Server command:
  `target/debug/citybound --mode local --bind 127.0.0.1:43300 --bind-sim 127.0.0.1:43301 /tmp/citybound-m0-visible.Row22k`
- City: newly created temporary city
- Browser: visible Codex in-app browser
- Source working tree: clean at server start

Important limitation: the existing debug binary reports
`v0.1.2-837-gdf3d40e`. Current source is ahead of `df3d40e`, so this run is
evidence about the available built artifact, not yet a clean-current build.

## Initial Startup

| Check | Result | Evidence |
| --- | --- | --- |
| Server process starts | WORKS | Server reports `Simulation running.` |
| New persisted city initializes | WORKS | Server reports save folder creation. |
| HTTP browser page loads | WORKS | Visible page opened at port 43300. |
| Rust/WASM module loads | WORKS | Browser logs `Finished loading Rust wasm module 'cb_browser_ui'`. |
| Browser actor setup runs | WORKS | Browser logs `Before setup` and `After setup`. |
| Initial simulation content arrives | PARTIAL | Browser logs `Rebuilt vegetation`; deeper state not yet verified. |
| Revival status UI renders | WORKS | About panel and time controls are visible. |
| Console errors | NONE OBSERVED YET | Initial captured browser log contains no error-level entry. |

## First-Town Workflow

| Step | Result | Notes |
| --- | --- | --- |
| Start a new city | WORKS | Fresh temporary city is running. |
| Create a planning project | WORKS | Project opened and received server updates. |
| Place connected roads | WORKS | Road preview rendered from a completed gesture. |
| Zone nearby land | PARTIAL | Zoning tools and residential intent opened, but the attempted gesture produced no visible zone. |
| Implement the project | WORKS | Constructed road rendered after implementation. |
| Observe lot subdivision | NOT TESTED | |
| Observe building development | NOT TESTED | |
| Observe households and vehicles | NOT TESTED | |
| Clean shutdown | WORKS | SIGINT produced `Stopping Citybound safely...`. |
| Reload the same city | BROKEN | Server loaded the same city, but the implemented road was no longer visible. |

## Findings

1. The visible game can start and render against the current saved browser
   distribution.
2. The available native debug binary is stale relative to the branch. A later
   trusted-current run must rebuild it through an audited command before this
   issue can close.
3. Planning, road preview, and road implementation work in the stale artifact
   without a captured browser warning or error.
4. The residential zoning attempt was inconclusive: the tools activated but no
   zone was visibly created.
5. The implemented road disappeared after clean shutdown and reload. This is
   tracked in <https://github.com/tharpta/citybound/issues/8> and must be
   reproduced on a clean-current build before attributing it to current source.
