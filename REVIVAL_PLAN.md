# Citybound Revival Plan

This fork starts from `citybound/citybound` at `817de55` from 2020-11-20.
The first goal is not to add features immediately. It is to make the old game
buildable, observable, and safe to change again.

## Guiding Principles

- Preserve the original vision: microscopic simulation, collaborative planning,
  and procedural city systems.
- Prefer revival over rewrite until evidence says otherwise.
- Keep behavior changes small until the build, tests, and runtime are understood.
- Document every modernization decision, especially when replacing old tooling.
- Respect the AGPL-3.0 license and keep attribution clear.

## Phase 0: Fork And Project Setup

- Create the GitHub fork under the revival owner.
- Rename the original remote to `upstream` and use `origin` for the revival fork.
- Keep `master` tracking upstream history; do revival work on short branches.
- Add project documentation for build status, known blockers, and revival goals.
- Open an initial GitHub issue board with labels like `build`, `runtime`,
  `architecture`, `simulation`, `ui`, `docs`, and `good first issue`.

## Phase 1: Make It Run Again

- Run the original build commands exactly as documented.
- Record the current failures on macOS, Linux, and eventually Windows.
- Pin or restore the expected historical toolchain if needed.
- Decide whether the first working target is:
  - historical compatibility build using old Rust/Node versions
  - modernized build using current stable Rust and Node
- Capture screenshots or video of the last working baseline.

## Phase 2: Stabilize The Foundation

- Add a simple CI workflow that at least checks formatting and compile status.
- Replace generated or stale build steps only when the current behavior is clear.
- Separate server, simulation, UI, and tooling failures into focused issues.
- Add smoke tests around startup, asset serving, and simulation initialization.
- Write a short architecture map of the crates and browser UI.

## Phase 3: Modernize Carefully

- Move toward stable Rust, modern Cargo behavior, and supported Node tooling.
- Upgrade dependencies in small batches with compile/runtime verification.
- Remove obsolete generated files only after reproducing their generation path.
- Keep a compatibility branch/tag for the first revived runnable version.
- Avoid large rewrites until the original systems are understood well enough to
  preserve their behavior.

## Phase 4: Resume Feature Work

- Finish or retire the last known feature directions:
  - procedural architecture and modding rules
  - transport, lanes, pathfinding, microtraffic, and possible pedestrian work
  - browser UI TypeScript migration
- Pick one small playable loop to make reliable:
  - place roads
  - zone land
  - spawn households/businesses
  - observe traffic and building growth
- Build new features only after the loop is stable enough to demo.

## First Week Checklist

- Create the GitHub fork and push this branch.
- Run `npm run ensure-tooling` and capture all failures.
- Try `npm run build-server-debug`.
- Try `npm run build-browser`.
- Identify the minimum historical Rust and Node versions needed.
- Create `docs/architecture.md` with the current crate and runtime map.
- Create issues for each build blocker instead of mixing fixes together.

## Open Questions

- Should the revived fork keep the `citybound` name or use a distinct name such
  as `citybound-revival`?
- Should the first milestone be "runs like 2020 Citybound" or "modern toolchain
  compiles cleanly"?
- Is the long-term goal a maintained fork of the original codebase, or a staged
  extraction of concepts into a new engine?
