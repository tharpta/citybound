# Citybound Engine Stack Inventory

This inventory tracks the creator-maintained aeplay projects that Citybound
depends on or may need to understand during revival. Treat this as a starting
map, not as a modernization decision.

## Directly Used By Citybound

| Component | Locked source | Role in Citybound | Revival note |
| --- | --- | --- | --- |
| `kay` | crates.io `0.5.1` | Distributed actor system used by the server and browser, including actor IDs, message dispatch, networking, and persisted actor storage. | Core engine. Understand before touching actor lifecycle, networking, or save state. |
| `kay_codegen` | crates.io `0.3.10` | Generates the committed `kay_auto.rs` files from crate source. | Core build/codegen path. Keep committed output stable until regeneration is reproducible. |
| `chunky` | crates.io `0.3.7` | Storage for heterogeneously sized entity collections, pulled through `kay`. | Persistence and memory-layout risk. Audit with `compact` and `kay` together. |
| `compact` | crates.io `0.2.16` | Compact representation of data with dynamic fields. | Persistence and serialization risk. Avoid broad type/layout changes before tests. |
| `compact_macros` | crates.io `0.1.0` | Derive macro for `Compact` types. | Old proc-macro dependency. Likely compiler modernization hotspot. |
| `simple_allocator_trait` | crates.io `0.1.0` | Allocator abstraction used under `compact`/`chunky`. | Treat as part of storage stack, even though the crate is tiny. |
| `descartes` | crates.io `0.1.20` | Tolerance-aware 2D geometry for paths, bands, shapes, intersections, offsets, roads, and zones. | Gameplay-critical. Add tests before replacing or upgrading. |
| `michelangelo` | crates.io `0.2.5` | Procedural 3D geometry used by procedural architecture/rendering paths. | Visual/procedural-generation risk. Document inputs and outputs before changing. |
| `rust-embed-flag` | git `https://github.com/aeickhoff/rust-embed#3f1ce67f01884d895d0d522d32481232a64481df` | Asset embedding for the root build. | Pinned fork. Decide whether to replace with upstream `rust-embed` after asset serving is tested. |
| `monet` | git `https://github.com/aeickhoff/monet.git#5b79f29034c239961f2c93310ddc78ed868865fe` | TypeScript/WebGL renderer consumed by `cb_browser_ui`. | UI/rendering dependency. Fork or vendor before major JS tooling changes. |

## Relevant Aeplay Projects Not Currently Direct Dependencies

| Component | Source | Why it matters | Revival note |
| --- | --- | --- | --- |
| `typac` | `https://github.com/aeplay/typac` | Later TypeScript project for efficient binary representations and interop. | Do not adopt now. Read for design context if serialization/interchange becomes a blocker. |
| `WebFlood` | `https://github.com/aeplay/WebFlood` | Earlier WebGL/GPGPU shallow-water city simulation. | Inspiration only unless a concrete reusable asset or algorithm is found. |
| `parcel-plugin-cargo-web` | `https://github.com/aeplay/parcel-plugin-cargo-web` | Archived fork related to the old browser Rust toolchain. | Useful for understanding the historical build path, not a long-term dependency. |

## Ownership Strategy

The ownership decision, exact source baselines, and modernization order now live
in `docs/ENGINE_OWNERSHIP.md`.

The short version:

1. Use same-name revival forks and preserve upstream Git history.
2. Keep package names and pin Citybound to immutable fork commits.
3. Import crates.io source when the locked release is not recoverable from public
   Git history. This is required for `compact 0.2.16`.
4. Modernize storage first, then actor runtime/codegen, then geometry/rendering.
5. Only vendor a component into Citybound if it becomes application-specific or
   cross-repository coordination becomes a demonstrated problem.

## Remaining Checks

- Create the revival-owned forks and push their recovered baseline branches.
- Identify whether downstream forks already contain relevant modern Rust or WASM
  work.
- Add behavior and persistence fixtures before changing package APIs or layout.
