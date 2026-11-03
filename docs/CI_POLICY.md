# Zero-Cost CI Policy

GitHub issue: <https://github.com/tharpta/citybound/issues/18>

Status: implemented for the repository's current public visibility.

## Policy

Citybound Revival intentionally uses only standard GitHub-hosted runners while
the repository is public. GitHub documents those runners as free for public
repositories. Larger runners are never allowed by this policy: GitHub bills
them even for public repositories.

Automated jobs have a repository-visibility guard and skip if the repository is
private. Changing repository visibility, enabling a larger runner, adding paid
storage, enabling a billable external service, or changing an Actions spending
limit is blocked until the product owner explicitly approves the specific
action and expected maximum cost.

When cost behavior is uncertain, run the check locally. Do not add a payment
method, raise a budget, or assume that an included quota authorizes spending.
The repository does not use CI solely to synchronize GitHub Project fields.

Official references, verified on 2026-07-24:

- [GitHub Actions billing and free use](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)
- [Workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [Approving workflow runs from forks](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks)
- [Repository Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- [Workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)

GitHub's current policy is:

- Standard GitHub-hosted runners are free in public repositories.
- Private repositories receive plan-dependent included minutes and storage;
  usage beyond those allowances can be billed to the repository owner.
- Larger runners are always billable, including for public repositories.
- Actions minutes are charged to the repository owner, not the person who
  triggered a workflow.

These are service rules, not permanent guarantees. Re-check the official
documentation before expanding CI or if repository visibility changes.

## Workflow Inventory And Expected Usage

| Workflow | Trigger | Runner/jobs per event | Expected use | Cost control |
| --- | --- | --- | --- | --- |
| `Revival Compatibility` | Pull request; push to `main` or `master`; manual dispatch | Two standard `ubuntu-latest` jobs | One offline/unit compatibility job capped at 5 minutes and one locked Rust planning/codegen job capped at 15 minutes per event | Public-only guards, least-privilege token, per-PR/ref cancellation |
| `Legacy Release Build Probe` | Manual dispatch only, with explicit product-owner approval acknowledgment | One standard `ubuntu-latest` job | At most one legacy compatibility probe per deliberate dispatch, capped at 45 minutes | Public-only guard, manual approval, cancellation, no matrix |

The compatibility workflow no longer runs on every `codex/**` push. A branch
with a pull request was previously eligible for both a push run and a pull
request run testing the same commit. Pull requests are now the development
branch gate; direct automation remains only for protected integration branches.

Concurrency groups include the workflow name so unrelated workflows cannot
cancel each other. A newer run for the same pull request or ref cancels the
older in-progress run.

The historical Cargo client uses the runner's maintained Git executable for
registry and git dependency fetches (`CARGO_NET_GIT_FETCH_WITH_CLI=true`).
Cargo 1.43's bundled libgit2 repeatedly produced zlib/index read failures on
current runners; using system Git avoids repeated failed jobs without adding a
cache, service, runner, or cost.

The planning job separates locked dependency retrieval from compilation and
tests. Dependency fetch receives at most three attempts; after a failed attempt,
CI removes only the ephemeral runner's crates.io registry index before retrying.
Once retrieval succeeds, planning tests run with `--locked --offline`, then the
committed actor glue is regenerated and compared with `CARGO_NET_OFFLINE=true`.
Compilation and tests are never retried or hidden, and GitHub annotations state
which phase failed. The separate 5-minute job runs the bounded, offline
toolchain/linker/teardown regressions and the pure Node compatibility contracts.
Neither job runs a legacy browser lifecycle script or starts the real game.

### `npm run test-compat` disposition

The umbrella command combines tests with checks that require a locally built
legacy browser/server and, in two cases, a real browser. Its components have
these acceptance paths; a green hosted run is **not** a claim that the local
runtime checks passed.

| Component | Accepted-change gate | Reason |
| --- | --- | --- |
| `test-first-town-continuity` | Hosted, 5-minute job | Pure Node fixture and recovery-contract tests |
| `test-town-summary` | Hosted, 5-minute job | Pure Node town-feedback test |
| `test-town-trips` | Hosted, 5-minute job | Pure Node traffic-feedback test |
| `test-runtime-teardown-compat` | Hosted, 5-minute job | Bounded fake-child teardown tests; already gated |
| `test-road-reload-geometry` | Hosted, 5-minute job | Pure Node geometry-comparison test |
| `test-planning-compat` | Hosted, 15-minute job | Locked Rust planning tests; already gated |
| `check-codegen-compat` | Hosted, 15-minute job | Byte-identical regeneration after the existing locked dependency fetch; no second fetch |
| `check-browser-dist-compat` | Local/runtime evidence | Requires the legacy browser distribution build |
| `smoke-server-compat` | Local/runtime evidence | Requires the built native server and browser distribution |
| `smoke-save-reload-compat` | Local/runtime evidence | Requires the native server and a disposable mmap city |
| `smoke-road-reload-compat` | Local/runtime evidence | Requires built assets, native server, and headless Chromium |
| `smoke-zone-reload-compat` | Local/runtime evidence | Requires built assets, native server, and headless Chromium |

For any accepted PR that changes runtime, browser, gameplay, save/reload, or
their build path, the PR's **Runtime compatibility evidence** section must link
to a comment or document recording the exact head SHA, relevant local command
and result, and visible browser evidence for affected gameplay. A reviewer
must hold acceptance if this link is absent or the evidence is for a different
head. For changes that cannot affect these paths, the author must state
`Not applicable` and a short scope reason. The local path may use
`npm run test-compat` after `npm run build-compat`, or list the relevant
component commands; do not imply all runtime components ran from a partial
command. Disposable save paths and teardown failures must be reported, not
hidden by rerunning. This is a review/acceptance requirement, not a claim that
GitHub Actions executed the historical browser stack.

The planning job visibly sets `CITYBOUND_ALLOW_TOOLCHAIN_MUTATION=1` because a
standard hosted runner is ephemeral and may need the repository-pinned
`nightly-2020-03-10` toolchain. Local trusted commands remain non-mutating by
default, and the workflow does not authorize npm lifecycle scripts or the
disabled cargo-web binary bootstrap.

The legacy AppVeyor configuration is explicitly inert. Its former Windows
build directly executed historical npm lifecycle scripts, downloaded host
tooling, and deployed to an external S3 bucket. Those paths are not part of the
zero-cost revival gate and must not be re-enabled without separate product-owner
authorization, safe-install containment, and current cost/provenance evidence.

GitHub-maintained JavaScript actions use their Node 24 releases:
`actions/checkout@v6` and `actions/setup-node@v6`. The project test environment
remains Node 20 for compatibility, and setup-node package-manager caching is
explicitly disabled so this workflow does not create cache storage.

## Matrix Decision

The legacy workflow previously launched Linux, Windows, and macOS jobs for each
manual dispatch. There is no current cross-platform release acceptance test,
the compatibility scripts are primarily verified on macOS locally, and the
historical workflow has not established that all three hosted environments
produce usable artifacts.

The three-run matrix is removed. The remaining Linux job is a manually approved
probe, not a release guarantee. Cross-platform CI may return only after each
platform has:

1. a documented release requirement,
2. a deterministic supported build,
3. a bounded verification check, and
4. product-owner approval after current billing behavior is re-verified.

Until then, macOS compatibility is verified locally and Windows is not claimed
as supported.

## Pull Requests, Forks, And Untrusted Code

The pull-request job executes repository scripts from the proposed revision.
Treat all fork code, dependency manifests, build scripts, and workflow changes
as untrusted.

The workflow therefore:

- uses `pull_request`, never `pull_request_target`;
- declares only `contents: read` for `GITHUB_TOKEN`;
- persists no checkout credentials;
- references no repository or environment secrets;
- uploads no artifacts or caches; and
- performs only the bounded offline/unit compatibility checks and the locked
  planning/codegen checks listed above.

GitHub may hold public-fork workflows for maintainer approval. Configure
**Settings → Actions → General → Approval for running fork pull request
workflows from contributors** to require approval for all external
contributors. Before approval, inspect the entire diff, with special attention
to `.github/workflows`, `package.json`, `repo_scripts`, Cargo manifests, and
build scripts.

Do not add `pull_request_target` to run contributor code. It uses the base
repository context and can carry write permissions or secrets, making an
unsafe checkout or script invocation materially more dangerous.

## Product-Owner Approval Gate

The legacy build probe requires the dispatcher to affirm that the product owner
approved that run. This is an audit prompt, not an identity system; repository
write access still controls who can dispatch workflows.

Any proposed action with unclear or potentially billable behavior must stop
before execution. Record:

1. the service and operation,
2. why local verification is insufficient,
3. the pricing source and worst-case cost,
4. the duration or usage cap, and
5. the product owner's explicit approval.

Without all five, the action stays local or blocked.

## Required Repository Setting

Workflow files cannot enforce the account-level spending limit or the external
contributor approval policy. The product owner must verify these settings in
GitHub:

1. In **Settings → Actions → General**, require approval for all external
   contributors.
2. In the account billing settings, keep the Actions budget/spending limit at
   zero and do not enable paid larger runners.
3. Revisit both settings before making the repository private or transferring
   it to an organization.
