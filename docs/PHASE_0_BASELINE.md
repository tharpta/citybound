# Phase 0 Baseline Status

Recorded on 2026-07-13 in `/Users/tylertharp/Documents/Citybound Revival/citybound`.

## Host

| Item | Value |
| --- | --- |
| macOS | 15.6.1, build 24G90 |
| CPU architecture | `arm64` |
| Xcode | 26.3, build 17C529 |
| Xcode license | Accepted |
| Node | `v20.6.1` |
| npm | `9.8.1` |

## Rust Tooling

| Item | Value |
| --- | --- |
| rustup | `1.29.0` |
| default toolchain | `stable-aarch64-apple-darwin` |
| Citybound override | `nightly-2020-03-10-x86_64-apple-darwin` |
| Citybound rustc | `rustc 1.43.0-nightly (3dbade652 2020-03-09)` |
| Citybound cargo | `cargo 1.43.0-nightly (bda50510d 2020-03-02)` |
| installed historical targets | `x86_64-apple-darwin`, `wasm32-unknown-unknown` |
| cargo-web | `0.6.24` |

Notes:

- Native `nightly-2020-03-10-aarch64-apple-darwin` does not exist. The historical
  toolchain is installed as `x86_64-apple-darwin` and runs through Rosetta.
- `~/.zprofile` was updated so `~/.cargo/bin` wins over Homebrew Rust in new zsh
  login shells.
- The old crates.io git index at
  `~/.cargo/registry/index/github.com-1ecc6299db9ec823` produced a zlib stream
  read error. It was moved aside to
  `~/.cargo/registry/index/github.com-1ecc6299db9ec823.bak-20260713215138`, then
  Cargo rebuilt the index and fetched the locked dependency set successfully.
- Xcode 26.3's linker rejects old Rust `.rlib` archives that contain `lib.rmeta`
  and embedded `*.bc.z` members. `repo_scripts/cc-strip-rmeta.sh` is a
  compatibility linker wrapper that copies `.rlib` files to a temporary folder,
  removes those non-linkable members from the copies, and invokes `/usr/bin/cc`.
- The browser npm install cannot run from the real checkout path because
  `node-gyp`/Make splits the space in `Citybound Revival`. The successful
  compatibility browser build used a temporary no-spaces copy at
  `/tmp/citybound-revival-nospace`.

## Commands Run

### `npm run ensure-tooling -- -q`

Current status: passes.

Work done:

- Installed `rustup`.
- Installed `nightly-2020-03-10-x86_64-apple-darwin`.
- Installed the `wasm32-unknown-unknown` target for the historical nightly.
- Installed `cargo-web 0.6.24`.
- Patched `repo_scripts/tooling.js` so it checks the active toolchain with
  `rustup show active-toolchain` instead of parsing old `rustup show` output.

### `CARGO_NET_GIT_FETCH_WITH_CLI=true cargo fetch --locked`

Current status: passes after rebuilding the old crates.io git index.

This downloaded the locked Rust dependency set, including the aeplay stack:
`kay`, `kay_codegen`, `chunky`, `compact`, `compact_macros`, `descartes`, and
`michelangelo`.

### `npm run build-server-debug-compat`

Current status: passes.

This command wraps the historical server debug build with the macOS linker
compatibility setup:

```sh
npm run build-server-debug-compat
```

The first post-license attempt got past dependency compilation and failed because
`cb_server/browser_ui_server.rs` derives `RustEmbed` over `cb_browser_ui/dist/`,
which did not exist yet. After building browser assets with
`npm run build-browser-compat`, this command finished successfully:

```text
Finished dev [unoptimized + debuginfo] target(s) in 22.26s
```

### `npm run build-browser-compat`

Current status: passes.

This command creates a no-spaces temporary checkout copy, runs the historical
browser build there, and copies generated assets back to `cb_browser_ui/dist/`:

```sh
npm run build-browser-compat
```

Why this is needed:

- Homebrew `python3` currently resolves to Python 3.14, which lacks `distutils`.
  Old `node-gyp` needs `distutils`, so use Python 3.11.
- Running npm install from the real path fails while building `deasync` because
  the generated Makefile splits `Citybound Revival` at the space.

Successful browser output included:

```text
Finished release [optimized + debuginfo] target(s) in 1m 50s
Finished processing of "cb_browser_ui.wasm"!
Built in 6.58s.
```

`cb_browser_ui/dist/` is ignored by git.

### `npm run build-compat`

Current status: passes.

This runs the full compatibility baseline build:

```sh
npm run build-compat
```

It executes `build-browser-compat` first so server asset embedding has a fresh
`cb_browser_ui/dist/`, then executes `build-server-debug-compat`.

The combined command was verified after the compatibility scripts were added.
It completed the browser Rust/WASM build, Parcel bundle, asset copy-back, and
native debug server build successfully.

## Runtime Smoke

Current status: passes.

Command:

```sh
target/debug/citybound \
  --mode local \
  --bind 127.0.0.1:43210 \
  --bind-sim 127.0.0.1:43211 \
  /tmp/citybound-smoke-city
```

Observed server output:

```text
http://localhost:43210
Savegame folder /tmp/citybound-smoke-city not found, creating...
Simulation running.
Started watching config file . "modding/architecture_rules.yaml"
```

HTTP check:

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf8
Content-Length: 3680
```

The smoke city folder contained mmap-backed actor persistence files, including
`ConfigManager(ArchitectureRule)`, `Construction(CBPrototypeKind)`,
`DevelopmentManager`, `Family`, and many other actor stores. The process stopped
cleanly with Ctrl-C and printed `Stopping Citybound safely...`.

## Current Baseline

- Historical Rust toolchain: working through Rosetta.
- Historical browser Rust/WASM build: working from a no-spaces checkout copy.
- Parcel 1 browser bundle: working from the same no-spaces checkout copy.
- Native debug server build: working after browser assets exist.
- Runtime server smoke: working locally and serving the generated browser UI.
