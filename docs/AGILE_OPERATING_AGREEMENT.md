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

## Status Contract

Each issue has exactly one live Status in the GitHub Project:

- `Backlog`: accepted work that is not currently pullable. Scope, evidence,
  priority, dependencies, or a required decision may still be incomplete.
- `Ready`: fully satisfies the Definition of Ready and may be pulled next.
  Nobody is implementing or auditing it yet; `Ready` does **not** mean in
  progress.
- `Active`: implementation or audit work is actively underway. The issue owns a
  WIP slot and must have a named issue branch or linked evidence checkpoint.
- `Review`: the implementer believes the acceptance criteria are met and a
  different role is reviewing the change and evidence. Review findings return
  the issue to `Active`.
- `Verified`: an independent role has confirmed the acceptance criteria and
  evidence. Required changes are accepted, but merge/integration or closure
  bookkeeping may still remain.
- `Blocked`: progress cannot continue because of a named dependency, missing
  decision, unavailable capability, or external state. The issue records the
  blocker and the condition that will unblock it, and it does not consume an
  implementation WIP slot.
- `Done`: the Definition of Done is satisfied, the accepted change is present
  on the integration branch, and the GitHub issue is closed.

The integration lead changes Status from current evidence, never from expected
future work. An open issue cannot be `Done`; an issue closed as completed must
be `Done`. An issue closed as duplicate, not planned, or invalid is removed from
the active Project after its non-delivery resolution is recorded; it does not
claim `Done`. Reopening an issue returns it to `Backlog` until readiness is
reassessed.

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

## Branch And Pull Request Traceability

Every nontrivial change starts from a GitHub issue and uses:

```text
codex/issue-<number>-<short-name>
```

The branch is pushed at creation or at its first coherent checkpoint. The issue
links to the branch and pull request; the pull request links back to the issue.
Another role records verification before merge. The issue closes only after the
accepted commit is present on the integration branch.

`codex/revival-bootstrap` is the M0 integration branch until the revival adopts
a release/default-branch policy. Agents do not commit unrelated issue work
directly to it.

## Cadence

During M0, continuously pull from ready, review integration state daily, provide
a weekly user-facing audit/demo summary, and hold an exit review before risky
modernization. From M1, use one-week iterations ending in a playable demo,
verification, and retrospective. Follow the
[M1+ Weekly Iteration Playbook](ITERATION_PLAYBOOK.md) for goal selection, WIP,
the midpoint integration checkpoint, clean close checks, carryover, and the
user-facing build summary.

## M0 Order

1. Verify provenance and compatibility evidence (#1 and #3).
2. Audit Rust/engine and browser dependencies in parallel (#2 and #4).
3. Establish the visible runtime baseline (#5).
4. Audit generated code and persistence after dependency/tooling evidence (#6).
5. Decide the quarantined Bevy experiment last (#7).
