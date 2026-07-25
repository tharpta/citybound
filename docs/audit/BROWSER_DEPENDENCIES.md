# M0 Browser And Frontend Dependency Audit

GitHub issue: <https://github.com/tharpta/citybound/issues/4>

Status: evidence collected; requires independent verification.

## Findings

- The root npm dependency graph is minimal and modern: Node 20+ and
  `playwright-core` 1.62.0. Root scripts also orchestrate and mutate the
  historical compatibility environment.
- `cb_browser_ui` is a separate historical dependency world with a v1 lockfile
  containing 956 dependency entries/occurrences reported by its lockfile audit;
  they are not currently installed in this checkout.
- Browser builds use `npm install`, not a frozen install path.
- Inference from the build scripts: Parcel 1.12.4, TypeScript 3.8.3, Less 3.8.1,
  `cargo-web`, and `stdweb` form one coupled boundary. The npm build runs
  cargo-web before Parcel consumes HTML/TS/Less and the stdweb WASM output, so
  Parcel must not be swapped in isolation.
- The compatibility wrapper preserves a Python/distutils workaround for a
  previously observed Parcel-era Node-gyp/Make build failure.
- On 2026-07-24, `npm audit --package-lock-only --json` from `cb_browser_ui`
  reported 117 vulnerable dependency entries against the current npm advisory
  service: 12 critical, 46 high, 55 moderate, and 4 low. Most are transitive or
  build-time; this calls for containment and staged replacement, not
  `npm audit fix`.
- React/ReactDOM 16.8.6 and Ant Design 3.19.2 need visual coverage before upgrade.
- Static authored-source search found no use of `react-addons-update` or
  `msgpack-lite`; clean-build/runtime proof is still required before removal.
- Monet is core renderer code pinned to git commit `5b79f29`; mirror/fork or
  vendor it before major browser changes.
- Authored browser source currently contains no automatic fetch/XHR/analytics
  calls. Remaining outbound links should be reviewed for revival identity.
- `tooling.js` downloads `cargo-web` without integrity verification and installs
  it globally.

## Provisional Sequence

1. Contain the historical build and record a Node/npm matrix.
2. Verify or mirror the `cargo-web` artifact.
3. Prove and remove unused direct dependencies.
4. Own Monet and characterize its contract.
5. Introduce a tested `wasm-bindgen` adapter.
6. Replace Parcel.
7. Upgrade React and Ant Design deliberately.

Do not automatically fix or hand-deduplicate this transitive graph; replace
obsolete roots behind tested boundaries.
