# M0 Browser And Frontend Dependency Audit

GitHub issue: <https://github.com/tharpta/citybound/issues/4>

Status: evidence collected; requires independent verification.

## Findings

- The root Node project is modern orchestration only: Node 20+ and
  `playwright-core` 1.62.0.
- `cb_browser_ui` is a separate historical dependency world with a v1 lockfile
  and roughly 956 installed dependencies.
- Browser builds use `npm install`, not a frozen install path.
- Parcel 1.12.4, TypeScript 3.8.3, Less 3.8.1, `cargo-web`, and `stdweb` form one
  coupled boundary. Parcel must not be swapped in isolation.
- Historical native lifecycle code runs through Parcel-era Node-gyp
  dependencies.
- A read-only package-lock audit reported 117 vulnerable packages: 12 critical,
  46 high, 55 moderate, and 4 low. This calls for containment and staged
  replacement, not `npm audit fix`.
- React/ReactDOM 16.8.6 and Ant Design 3.19.2 need visual coverage before upgrade.
- `react-addons-update` and `msgpack-lite` appear unused and require clean-build
  proof before removal.
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
