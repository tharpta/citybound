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
- Initial architecture, safety-net, observability, and toolchain strategy docs
  exist.
- Browser simulation port is now templated from `--bind-sim` into served HTML.

Not ready:

- No real browser automation smoke yet.
- Engine crates are not forked/mirrored under revival control.
- Modern Rust fails in `compact` and then `chunky`.
- Save compatibility risks are not tested.
- `kay_codegen` reproducibility is not verified.
- Browser `stdweb`/JS boundary is not covered by tests.
- Dead external UI fetches are still present.

## Gate Checklist

Before gameplay feature work:

1. `npm run build-compat` passes.
2. `npm run test-compat` passes.
3. Browser automation can load the app and observe networking turns advancing.
4. Engine stack ownership is settled for at least `kay`, `kay_codegen`,
   `compact`, `chunky`, `descartes`, `michelangelo`, and `monet`.
5. `kay_auto.rs` generation can be verified without accidental source churn.
6. Save startup and reload are covered by a repeatable fixture or smoke.
7. Modernization target for Rust storage crates is chosen.
8. Dead external service calls are either removed, mocked, or made optional.

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
