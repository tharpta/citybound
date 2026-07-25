# Citybound Revival Branch And Release Policy

GitHub issue: <https://github.com/tharpta/citybound/issues/14>

This policy applies only to `tharpta/citybound`. The original
`citybound/citybound` repository is historical provenance, not a development or
synchronization dependency.

## Permanent Branch Roles

### `main`: default, integration, and release source

`main` is the only permanent development branch. It is:

- the GitHub default branch;
- the pull-request target for accepted issue work;
- the branch on which integrated checks and playable milestone gates run; and
- the sole source of revival release tags.

There is no permanent `develop` or release branch. Short stabilization work
remains issue-scoped and merges back to `main`.

### `master`: frozen original baseline

`master` remains fixed at original Citybound commit
`817de551d2bc96c90d0b7c74af4872454f42b44c`. It exists to make archaeology and
comparisons reproducible.

Do not merge revival work into `master`, reset it, delete it, or use it as a PR
target. The revival does not pull, merge, or automatically synchronize changes
from `citybound/citybound`. Any future use of original or third-party code must
be an explicit, issue-linked import reviewed like any other change.

### Short-lived work branches

After migration, normal work starts from current `main` and uses:

```text
codex/issue-<number>-<short-name>
```

Urgent release repairs use:

```text
codex/hotfix-<number>-<short-name>
```

One branch addresses one primary issue. A pull request targets `main`, links the
issue, records verification, and contains no unrelated work. Existing issue
branches created from `codex/revival-bootstrap` remain traceable through their
issues, commits, and pull requests; they do not need history rewrites merely to
adopt this policy. Until the migration is complete, M0 branches continue to
start from and target `codex/revival-bootstrap`.

## Pull Requests And Merges

- Do not commit issue work directly to `main`.
- Draft pull requests are encouraged for visible work in progress.
- Another role records independent verification before merge.
- Required checks and review conversations must be resolved.
- The integration lead confirms scope, evidence, and a clean merge target.
- Squash merge is the default. Use `<outcome> (#<issue>)` for the squash commit
  title so the integrated commit remains traceable after branch deletion.
- Do not force-push `main`, `master`, or a published release tag.
- Delete a merged short-lived remote branch when it is no longer needed; the
  issue, pull request, and squash commit retain its history.
- Close the issue only after the accepted commit is on `main`.

If a change is too large to review as one squash commit, split it into linked
issues and pull requests rather than creating a special long-lived branch.

## Releases And Tags

A release is an exact, verified commit already on `main`. Release preparation
does not happen through an unreviewed release branch.

- Revival releases use annotated tags:
  `revival-v<major>.<minor>.<patch>`.
- Prereleases append a SemVer suffix, for example
  `revival-v0.1.0-rc.1`.
- The `revival-` prefix distinguishes new releases from the historical
  `v0.1.0` through `v0.3.0` tags.
- The tag annotation links the milestone/release notes and records the verified
  commit.
- Tags are created only after the milestone checks and visible playtest pass.
- Published tags are immutable. Correct a bad release with a new patch or
  prerelease tag rather than moving or replacing the old tag.

M0 may be preserved with the annotated checkpoint tag
`revival-m0-baseline` after its exit review. It is an audit baseline, not a
player release.

## Hotfix Flow

1. Open a P0/P1 bug issue with reproduction and release impact.
2. Branch `codex/hotfix-<number>-<short-name>` from the affected release tag.
3. Implement the smallest repair and add focused regression evidence.
4. Open a pull request to `main`.
5. If `main` has diverged, verify the repair on current `main`; do not merge
   directly into the old tag or maintain a hidden release line.
6. After independent verification and required checks, squash merge to `main`.
7. Run the release gate and create a new patch tag from `main`.

If a supported-release line eventually requires maintenance independent of
`main`, that is a new architecture/process decision and must be approved before
a long-lived maintenance branch is created.

## Free Branch-Protection Expectations

Configure only protections available without payment or trial conversion:

### `main`

- Require a pull request before merging.
- Require the existing free compatibility status check once the zero-cost CI
  policy confirms its exact check name and budget.
- Require conversation resolution.
- Block force pushes and branch deletion.
- Do not permit bypass as the normal workflow.

Do not require a GitHub approval count while the repository has only one GitHub
review identity. Independent agent/role verification is recorded in the pull
request. Enable a required approving review later when a distinct reviewer can
provide it without purchasing a plan.

### `master`

- Block force pushes and deletion.
- Do not accept pull requests or direct development.

Use repository branch protection, not paid organization rulesets or billable
automation. If GitHub presents a payment method, trial, or uncertain billing
impact, stop and obtain the product owner's approval.

## Migrating From `codex/revival-bootstrap`

`codex/revival-bootstrap` remains the M0 integration branch until the migration
below is verified:

1. Finish or explicitly retarget every open M0 pull request so no accepted work
   is stranded.
2. Complete the M0 exit review and identify its accepted integration commit.
3. Create `main` at that exact commit and push it without rewriting history.
4. Change the GitHub default branch to `main`.
5. Link this policy from the repository and configure the free protections
   above.
6. Confirm CI runs on a pull request targeting `main`.
7. Retarget open issue work to `main`; create all new branches from `main`.
8. Optionally add `revival-m0-baseline` to the verified M0 commit.
9. Mark `codex/revival-bootstrap` read-only in project documentation.

Keep `codex/revival-bootstrap` until all open branches and pull requests have
been checked and the default-branch migration is visible on GitHub. Afterward,
it may remain as an archived remote reference or be deleted through a separate,
explicitly approved housekeeping issue. Never delete it as part of the
migration itself.

## Traceability Checks

Before considering the migration complete:

- `main` points at the accepted M0 history without a force push;
- `master` still points at `817de55`;
- all open pull requests target `main`;
- each active issue links its branch or pull request;
- the compatibility workflow runs for `main` pull requests;
- release/checkpoint tags resolve to commits reachable from `main`; and
- no build, test, or release command depends on fetching the original
  Citybound repository.
