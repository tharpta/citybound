# Citybound Safety Net

This document tracks revival checks that protect behavior before larger
modernization starts.

## Current Checks

### `npm run test-planning-compat`

Current status: passes.

This runs `cargo test -p cb_planning` through the macOS linker compatibility
wrapper. It currently covers:

- deterministic `PrototypeID` generation from hashed influences
- `PlanHistory::update_for` plus `apply_update`
- `PlanResult::actions_to` grouping for destruct, morph, and construct actions

Verified output:

```text
running 3 tests
test tests::prototype_id_is_deterministic_from_influences ... ok
test tests::plan_result_actions_group_destruct_morph_and_construct ... ok
test tests::plan_history_update_can_recreate_newer_history ... ok

test result: ok. 3 passed; 0 failed
```

## Notes

- Root `cargo fmt -- ./cb_planning/src/lib.rs` currently scans broader workspace
  modules and fails on pre-existing long lines in unrelated files. Use targeted
  formatting carefully until the old formatting baseline is handled separately.
- These tests intentionally use a tiny test-only `PrototypeKind` instead of
  Citybound road/zone types. That keeps the first safety net focused on generic
  planning behavior.
- The next checks should cover server asset readiness and a real browser/server
  connection using the default simulation port or a fixed custom-port template.
