# Engine Ownership And Modernization Order

Citybound depends on a small custom engine family that is dormant upstream. The
revival will preserve those repositories and their history rather than silently
absorbing them into the game repository.

## Decision

For each direct aeplay engine dependency:

1. Create a same-name fork under the revival owner.
2. Preserve the upstream repository as `upstream`.
3. Import the exact locked crates.io source when it is not reachable from public
   Git history.
4. Keep the existing crate/package name and license.
5. Pin Citybound to immutable fork commits through Cargo patches or npm commit
   references during modernization.
6. Do not publish replacement crates to crates.io/npm until APIs and save
   compatibility are intentionally versioned.

This applies to `kay`, `kay_codegen`, `chunky`, `compact`, `compact_macros`,
`simple_allocator_trait`, `descartes`, `michelangelo`, and `monet`.

`rust-embed-flag` should be mirrored so the historical build remains recoverable,
but it is an application build dependency rather than part of the simulation
engine. The preferred long-term action is replacement with supported asset
embedding after debug/release asset behavior is covered.

All audited repositories and locked package manifests use the MIT license. None
of the aeplay repositories expose release tags, so version strings alone are not
enough to recover the source.

## Canonical Baselines

| Component | Citybound baseline | Public repository head | Ownership note |
| --- | --- | --- | --- |
| `kay` | crates.io `0.5.1`, source commit `7a0d5cf` | `e91f98c`, 2020-08-24 | Start the fork from public history, preserve `7a0d5cf` as the compatibility baseline, and evaluate the later WebSocket protocol fix separately. |
| `kay_codegen` | crates.io `0.3.10`, `e7be076` | `e7be076`, 2019-06-05 | Locked release matches public head. Fork before any parser/code-generation changes. |
| `chunky` | crates.io `0.3.7`, `ef8533a` | `ef8533a`, 2019-07-02 | Locked release matches public head. First storage modernization target. |
| `compact` | crates.io `0.2.16`, source metadata says `9037e45` | `06c34db`, 2019-07-09, manifest version `0.2.15` | `9037e45` is not reachable from public Git history. Import the exact crates.io `0.2.16` source into the fork as the canonical baseline before patching. |
| `compact_macros` | crates.io `0.1.0`; source matches `27752ec` | `27752ec`, 2018-07-05 | Fork with `compact`; its generated impl strategy is part of removing specialization. |
| `simple_allocator_trait` | crates.io `0.1.0`; source matches `59beb9b` | `59beb9b`, 2018-07-05 | Upstream is archived. Preserve it as a separate compatibility crate initially, then consider folding it into the storage stack. |
| `descartes` | crates.io `0.1.20`, `0f31b18` | `0f31b18`, 2020-04-10 | Locked release matches public head. Keep pinned until geometry behavior has direct tests. |
| `michelangelo` | crates.io `0.2.5`, `5c8afc6` | `5c8afc6`, 2019-04-24 | Locked release matches public head. Keep pinned until procedural geometry has fixtures. |
| `monet` | git commit `5b79f29` | `5b79f29`, 2018-11-27 | Citybound is already pinned to public head. Fork before replacing Parcel or changing render contracts. |
| `rust-embed-flag` | git commit `3f1ce67` | `3f1ce67`, 2018-09-01 | Historical aeplay fork of `rust-embed`; mirror for recovery, then replace in Citybound. |

The crates.io source commit values come from each package's
`.cargo_vcs_info.json`. Older packages without that metadata were compared
against public repository source; only Cargo's normalized package manifest
differed.

## Ownership Tiers

### Tier 1: Storage And Persistence

- `simple_allocator_trait`
- `compact`
- `compact_macros`
- `chunky`

These move together because actor storage, compact dynamic fields, and mmap save
layout cross their boundaries. This tier gets forked and tested first.

### Tier 2: Actor Runtime And Code Generation

- `kay`
- `kay_codegen`

`kay` depends on the storage tier and owns actor IDs, message dispatch,
networking, and persistence. Modernize it only after the storage bridge is
usable. Treat generated `kay_auto.rs` stability as an API contract.

### Tier 3: Simulation Geometry And Rendering

- `descartes`
- `michelangelo`
- `monet`

Keep these pinned while planning/geometry fixtures and browser visual checks are
added. Their compiler and bundler upgrades should not be coupled to the first
storage migration.

## Storage Modernization Spike

The first spike used the exact locked crate sources and local stable Rust
`1.97.0`.

### `chunky 0.3.7`

The only compiler blocker was `#![feature(vec_resize_default)]`. The code already
uses stable `Vec::resize_with`, so removing the obsolete feature attribute made
`cargo test --all-features` pass. The crate currently has no unit tests, which
means mmap reload and collection behavior need fixtures before release.

### `compact 0.2.16`

Plain stable Rust stops at `#![feature(specialization)]`. A temporary
`RUSTC_BOOTSTRAP=1` bridge exposed three additional modern-Rust fixes:

- make a raw-pointer autoref explicit while compacting nested vectors
- use `NonNull::<T>::dangling()` for aligned empty-slice pointers instead of
  address `0x1`
- make two raw-pointer test references explicit

With those changes, all 26 crate tests pass on Rust `1.97.0`.

Changing from `specialization` to `min_specialization` is not enough. Rust
rejects the three `Copy`-based specialized implementations for `CompactVec`,
`Clone`, and hash-map entries. Full stable Rust therefore requires an explicit
design for fixed-size/copy types and coordinated changes to `compact_macros`.

## Chosen Migration Order

1. Fork the Tier 1 repositories and import the exact `compact 0.2.16` crate
   source into its fork.
2. Land the `chunky` stable feature cleanup with storage tests.
3. Land the narrow `compact` pointer-safety fixes and run it on current Rust with
   a clearly isolated specialization bridge.
4. Add a Citybound save fixture that starts, shuts down, reloads, and checks
   stable actor counts/state.
5. Point a Citybound modernization branch at immutable Tier 1 fork commits and
   make native planning/server checks pass on current Rust.
6. Replace specialization with an explicit stable trait/derive strategy while
   preserving compact layout and validating the save fixture.
7. Move to `kay`/`kay_codegen`, then geometry and rendering.

The specialization bridge is temporary by design. It lets compiler and
pointer-safety work proceed without pretending that persistence semantics can be
redesigned safely in the same patch.
