# M1+ Weekly Iteration Playbook

GitHub issue: <https://github.com/tharpta/citybound/issues/17>

Citybound Revival uses one-week iterations from M1 onward. The GitHub Project
is the live source for iteration, status, and priority; this document defines
the repeatable close procedure.

## Iteration Goal

Each iteration has exactly one observable player outcome, written as:

> By the demo, a player can **[action]** and observe **[result]** in a clean
> local build.

Supporting platform, test, and documentation issues are included only when they
directly enable or protect that outcome. Subsystem activity alone is not an
iteration goal.

## Start And WIP

At iteration start:

1. The product owner confirms the player outcome.
2. The integration lead assigns the current Project iteration only to issues
   that satisfy the Definition of Ready.
3. Pull work by Project priority and dependency-unblocking value.
4. Respect the operating agreement's limits: at most two active
   implementation/audit issues, one additional issue in review, and one active
   shared-boundary risk issue.

Blocked work moves to `Blocked`, records its dependency in the issue, and frees
its WIP slot. Do not pull extra scope merely to fill an iteration.

## Integration Checkpoint

By the midpoint of the week, every active issue must have one of:

- a draft PR against the integration branch with its current checkpoint pushed;
- linked evidence that the audit is progressing; or
- `Blocked` status with the exact dependency and next decision recorded.

The integration lead reviews combined behavior, save/architecture impact, and
the remaining path to the player outcome. Work that cannot credibly reach
review is narrowed through the issue or removed from the current iteration.

## Iteration Close

Run the close on a clean integration checkout:

- [ ] All accepted issue commits are present on the integration branch.
- [ ] `npm run build-compat` passes.
- [ ] `npm run test-compat` passes.
- [ ] The visible game starts from a fresh city without an unexpected error.
- [ ] The iteration's player action and observable result are demonstrated.
- [ ] Relevant save/reload behavior is exercised when persistent state changed.
- [ ] Browser and server logs are checked for new errors.
- [ ] Known regressions, blocked checks, and accepted risks link to issues.
- [ ] A second role verifies the demo evidence and issue acceptance.
- [ ] The user-facing build summary is posted.

The demo must use a visible local game window and the exact integration build
being summarized. A headless smoke test supplements the demo but does not
replace it. Retain screenshots, logs, or a short recording when they materially
prove the outcome.

## Carryover

An issue is complete only when it meets the Definition of Done. At close:

- independently verify accepted work, merge it to the integration branch, close
  its issue as completed, and confirm the Project automation moved it to
  `Done`;
- move every unfinished issue out of the ended iteration and explicitly back to
  `Backlog`, or to `Blocked` when an unresolved dependency remains;
- preserve its evidence, remaining acceptance criteria, and blocker;
- reassess its priority before assigning it to a future iteration.

There is no automatic carryover. Reassignment is a new planning decision, not a
way to describe unfinished work as delivered.

## User-Facing Build Summary

Use this format:

```markdown
# Citybound Revival — Iteration <number>

Goal: <one observable player outcome>
Build: <integration commit/tag and branch>

## Player-visible result
<What can be done and seen, with evidence links>

## Verification
- Build: PASS/FAIL — <command/evidence>
- Tests: PASS/FAIL — <command/evidence>
- Visible demo: PASS/FAIL — <evidence>
- Save/reload when relevant: PASS/FAIL/NOT APPLICABLE — <evidence>

## Known regressions and accepted risks
- <linked issue, impact, owner/next decision>

## Not delivered
- <unfinished issue moved to Backlog/Blocked and why>

## Next recommendation
<highest-priority ready player outcome>
```
