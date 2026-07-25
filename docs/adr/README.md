# Architecture Decision Records

Architecture Decision Records (ADRs) capture decisions whose consequences are
expensive to reverse or easy for parallel work to interpret differently. GitHub
Issues remain the source of truth for delivery; ADRs preserve the durable
decision and its reasoning.

## When An ADR Is Required

Create an ADR before implementation changes any of these boundaries:

- actor identity, registration, generated actor glue, or message dispatch
- persisted layout, save versioning, save migration, or recovery guarantees
- network protocol, serialization, or browser/server compatibility
- simulation framework or engine ownership
- browser Rust/WASM integration or renderer contract
- workspace-wide dependency or toolchain policy
- public extension, plugin, or external-service architecture
- security, licensing, or recurring monetary-cost posture

An ADR is also required when reversing an accepted decision. Routine,
issue-scoped implementation choices do not need one.

## Workflow

1. Open or identify the GitHub issue that needs the decision. The issue records
   scope, urgency, and discussion.
2. Copy `TEMPLATE.md` to the next zero-padded number and a short name, for
   example `0002-save-versioning.md`. Never reuse a number.
3. Set the status to `Proposed`. Fill every required section before requesting
   review; use `None` with an explanation rather than deleting a section.
4. Link the ADR from its issue and implementation pull request. Link those
   artifacts back from the ADR.
5. Obtain review from the integration/technical lead and an independent
   affected-role reviewer. Decisions that are irreversible, product-defining,
   billable, or expand external authority also require explicit product-owner
   approval.
6. Record the outcome as `Accepted` or `Rejected`. Implementation may cross the
   affected boundary only after acceptance.
7. Keep implementation links and verification evidence current. A decision is
   complete only when its issue and accepted integration commit are linked.
8. To change an accepted decision, create a new ADR and mark the old one
   `Superseded by ADR-NNNN`. Do not rewrite the old rationale.

## Statuses

- `Proposed`: ready for decision review; implementation is not authorized.
- `Accepted`: approved and authoritative.
- `Rejected`: considered but not approved.
- `Superseded by ADR-NNNN`: replaced by a later accepted ADR.
- `Deprecated`: no longer applicable, with no replacement required.

Quarantined work remains frozen while its ADR is proposed. Rejection of an
experiment does not silently delete it; deletion or archival follows the
accepted rollback/disposition and a scoped GitHub issue.

## Review Standard

Reviewers confirm that:

- the decision and boundary are unambiguous
- evidence distinguishes observed facts from inference
- credible alternatives and the status quo were considered
- compatibility and migration effects cover saves, actor identity, networking,
  browser integration, and tooling where applicable
- rollback is concrete and does not assume incompatible saves can be repaired
- engineering, operational, monetary, and maintenance costs are explicit
- implementation and verification are traceable to issues, pull requests, and
  commits

The product owner may override a decision, but the override and its accepted
tradeoffs must still be recorded in the ADR.
