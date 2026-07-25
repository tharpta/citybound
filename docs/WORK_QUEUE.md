# Citybound Revival Work Queue

This is the authoritative execution queue. `REVIVAL_PLAN.md` defines direction;
this file defines the bounded work currently ready for an agent.

## Status Flow

`BACKLOG -> READY -> ACTIVE -> REVIEW -> VERIFIED -> DONE`

A task can move to `BLOCKED` only with a recorded blocker and the evidence
needed to resume it. At most one task that edits a shared architectural boundary
may be active at a time.

## Assignment Template

Each task must include:

- milestone, owner, status, and dependencies
- one observable goal
- allowed scope and explicit non-goals
- acceptance criteria
- automated and manual verification
- handoff branch, commit, findings, and risks

## Active

### M0-01: Establish provenance and classify revival commits

- Owner: integration lead
- Status: REVIEW
- Dependencies: none
- Goal: identify the verified fork point and classify every post-fork commit.
- Scope: Git history and `docs/audit/`.
- Non-goals: reverting commits, rewriting history, or changing gameplay.
- Acceptance:
  - The fork point is mechanically verified.
  - Every post-fork commit appears in the provenance ledger.
  - The accidental Bevy ECS experiment is explicitly quarantined for review.
- Verification: compare `git merge-base`, `git log`, and the ledger.

## Ready

### M0-02: Audit compatibility workarounds

- Owner: integration lead
- Status: ACTIVE
- Dependencies: M0-01
- Goal: explain each revival build workaround and define its exit condition.
- Scope: `repo_scripts/`, toolchain configuration, and relevant documentation.
- Non-goals: replacing the historical toolchain during the audit.
- Acceptance: every workaround states its trigger, mutation behavior, risk, and
  removal condition.

### M0-03: Audit Cargo and engine dependencies

- Owner: unassigned
- Status: READY
- Dependencies: M0-01
- Goal: classify direct and critical transitive Rust dependencies.
- Scope: Cargo manifests/locks and the aeplay engine repositories.
- Non-goals: upgrading or replacing dependencies.
- Acceptance: each critical dependency has a pinned source, maintenance status,
  license, risk, and keep/fork/mirror/vendor/upgrade/replace disposition.

### M0-04: Audit npm, browser, and external-service dependencies

- Owner: unassigned
- Status: READY
- Dependencies: M0-01
- Goal: classify browser packages, install scripts, remote requests, and obsolete
  integrations.
- Scope: npm manifests/locks, browser source, and browser build tooling.
- Non-goals: frontend framework or bundler migration.
- Acceptance: important direct/transitive packages and every startup-time remote
  service have a modernization disposition.

### M0-05: Establish factual runtime baseline

- Owner: unassigned
- Status: READY
- Dependencies: M0-01
- Goal: record what the visible game actually does from startup through reload.
- Scope: runtime observation, logs, screenshots, and `docs/audit/`.
- Non-goals: repairing gameplay defects discovered during the run.
- Acceptance: a visible manual run records browser startup, networking, planning,
  construction, simulation response, shutdown, and reload outcomes.

### M0-06: Audit generated code and persistence

- Owner: unassigned
- Status: READY
- Dependencies: M0-01, M0-02
- Goal: determine whether generated actor glue and persisted state are
  reproducible and compatible.
- Scope: `kay_auto.rs`, codegen tooling, actor registration, fixture saves, and
  version checks.
- Non-goals: changing actor IDs or persistence formats.
- Acceptance: reproducibility and compatibility claims are backed by repeatable
  commands and recorded evidence.

## Quarantined

### Q-01: Bevy ECS replacement experiment

- Commit: `2ee0db7`
- Status: INVESTIGATE
- Reason: created during an accidental two-minute continuation of the Kay
  evaluation task before M0 established an architecture decision process.
- Rule: do not extend, integrate, or delete this experiment until M0 determines
  whether it is useful evidence, a future spike to relocate, or work to revert.
