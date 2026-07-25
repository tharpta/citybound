# Citybound Revival Agile Operating Agreement

GitHub Issues are the source of truth for scope, acceptance, discussion,
evidence, and closure. The
[Citybound Revival GitHub Project](https://github.com/users/tharpta/projects/1)
is the sole live source for flow status and priority. Use continuous-flow
Kanban during M0, then one-week playable iterations from M1 onward.

## Roles

- Product owner: the user owns product direction and irreversible architecture
  decisions.
- Integration/technical lead: owns coherence, integration, queue health, and
  milestone readiness.
- Platform engineer: build, dependencies, browser, CI, and compatibility.
- Simulation/gameplay engineer: runtime behavior and playable vertical slices.
- QA/reliability: independently verifies acceptance criteria and evidence.
- Producer/Scrum master: maintains issue quality, dependencies, WIP, and
  blocker visibility without creating a second requirements source.

An agent may fill more than one role, but an implementer does not independently
verify its own work.

## Zero-Cost Guardrail

Revival work must not create new monetary cost without the product owner's
explicit approval immediately before the billable action.

- Prefer local execution, existing hardware, open-source tooling, and free
  GitHub features.
- Do not provision any paid or billable runners, hosted environments, storage,
  databases, domains, APIs, models, marketplace products, or SaaS plans.
- A free-tier service is allowed only when it requires no payment method, cannot
  automatically convert to billing, and stays within documented free quotas.
  Otherwise, stop for approval.
- Do not enable billable GitHub features or purchase licenses.
- Agent parallelism must be purposeful because session or agent metering may not
  be visible from the repository.
- If pricing, quota, trial conversion, or billing impact is uncertain, treat the
  action as paid and stop for approval.

## Flow And WIP

- Maximum two active implementation/audit issues.
- Maximum one additional issue in review.
- Maximum one active issue touching actor identity, codegen, persistence layout,
  network serialization, or workspace-wide dependencies.
- Clear review before dispatching more work.
- Quarantined work cannot be extended.

`Never stop` means pull the next highest-priority ready issue when capacity
opens. It does not mean coding through an unresolved architecture or safety
gate.

## Priority And Pull Order

Project priority is assigned from current evidence and is not duplicated in
labels or local documents:

- `P0`: immediate existential blocker—data loss/corruption, security or
  monetary exposure, broken integration, or inability to start the playable
  build. P0 interrupts lower-priority work.
- `P1`: current-milestone blocker or high player impact.
- `P2`: important improvement that does not block the current milestone or
  playable loop.
- `P3`: optional research, polish, cleanup, or deferred opportunity.

The integration/technical lead assigns and revises priority using dependencies,
player impact, save/architecture risk, and cost risk. The product owner may
override any priority. Pull the highest-priority `Ready` issue first. Within one
priority, prefer the issue that unblocks the most other work, then the oldest
ready issue. A blocked issue does not consume an implementation slot; record the
blocker and pull the next highest-priority ready item.

## Definition Of Ready

An issue is ready when it has one observable outcome, scope and non-goals,
acceptance criteria and verification, resolved dependencies, a named role,
identified risks, and no unresolved product or architecture choice.

## Definition Of Done

An issue is done when acceptance criteria have linked evidence, relevant checks
pass, visible behavior has manual evidence, another role verifies the result,
documentation is current, follow-ups have separate issues, and the accepted
commit is on the integration branch without unrelated changes.

Audit issues may complete with evidence and decisions rather than code.

Architecture changes at shared or hard-to-reverse boundaries require an
accepted [Architecture Decision Record](adr/README.md) before implementation.
The ADR preserves the decision and tradeoffs; its GitHub issue remains the
source of truth for delivery and verification.

## Branch And Pull Request Traceability

The permanent branch, merge, release, hotfix, and migration rules are defined
in [the branch and release policy](BRANCH_AND_RELEASE_POLICY.md).

Every nontrivial change starts from a GitHub issue and uses:

```text
codex/issue-<number>-<short-name>
```

The branch is pushed at creation or at its first coherent checkpoint. The issue
links to the branch and pull request; the pull request links back to the issue.
Another role records verification before merge. The issue closes only after the
accepted commit is present on the integration branch.

`main` is the permanent default and integration branch. During M0,
`codex/revival-bootstrap` remains the temporary integration target until the
verified migration in the branch policy is complete. Agents do not commit
unrelated issue work directly to either integration target.

## Cadence

During M0, continuously pull from ready, review integration state daily, provide
a weekly user-facing audit/demo summary, and hold an exit review before risky
modernization. From M1, use one-week iterations ending in a playable demo,
verification, and retrospective.

## M0 Order

1. Verify provenance and compatibility evidence (#1 and #3).
2. Audit Rust/engine and browser dependencies in parallel (#2 and #4).
3. Establish the visible runtime baseline (#5).
4. Audit generated code and persistence after dependency/tooling evidence (#6).
5. Decide the quarantined Bevy experiment last (#7).
