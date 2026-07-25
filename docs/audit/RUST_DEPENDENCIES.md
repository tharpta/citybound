# M0 Rust And Engine Dependency Audit

GitHub issue: <https://github.com/tharpta/citybound/issues/2>

Status: evidence collected; requires independent verification.

| Dependency | Locked source | Risk | Provisional disposition |
| --- | --- | --- | --- |
| `kay` | 0.5.1; source commit `7a0d5cfbc6e` | Actor IDs, networking, and persisted storage | KEEP PINNED; FORK/MIRROR exact baseline |
| `kay_codegen` | 0.3.10; `e7be076cb782` | Committed actor glue and old parser stack | KEEP PINNED; FORK/MIRROR; prove determinism |
| `chunky` | 0.3.7; `ef8533aec961` | mmap-oriented actor collections | FORK; upgrade only after storage fixtures |
| `compact` | 0.2.16; crates source `9037e458` | Save-critical memory layout; source not in recorded public history | Import exact source into controlled fork |
| `compact_macros` | 0.1.0; `27752ec` | Layout-sensitive old derives | FORK/MIRROR with `compact` |
| `simple_allocator_trait` | 0.1.0; `59beb9b` | Dormant placeholder storage abstraction | MIRROR/FORK, later replace or fold in |
| `descartes` | 0.1.20; `0f31b183` | Gameplay-critical road/zoning geometry | KEEP PINNED; FORK/MIRROR; add fixtures |
| `michelangelo` | 0.2.5; `5c8afc6e` | Procedural geometry/rendering | KEEP PINNED; FORK/MIRROR; add fixtures |
| `rust-embed-flag` | 3.0.1; git lock `3f1ce67f` | Manifest lacks immutable `rev` | MIRROR exact commit, later replace |
| `stdweb` | manifest 0.4.9; lock 0.4.20 | Broad JS/WASM and Kay browser boundary | KEEP for compatibility; later replace |

The requested aeplay crates report MIT licensing in local evidence; `stdweb`
reports MIT/Apache-2.0. None declares a modern `rust-version`.

## Modernization Order

1. Own and fixture the storage stack.
2. Prove semantic save and layout behavior.
3. Own and modernize Kay and codegen.
4. Cover and modernize geometry/rendering.
5. Replace `stdweb` with `wasm-bindgen`/`web-sys`.

Blanket `cargo update` is unsafe. Generated actor glue and compact memory layout
remain compatibility contracts until explicitly versioned.
