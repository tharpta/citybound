# Local Development

These are the currently verified revival commands for this fork.

## First-Time Setup

1. Install `rustup`.
2. Make sure `~/.cargo/bin` comes before Homebrew Rust in your shell path.
3. Accept the Xcode license on macOS.
4. Use Python 3.11 for old `node-gyp` when building browser assets.

The compatibility scripts install or select the historical Rust toolchain:

```sh
repo_scripts/ensure-rust-toolchain-compat.sh
npm run ensure-tooling -- -q
```

## Build

Run the full local compatibility build:

```sh
npm run build-compat
```

This does two things:

1. Builds browser Rust/WASM and Parcel assets from a temporary no-spaces checkout
   copy.
2. Builds the native debug server with the macOS `.rlib` linker wrapper.

Generated browser assets live in `cb_browser_ui/dist/` and are ignored by git.

## Test And Smoke

Run the current safety net:

```sh
npm run test-compat
```

This runs:

- `npm run test-planning-compat`
- `npm run check-browser-dist-compat`
- `npm run smoke-server-compat`

The server smoke starts `target/debug/citybound`, waits for `/` to return HTTP
`200`, then stops the process through SIGINT.

## Useful Individual Commands

```sh
npm run build-browser-compat
npm run build-server-debug-compat
npm run test-planning-compat
npm run check-browser-dist-compat
npm run smoke-server-compat
```

## Known Local Traps

- The real checkout path contains a space. Old `node-gyp`/Make cannot build
  browser dependencies from that path, so `build-browser-compat` uses a temporary
  no-spaces copy.
- Xcode 26.3 rejects old Rust `.rlib` archives containing `lib.rmeta` and
  `*.bc.z`; the compatibility linker wrapper strips those members from temporary
  copies.
- `cargo fmt -- ./cb_planning/src/lib.rs` currently scans broader workspace
  modules and fails on pre-existing long lines.
- The browser uses the page hostname plus the simulation port templated into
  `window.cbNetworkSettings`; the smoke test checks this for custom local ports.
