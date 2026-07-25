# Compatibility Workaround Audit

Status: M0 evidence in progress. This document describes current behavior; it
does not approve the workaround as permanent architecture.

## Trust Levels

- `CONTAINED`: mutation is limited to a validated temporary location.
- `LOCAL MUTATION`: changes generated output or configuration in the checkout.
- `HOST MUTATION`: installs or changes tools outside the checkout.
- `INVESTIGATE`: behavior or portability needs more evidence.

## Historical Rust Toolchain

Files:

- `repo_scripts/ensure-rust-toolchain-compat.sh`
- `repo_scripts/tooling.js`

Trigger: original Citybound requires `nightly-2020-03-10`, and modern stable
Rust cannot compile the storage stack.

Current behavior:

- Installs the historical target toolchain with `rustup` when missing.
- Sets a directory-specific Rust override in the checkout.
- `tooling.js` also adds historical rustfmt/clippy components.

Classification: `LOCAL MUTATION` and `HOST MUTATION`.

Risks:

- A check command changes developer configuration instead of only reporting it.
- The shell helper advertises Darwin, Linux, and Windows triples, while adjacent
  build scripts contain macOS-specific assumptions.
- The old toolchain is unsupported and must not be exposed to untrusted crates
  or inputs casually.

Exit condition:

- Separate read-only verification from an explicit one-time bootstrap command.
- Pin and document the supported compatibility host/container.
- Remove the override when all production crates build on a supported toolchain.

## Cargo-Web Bootstrap

File: `repo_scripts/tooling.js`

Trigger: the browser uses `cargo-web 0.6.24` and `stdweb`.

Current behavior:

- Downloads a prebuilt executable with `curl` on macOS/Linux.
- Writes it into `~/.cargo/bin`.
- Does not verify a checksum or signature.
- Uses a shell pipeline and global destination outside the repository.

Classification: `HOST MUTATION`; modernization priority `HIGH`.

Risks:

- Network download is executed as development tooling without integrity
  verification.
- A normal build can unexpectedly modify the user's global Cargo tools.
- Availability depends on an old GitHub release artifact.

Exit condition:

- Immediate containment: explicit bootstrap plus verified checksum in a
  project-owned tools directory or reproducible container.
- Final removal: replace `cargo-web`/`stdweb` after the browser boundary is
  characterized and covered by tests.

## No-Spaces Browser Build Copy

File: `repo_scripts/build-browser-compat.sh`

Trigger: old Node-gyp/Make tooling fails when the checkout path contains spaces.

Current behavior:

- Selects Python with `distutils`.
- Recursively deletes and recreates
  `CITYBOUND_COMPAT_BUILD_ROOT` (defaulting under the temporary directory).
- Copies the source tree without Git, targets, modules, or browser distribution.
- Hardcodes `nightly-2020-03-10-x86_64-apple-darwin` inside the copy.
- Builds dependencies and browser output in that copy.
- Deletes and recreates the real checkout's ignored `cb_browser_ui/dist`.

Classification: mostly `CONTAINED`, with deliberate `LOCAL MUTATION` of ignored
browser output.

Positive controls:

- Rejects an empty path, `/`, the repository root, and paths containing spaces.
- Excludes the original Git metadata and build caches.

Risks:

- The custom build-root check does not prove that an arbitrary caller-provided
  path is disposable.
- Platform handling is inconsistent with the broader compatibility scripts.
- `npm install` executes historical package lifecycle scripts.
- Rebuilding replaces the entire local browser distribution.

Exit condition:

- Short term: use a unique temporary directory by default, document destructive
  targets, and make platform support honest.
- Final removal: supported Node/WASM tooling builds directly from ordinary
  checkout paths.

## Legacy Archive Linker Wrapper

File: `repo_scripts/cc-strip-rmeta.sh`

Trigger: the modern Apple linker rejects metadata and compressed bitcode members
inside archives produced by the 2020 Rust toolchain.

Current behavior:

- Copies affected `.rlib` files to a unique temporary directory.
- Deletes `lib.rmeta` and `*.bc.z` members from the copies.
- Passes rewritten arguments to `/usr/bin/cc` or `REAL_CC`.
- Deletes temporary copies on exit.

Classification: `CONTAINED`, but `INVESTIGATE`.

Positive controls:

- Does not rewrite Cargo's original libraries.
- Uses a unique temporary directory and an exit trap.

Risks:

- `ar -d` failures are ignored.
- The wrapper assumes removed members are never required for the final link.
- It is an Apple-specific compatibility technique without a behavioral
  equivalence test beyond successful build/startup.

Exit condition:

- Remove when the relevant crates compile with a supported Rust toolchain, or
  replace with a reproducible compatibility container using a matching linker.

## Server And Browser Smoke Tests

Files:

- `repo_scripts/smoke-server-compat.sh`
- `repo_scripts/smoke-browser-compat.mjs`

Current behavior:

- Creates temporary cities unless an explicit city path is supplied.
- Starts the real debug server on loopback ports.
- Browser smoke launches Chrome headlessly and verifies WASM/UI/network turns.
- Cleanup attempts graceful shutdown, then may force-kill the server.

Classification: generally `CONTAINED`.

Risks and limits:

- The browser smoke requires an installed or Playwright-provided browser.
- Headless success is not a substitute for a visible manual gameplay run.
- Assertions prove startup and advancing networking turns, not correct
  simulation behavior.
- Explicit caller-provided city/log paths are preserved or overwritten according
  to individual script behavior and require documentation.

Exit condition:

- Keep these tests, but complement them with a visible M0 runtime record and
  later player-loop regression scenarios.

## Save/Reload Smoke

File: `repo_scripts/smoke-save-reload-compat.sh`

Current behavior:

- Creates a unique temporary city.
- Starts, gracefully stops, and restarts the server.
- Requires core actor files, a minimum file count, successful simulation logs,
  and no disappearance from the path inventory.
- Deletes its temporary working directory afterward.

Classification: `CONTAINED`.

What it proves:

- A new persisted actor store is created.
- The current binary can reopen it after a clean shutdown.
- Expected core files exist and the second run does not remove initial paths.

What it does not prove:

- Gameplay state values survive unchanged.
- Roads, zones, buildings, households, or traffic survive reload correctly.
- Saves from original or earlier revival versions remain compatible.
- Actor layouts are forward-compatible.

Exit condition:

- Retain as a startup smoke.
- Add a fixture with known player-created state and semantic assertions before
  claiming save compatibility.

## Codegen Check

File: `repo_scripts/check-codegen-compat.sh`

Current behavior:

- Copies source into a configured check directory.
- Regenerates 44 `kay_auto.rs` files there.
- Requires identical path sets and byte-for-byte output.

Classification: mostly `CONTAINED`, with toolchain `LOCAL/HOST MUTATION`.

Risks:

- The default check directory is stable rather than uniquely created.
- `rsync --delete` makes the configured directory explicitly destructive.
- It invokes the toolchain helper, which sets an override in the real checkout.
- A fixed expected count can detect drift but also requires intentional updates.

Exit condition:

- Use a unique temporary directory and a read-only toolchain preflight.
- Keep byte-for-byte generation verification while Kay codegen remains.
