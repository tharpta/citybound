# Toolchain Strategy

This document records the current modernization decision. It is based on the
working compatibility build and the first modern Rust probes.

## Current Decision

Use two tracks:

1. Compatibility track: keep `nightly-2020-03-10`, `cargo-web 0.6.24`, Parcel 1,
   and the linker/no-spaces wrappers as the runnable baseline.
2. Modernization track: start with the Rust storage/actor stack before touching
   gameplay or browser rendering.

Do not try to "just upgrade Rust" across the whole repo yet. The first stable
Rust failures are in engine storage crates, not in Citybound gameplay code.

## Compatibility Track

Status: working locally.

Verified commands:

- `npm run build-compat`
- `npm run test-compat`
- `npm run test-planning-compat`
- `npm run check-browser-dist-compat`
- `npm run smoke-server-compat`

This track exists to keep the game observable while modernization happens. It is
also the reference behavior for tests, screenshots, and future browser smoke
checks.

## Modern Rust Probe

Command:

```sh
cargo +stable check -p cb_planning
```

Current result: fails in `compact 0.2.16`.

Key error:

```text
error[E0554]: `#![feature]` may not be used on the stable release channel
compact-0.2.16/src/lib.rs:17:1
#![feature(specialization)]
```

Diagnostic command:

```sh
RUSTC_BOOTSTRAP=1 cargo +stable check -p cb_planning
```

Current result: gets past `compact`, then fails in `chunky 0.3.7`.

Key error:

```text
error[E0635]: unknown feature `vec_resize_default`
chunky-0.3.7/src/lib.rs:10:12
#![feature(vec_resize_default)]
```

Interpretation:

- Stable Rust migration begins in `compact` and `chunky`.
- `kay` depends on that storage layer, so actor persistence is in the blast
  radius.
- Citybound planning logic should stay behavior-covered while these crates are
  patched or forked.

## Browser Tooling Probe

The compatibility browser build works with:

- Node `v20.6.1`
- npm `9.8.1`
- Python 3.11 for old `node-gyp`
- a temporary no-spaces checkout copy
- `cargo-web 0.6.24`
- `stdweb 0.4.x`
- Parcel 1

Known blockers:

- Real checkout path contains a space, and old `node-gyp`/Make breaks on it.
- Homebrew `python3` currently points to Python 3.14, which no longer has
  `distutils`.
- Browser Rust exports use `stdweb`, `js!`, typed arrays, and direct React state
  mutation.
- `monet` is a pinned git dependency and should be forked or vendored before a
  bundler migration.

Interpretation:

- Keep the compatibility browser build while Rust storage/actor modernization is
  investigated.
- Do not migrate Parcel before the WASM/JS boundary is documented and covered by
  at least a browser startup smoke.

## Recommended Order

1. Keep compatibility commands green.
2. Expand pure planning tests enough to guard prototype/action behavior.
3. Fork or mirror the engine stack: `kay`, `kay_codegen`, `chunky`, `compact`,
   `compact_macros`, `descartes`, `michelangelo`, `rust-embed`, and `monet`.
4. Patch `compact` on a fork/path dependency to remove or replace
   specialization usage.
5. Patch `chunky` on a fork/path dependency to remove the deleted
   `vec_resize_default` feature gate.
6. Re-run `cargo +stable check -p cb_planning` after each storage-layer patch.
7. Once `cb_planning` checks on stable, try `cb_time`, `cb_util`, then
   `cb_simulation`.
8. Only after server-side crates are understood, split browser modernization
   into:
   - hardcoded simulation port fix
   - `stdweb` boundary inventory
   - `wasm-bindgen` spike
   - Parcel-to-Vite or equivalent bundler spike

## Non-Goals For The Next Step

- No gameplay feature work.
- No broad dependency update.
- No save format change.
- No removal of committed `kay_auto.rs`.
- No `stdweb` replacement until a browser connection smoke exists.

## Open Decisions

- Should engine crates be patched through `[patch.crates-io]` forks or vendored
  into this repo while the modernization is active?
- Should the first modern Rust target be stable Rust, or a current nightly that
  temporarily tolerates more old patterns?
- Should compatibility CI stay planning-only, or should a scheduled/manual macOS
  job run the full `build-compat` path once a real GitHub fork exists?
