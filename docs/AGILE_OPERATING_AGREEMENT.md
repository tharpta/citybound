# Citybound Revival Agile Operating Agreement

GitHub Issues are the source of truth. Use continuous-flow Kanban during M0,
then one-week playable iterations from M1 onward.

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
