# M0 Rust And Engine Dependency Audit

GitHub issue: <https://github.com/tharpta/citybound/issues/2>

Status: evidence collected; requires independent verification.

Registry packages are locked by crates.io version and package checksum. Short
upstream commit mappings from prior revival research are not Cargo lock
identities and require separate provenance verification.

| Dependency | Locked package | Risk | Provisional disposition |
| --- | --- | --- | --- |
| `kay` | 0.5.1; checksum `782e...3015` | Actor IDs, networking, and persisted storage | KEEP PINNED; FORK/MIRROR exact baseline |
| `kay_codegen` | 0.3.10; `4ff6...c576` | Committed actor glue and old parser stack | KEEP PINNED; FORK/MIRROR; prove determinism |
| `chunky` | 0.3.7; `2e2a...3254` | mmap actor collections on server builds | FORK; upgrade only after storage fixtures |
| `compact` | 0.2.16; `7ba5...eef5` | Save-critical memory layout; upstream commit mapping unverified | Import exact published source into controlled fork |
| `compact_macros` | 0.1.0; `3e78...0e8a` | Layout-sensitive old derives | FORK/MIRROR with `compact` |
| `simple_allocator_trait` | 0.1.0; `20fc...2b39` | Low-level allocator API used by save-critical compact containers | MIRROR/FORK with `compact`, later fold in |
| `descartes` | 0.1.20; `39a1...943b` | Gameplay-critical road/zoning geometry | KEEP PINNED; FORK/MIRROR; add fixtures |
| `michelangelo` | 0.2.5; `c7e9...d23d` | Procedural geometry/rendering | KEEP PINNED; FORK/MIRROR; add fixtures |
| `rust-embed-flag` | 3.0.1; git lock `3f1ce67f` | Manifest lacks immutable `rev` | MIRROR exact commit, later replace |
| `stdweb` | manifest 0.4.9; lock 0.4.20 | Broad JS/WASM and Kay browser boundary | KEEP for compatibility; later replace |

The audited aeickhoff engine crates and `rust-embed-flag` report MIT licensing
in local package metadata; `stdweb` reports MIT/Apache-2.0. None declares a
modern `rust-version`. Lockfiles supply version/checksum integrity; locally
cached `Cargo.toml.orig` files supply repository and license metadata.

## Modernization Order

1. Own and fixture the storage stack.
2. Prove semantic save and layout behavior.
3. Own and modernize Kay and codegen.
4. Cover and modernize geometry/rendering.
5. Replace `stdweb` with `wasm-bindgen`/`web-sys`.

Blanket `cargo update` is unsafe. Generated actor glue and compact memory layout
remain compatibility contracts until explicitly versioned.
