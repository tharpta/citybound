# Citybound Revival Work Queue

GitHub Issues are the authoritative execution queue:

<https://github.com/tharpta/citybound/issues>

`REVIVAL_PLAN.md` defines direction. This file defines the assignment format and
keeps a lightweight milestone index for local/offline use. The Citybound Revival
GitHub Project is the sole live source for Status and Priority; neither field nor
current ownership is duplicated here.

Use the
[Citybound Revival Project](https://github.com/users/tharpta/projects/1)
for live triage, priority, iteration, and workflow status. Its setup is tracked
by [issue #12](https://github.com/tharpta/citybound/issues/12).

## M0 GitHub Issues

- [M0-01: Establish provenance and classify revival commits](https://github.com/tharpta/citybound/issues/1)
- [M0-02: Audit compatibility workarounds and trusted commands](https://github.com/tharpta/citybound/issues/3)
- [M0-03: Audit Cargo and aeplay engine dependencies](https://github.com/tharpta/citybound/issues/2)
- [M0-04: Audit npm, browser tooling, and external services](https://github.com/tharpta/citybound/issues/4)
- [M0-05: Establish visible runtime and gameplay baseline](https://github.com/tharpta/citybound/issues/5)
- [M0-06: Audit generated actor glue and persistence compatibility](https://github.com/tharpta/citybound/issues/6)
- [Quarantined: Review Bevy ECS replacement experiment](https://github.com/tharpta/citybound/issues/7)

## Status Flow

`BACKLOG -> READY -> ACTIVE -> REVIEW -> VERIFIED -> DONE`

A task can move to `BLOCKED` only with a recorded blocker and the evidence
needed to resume it. At most one task that edits a shared architectural boundary
may be active at a time.

## Assignment Template

Each task must include:

- milestone and dependencies
- one observable goal
- allowed scope and explicit non-goals
- acceptance criteria
- automated and manual verification
- handoff branch, commit, findings, and risks

Issue scope, acceptance criteria, dependencies, and evidence live in each
GitHub Issue. This file intentionally contains no live Ready/Active/Review
sections.
