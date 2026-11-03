# Independent Review Handoff Protocol

This protocol applies to review evidence in `tharpta/citybound`. It preserves
independent review when every Codex role currently writes to GitHub as the same
`tharpta` account. It does not grant permissions or replace GitHub's formal
review controls.

## Reviewer task prompt

Include the requested write action at the start of every visible reviewer task,
before asking the reviewer to inspect the PR. Fill in the PR number and the
full current head and base SHAs:

> Independently review PR #`<number>` at head `<40-character head SHA>` against
> base `<40-character base SHA>`. After the bounded review, post one top-level
> comment on the PR using the APPROVE or REQUEST CHANGES format below, with
> concise findings, checks, and residual limits. This comment is the requested
> GitHub write action. Because the shared `tharpta` identity authored the PR,
> GitHub may reject formal self-approval; do not submit a formal APPROVE review
> or represent another role's action as yours. If the task surfaces a
> task-scoped write-approval prompt, request/complete that approval as part of
> this handoff, rather than finishing the review and discovering the write
> requirement afterward. Do not change repository permissions. If either the
> head or base changes, stop and review the new immutable pair before posting a
> verdict.

Do not defer the comment request until after review work is complete. If the
task cannot post its comment after the explicit task-scoped approval path is
offered, report that concrete blocker promptly; the Integration Lead must not
post a comment pretending to be the reviewer.

## Top-level verdict comment

The independent reviewer posts exactly one of these lines as the first line of
a **top-level PR conversation comment** (not an inline note and not a formal
GitHub review submission):

```text
Independent exact-head verdict: APPROVE — <40-character head SHA> (base <40-character base SHA>)
```

```text
Independent exact-head verdict: REQUEST CHANGES — <40-character head SHA> (base <40-character base SHA>)
```

Follow it with concise evidence: findings (or “No actionable findings”),
focused verification, compatibility/rollback limits where relevant, and
residual risk. Use full SHAs so copied or stale abbreviated identifiers cannot
silently pass as current evidence. A request for changes names actionable
findings; a hold for stale evidence or a changed base says so explicitly.

## Integration and Producer treatment

- The Integration Lead matches both recorded SHAs to the PR's current head and
  base before using a comment as the independent verdict. Any change to either
  SHA invalidates that verdict and requires one bounded re-review of the new
  pair. Required hosted checks and any applicable linked runtime evidence must
  also match the head being integrated.
- The verdict comment records an independent role's evidence; it is not a
  GitHub approval count, branch-protection bypass, or permission to skip checks.
  The Integration Lead owns merge readiness and integration, not the reviewer.
- The Producer may treat only that exact-pair evidence as the review record.
  Do not request a second approval for the same pair or add Producer approval
  for routine FAST/NORMAL integration. Preserve HIGH-RISK review, compatibility,
  rollback, and genuine risk-acceptance gates; this comment does not replace
  them.

## Permission and cost boundary

Issue #58 documented that task-scoped write approval was not inherited from the
Integration Lead task, while GitHub rejected formal approval from the shared
PR-author account. Repository permission inspection does not establish or
change Codex task-scoped tool authorization. No safe repository-scoped setting
to suppress that task approval was established by this investigation; leave
repository grants unchanged and request the needed action in each reviewer task
up front. Do not broaden the `tharpta/citybound` grant, create a bot or another
GitHub seat, or use a paid identity/service to work around the shared-account
restriction. If the task prompts for authorization, use only the existing
task-scoped approval flow; never bypass it.

## Observed exercises and limitation

- PR #77 demonstrates a bounded reviewer cycle: the top-level reviewer comments
  first requested changes on exact SHAs, then approved head
  `76b5fef41a63beb1ae5e2c81a83d286576278a25` against base
  `0ebc434e0449eba959f237b403207117ce8f2de2` after refresh. The verdict comment
  explicitly says it is role evidence, not formal self-approval.
- PR #80 demonstrates a successful exact-pair APPROVE comment at head
  `6833a95051ed70bff069739883b9b02d16ea4cba` and base
  `5a7419255e92f2a07be547e9f5f491f19f1be2d1`; it was posted before merge, with
  both hosted checks reported green.

The producer-task handoff records confirm both reviews requested the comment
action upfront; both reviewers posted exact-pair comments without a late
task-scoped write-approval deadlock. The public GitHub PR records alone do not
expose the original task prompts, so corroborate the upfront request against
the task record when auditing this exercise.
