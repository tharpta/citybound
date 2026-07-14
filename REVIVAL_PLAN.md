# Citybound Revival Plan

This fork starts from `citybound/citybound` at commit `817de55`
(`2020-11-20`, "Newest version of procedural architecture").

The revival starts with archaeology, reproducibility, and modernization. Feature
work waits until we can build the project, understand the actor model, and make
changes with confidence.

## Current State

Citybound is not a simple game client. It is a distributed simulation:

- `cb_server` runs the simulation server, serves the browser client, persists
  world state through `kay::ActorSystem::new_mmap_persisted`, and advances time.
- `cb_browser_ui` builds a Rust/WASM client plus a React UI. The browser runs a
  second `kay::ActorSystem` and connects to the server over `kay` networking.
- `cb_simulation` contains the city systems: planning, transport, economy,
  land use, buildings, vegetation, pathfinding, and microtraffic.
- `cb_planning` turns player gestures into deterministic prototypes, diffs plan
  results, and queues construct/morph/destruct actions.
- `cb_time` drives temporal actors and sleepers.
- `cb_util` contains logging, deterministic randomness, config management, and
  the YAML file watcher used by procedural architecture rules.

The project has meaningful citybuilder systems already: roads, zones, lots,
building development, households, markets, immigration, pathfinding,
microtraffic, vegetation, and procedural building architecture. The main problem
is that the codebase is trapped in an old toolchain and has little safety net.

## Aeplay Engine Stack

Citybound is also not only one repository. It sits on a small ecosystem of
creator-maintained crates and packages that look like the original engine
toolkit. The current inventory lives in `docs/ENGINE_STACK.md`. These need to be
understood and pinned before any serious rewrite:

- `kay`: the distributed actor system used by both server and browser, including
  actor IDs, message dispatch, networking, browser clients, storage, and mmap
  persistence.
- `kay_codegen`: the source scanner/code generator that creates the committed
  `kay_auto.rs` actor glue in every Rust crate.
- `chunky`, `compact`, `compact_macros`, and `simple_allocator_trait`: the
  storage and memory-layout layer behind large actor collections, compact data,
  and persistence assumptions.
- `descartes`: the tolerance-aware 2D geometry layer used by roads, zones,
  planning bands, shapes, intersections, and offsets.
- `michelangelo`: procedural 3D geometry for generated buildings and visual
  output.
- `monet`: the old TypeScript/WebGL renderer consumed directly by the browser
  UI.
- `rust-embed`: a fork used by the root build for asset embedding.
- `typac`: a later TypeScript binary-representation project from the same
  author. It is not currently a Citybound dependency, but it may reveal later
  thinking about serialization/interchange.
- `WebFlood`: adjacent city/WebGL simulation work. It is probably inspiration,
  not a dependency.

This makes the revival less like "update an old Rust app" and more like
recovering a custom game/simulation engine. The first modernization decision is
whether to keep these packages external, fork/mirror them, vendor them, or
replace only specific pieces after their behavior is documented.

## Immediate Findings

- Rust tooling is historical: the repo expects `nightly-2020-03-10`.
- Browser Rust uses `stdweb` and `cargo-web 0.6.24`, both obsolete.
- The UI uses Parcel 1, React 16, Ant Design 3, mixed JS/TS/TSX, and imports the
  generated WASM package directly from `target/wasm32-unknown-unknown/release`.
- Every Rust crate runs `kay_codegen::scan_and_generate("src")`; generated
  `kay_auto.rs` files are committed and central to actor/message dispatch.
- The repo has no obvious test suite.
- Several external UI services are stale or likely dead, including live-build,
  patron, and GitHub milestone fetches.
- Cargo/npm lockfiles tie Citybound to the aeplay engine stack. Some pieces are
  crates.io dependencies, while others are git dependencies pinned to historical
  commits. We should not modernize them blindly.
- The local compatibility baseline now builds through Rosetta with
  `nightly-2020-03-10-x86_64-apple-darwin`, `cargo-web 0.6.24`, and a linker
  wrapper for Xcode 26.3's handling of old Rust `.rlib` archives.
- Browser npm tooling is sensitive to host path and Python version. The current
  successful browser build uses Python 3.11 and a temporary no-spaces checkout
  copy because old `node-gyp`/Make breaks on `Citybound Revival`.

## Revival Principles

- Preserve the original simulation model until we understand it well.
- Modernize in thin, reversible layers.
- Keep the original behavior observable before changing it.
- Prefer documentation, smoke tests, and build reproducibility over new features.
- Treat `kay`, `kay_codegen`, `compact`, `descartes`, and `michelangelo` as core
  architecture dependencies until proven otherwise.
- Treat the creator's companion repositories as part of the project boundary
  until we can prove which ones are replaceable libraries and which ones are
  engine source.
- Do not rewrite the game just to escape old tooling. First learn what the old
  tooling is protecting.

## Phase 0: Establish A Baseline

Goal: get from "dead repo" to "known, repeatable starting point."

Current baseline notes live in `docs/PHASE_0_BASELINE.md`.

- Record host prerequisites:
  - macOS version and CPU architecture
  - Xcode/Command Line Tools status
  - Rust/Cargo/rustup status
  - Node/npm status
- Accept or document the Xcode license requirement.
- Install `rustup` and the historical `nightly-2020-03-10` toolchain.
- Install or replace `cargo-web 0.6.24`.
- Run the original commands without changing source:
  - `npm run ensure-tooling`
  - `cargo check --locked`
  - `npm run build-server-debug`
  - `npm run build-browser`
- Capture exact failure logs in tracked docs, not only terminal scrollback.
- Build an engine-stack inventory:
  - exact locked version or git commit
  - upstream repository URL
  - crates.io/npm availability
  - license
  - last real source commit
  - role inside Citybound
  - known modernization risk

Exit criteria:

- We know whether the original project can still build with its intended
  historical toolchain.
- Every blocker has a small issue or note with the exact command and error.
- We know which external aeplay repositories must be mirrored, forked, or
  vendored before larger refactors begin.

## Phase 1: Architecture Map

Goal: understand what exists before moving anything.

Current architecture notes live in `docs/ARCHITECTURE_MAP.md`.

- Document the aeplay engine stack before changing it:
  - how `kay` actors are declared, stored, addressed, and messaged
  - how `kay_codegen` turns source annotations into `kay_auto.rs`
  - how `chunky` and `compact` shape actor storage and mmap persistence
  - how `descartes` represents paths, bands, shapes, intersections, and offsets
  - how `michelangelo` and procedural architecture feed renderable geometry
  - how `monet` receives scene data from the browser UI
- Document the server/browser split and `kay` networking flow.
- Document how `kay_codegen` discovers actors, traits, messages, and IDs.
- Map the core actor graph:
  - time and temporal actors
  - planning and construction
  - transport lanes, switch lanes, pathfinding, and microtraffic
  - land use, lots, buildings, and procedural architecture
  - households, resources, market, immigration, and development
  - browser UI subscribers and frame listeners
- Document the planning pipeline:
  - gesture intent
  - prototype calculation
  - spatial-grid diff
  - construct/morph/destruct action groups
  - simulation actors created from prototypes
- Document save/persistence assumptions around mmap state and versioning.
- Track known architecture risks found during mapping:
  - browser networking currently hardcodes simulation port `9999`, while the
    server CLI exposes `--bind-sim`
  - `kay_auto.rs` files are committed generated actor glue and must not be
    regenerated casually
  - save compatibility likely depends on actor registration/codegen identity and
    `compact`/`chunky` layout assumptions

Exit criteria:

- A new contributor can explain how a road or zone becomes simulation state.
- We know which modules are infrastructure and which are gameplay.

## Phase 2: Safety Net

Goal: make future modernization measurable.

Current safety-net notes live in `docs/SAFETY_NET.md`.

- Add minimal Rust smoke tests around pure logic first:
  - deterministic `PrototypeID` behavior
  - `PlanHistory` update/apply behavior
  - `PlanResult` diff behavior
  - simple road/zone prototype generation if geometry dependencies allow it
- Add a server startup smoke path that does not require the full browser bundle.
- Add a browser build smoke path that verifies WASM and JS artifacts exist.
- Add a small fixture city/save once startup works.
- Add scripts that separate:
  - historical build
  - modern Rust check
  - browser build
  - codegen regeneration

Exit criteria:

- We can detect when a modernization step changes core planning behavior.
- CI can run at least one meaningful check.

## Phase 3: Toolchain Strategy

Goal: choose the modernization route based on evidence.

Evaluate two tracks side by side:

- Compatibility track: keep the old toolchain long enough to produce a working
  baseline build and screenshots.
- Modernization track: move toward current stable Rust, current Node, and a
  supported WASM/bundler setup.

Key decisions:

- Keep `kay_codegen` or replace its generated actor glue?
- Keep `stdweb` temporarily, or migrate browser Rust to `wasm-bindgen`?
- Keep Parcel briefly, or move to Vite once WASM loading is understood?
- Keep `compact` persistence format, or introduce a versioned migration layer?
- Preserve committed `kay_auto.rs` files, or regenerate them deterministically in
  builds only?
- For each aeplay engine component, choose one:
  - keep using crates.io/npm/git as-is
  - fork under the revival account
  - vendor into this repo
  - replace after behavior is covered by tests

Exit criteria:

- We choose a modernization path because build evidence supports it, not because
  the old dependencies look unfashionable.
- We have an ownership plan for the engine stack, not only for the Citybound
  application repo.

## Phase 4: Modernize Infrastructure

Goal: reduce old-toolchain risk without changing game behavior.

Suggested order:

1. Make root scripts explicit and non-mutating. Tooling checks should report
   missing tools rather than silently overriding directories or installing
   binaries.
2. Stabilize Rust edition and compiler compatibility for server-side crates.
3. Isolate browser Rust/WASM from server Rust so each can modernize at its own
   pace.
4. Replace `cargo-web`/`stdweb` only after the JS/WASM boundary is documented.
5. Move JS tooling from Parcel 1 only after the WASM artifact path and asset
   serving path are tested.
6. Refresh CI to run the selected historical and/or modern checks.

Exit criteria:

- The project builds from documented commands on a clean machine.
- CI failures are actionable.
- No known simulation behavior has changed accidentally.

## Phase 5: Observability And Debugging

Goal: make the city simulation understandable while running.

- Keep and modernize the existing in-game debug UI.
- Add structured logs around:
  - planning project implementation
  - construction action groups
  - immigration and development decisions
  - pathfinding failures
  - traffic route/no-route outcomes
- Add a simple simulation snapshot/debug export.
- Replace dead external UI fetches with local/offline-friendly panels.
- Make crash reports point at the revival repo.

Exit criteria:

- When the city does something strange, we can see which actor/system caused it.

## Phase 6: Gameplay Readiness Gate

Feature work begins only after:

- The server and browser build reproducibly.
- We can run a small city locally.
- The planning loop is documented.
- At least basic smoke tests exist.
- We understand the cost of changing `kay`, persistence, and WASM bindings.

Only then should we choose feature work, likely in this order:

- make the basic playable loop reliable
- fix planning/editing ergonomics
- resume procedural architecture/modding
- resume traffic/pathfinding/microtraffic
- expand economy and development simulation

## Open Questions

- Is the first revived release a historical compatibility build or a modernized
  build?
- Is the long-term target still browser UI plus Rust server, or should the
  browser/server split change?
- How much of `kay` should be treated as part of Citybound and maintained here?
- Should the revival fork mirror/fork the aeplay support repositories before
  accepting external contributors?
- Can save persistence survive modernization, or should old saves be considered
  experimental?
- Which city loop is the smallest honest demo of the original vision?
