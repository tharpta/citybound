# Gameplay Readiness Gate

Feature work should wait until these gates are met. The point is not caution for
its own sake; it is to avoid breaking the original simulation while we are still
learning how it works.

## Current Status

Ready:

- Historical compatibility build works locally.
- Browser assets can be rebuilt and embedded.
- Native debug server can start and serve the browser UI.
- Pure planning tests cover deterministic IDs, history updates, and action
  grouping.
- Local smoke command verifies browser dist artifacts and server HTTP startup.
- Real Chromium automation verifies WASM/React/WebGL startup and advancing
  networking turns.
- Initial architecture, safety-net, observability, and toolchain strategy docs
  exist.
- Engine ownership tiers, exact locked source baselines, and modernization order
  are documented.
- Browser simulation port is now templated from `--bind-sim` into served HTML.
- Retired live-build, patron, and milestone service calls no longer run during
  local startup.
- The first storage spike proves `chunky` can compile on stable Rust and scopes
  the remaining `compact` specialization work.
- Locked `kay_codegen 0.3.10` regenerates all 44 committed actor-glue files
  byte-for-byte in an isolated checkout.
- A two-boot save smoke verifies mmap actor-file creation, safe shutdown, reload,
  and file-inventory preservation.
- Process-local architecture file-watcher state is rebuilt after reload instead
  of leaving a stale heap pointer in persisted actor state.

Not ready:

- Engine crates are not forked/mirrored under revival control.
- Modern Rust fails in `compact` and then `chunky`.
- Cross-version save fixtures and actor-layout migration are not covered.
- The browser `stdweb`/JS boundary has end-to-end smoke coverage but no focused
  contract tests.

## Gate Checklist

Before gameplay feature work:

1. `npm run build-compat` passes.
2. `npm run test-compat` passes.
3. `npm run smoke-browser-compat` loads the app and observes networking turns
   advancing.
4. Engine stack ownership is settled for at least `kay`, `kay_codegen`,
   `compact`, `chunky`, `descartes`, `michelangelo`, and `monet`.
5. `npm run check-codegen-compat` verifies `kay_auto.rs` generation without
   source churn.
6. `npm run smoke-save-reload-compat` covers save startup and reload.
7. Modernization target for Rust storage crates is chosen.
8. Dead external service calls do not run during local startup.

## Next Non-Feature Milestone

The next milestone should be:

**Revival M1: Reliable Baseline**

Exit criteria:

- A real GitHub fork exists and this branch can push.
- `npm run build-compat` and `npm run test-compat` are documented and green.
- CI runs planning safety tests.
- Browser automation smoke verifies app startup against the local server.
- Engine dependency ownership plan is decided.
- First storage-stack modernization spike is scoped to `compact`/`chunky`.

Only after M1 should the project choose a gameplay loop to repair or extend.

## First Gameplay Loop Candidate

When the gate opens, the smallest honest citybuilder loop is:

1. Start a new city.
2. Create a planning project.
3. Place roads.
4. Zone land.
5. Implement the project.
6. Observe lots/buildings/households/traffic reacting.

That loop exercises planning, construction, land use, economy, pathfinding,
browser rendering, and persistence without pretending the whole game is finished.
