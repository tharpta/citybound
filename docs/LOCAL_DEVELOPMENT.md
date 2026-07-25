# Local Development

These are the currently verified revival commands for this fork.

## First-Time Setup

1. Install Node.js 20 or newer and run `npm install` at the repository root.
2. Install `rustup`.
3. Make sure `~/.cargo/bin` comes before Homebrew Rust in your shell path.
4. Accept the Xcode license on macOS.
5. Use Python 3.11 for old `node-gyp` when building browser assets.

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
- `npm run check-codegen-compat`
- `npm run check-browser-dist-compat`
- `npm run smoke-server-compat`
- `npm run smoke-save-reload-compat`
- `npm run smoke-browser-compat`

The server smoke starts `target/debug/citybound`, waits for `/` to return HTTP
`200`, then stops the process through SIGINT.

The save-reload smoke starts one temporary city twice. It verifies that the
first boot creates the mmap actor files, both boots reach a running simulation
and stop safely, and the reload preserves every file created by the first boot.
It also guards the watcher state that must be rebuilt instead of persisted.

The codegen check copies source into a temporary no-spaces checkout, runs the
locked `kay_codegen 0.3.10` over all five Citybound crates, and compares all 44
committed `kay_auto.rs` files byte-for-byte. It never regenerates files in the
working checkout.

The browser smoke starts another isolated server and temporary city, launches a
headless Chromium browser, and verifies:

- the Rust/WASM client starts
- the WebGL canvas has a nonzero rendered size
- the configured simulation port reaches the browser
- browser and server networking turns advance
- no page or console errors are reported

The smoke uses Playwright's cached Chromium when available and otherwise uses an
installed Google Chrome. Set `CITYBOUND_BROWSER_EXECUTABLE` to use another
Chromium executable or `CITYBOUND_BROWSER_CHANNEL` to select another installed
Playwright browser channel.

## Useful Individual Commands

```sh
npm run audit-dependencies-readonly
npm run build-browser-compat
npm run build-server-debug-compat
npm run test-planning-compat
npm run check-codegen-compat
npm run check-browser-dist-compat
npm run smoke-server-compat
npm run smoke-save-reload-compat
npm run smoke-browser-compat
```

The dependency inventory is offline and read-only by default. To add a
time-dependent npm advisory lookup without installing packages, running
lifecycle scripts, or applying fixes:

```sh
CITYBOUND_AUDIT_ONLINE=1 npm run audit-dependencies-readonly
```

## Continuous Integration

Repository automation follows the [zero-cost CI policy](CI_POLICY.md). Pull
requests run one focused Linux planning check; redundant branch-push runs and
the historical three-platform release matrix are intentionally disabled.

## Known Local Traps

- The real checkout path contains a space. Old `node-gyp`/Make cannot build
  browser dependencies from that path, so `build-browser-compat` uses a temporary
  no-spaces copy.
- Xcode 26.3 rejects old Rust `.rlib` archives containing `lib.rmeta` and
  `*.bc.z`; the compatibility linker wrapper strips those members from temporary
  copies.
- The modern root smoke tooling requires Node.js 20 or newer. The legacy
  Parcel/React dependencies remain isolated under `cb_browser_ui`.
- `cargo fmt -- ./cb_planning/src/lib.rs` currently scans broader workspace
  modules and fails on pre-existing long lines.
- The browser uses the page hostname plus the simulation port templated into
  `window.cbNetworkSettings`; the smoke test checks this for custom local ports.
