# Observability And Debugging

This is the current debugging baseline for the revived fork.

## Existing Surfaces

### Actor Log

`cb_util/src/log/mod.rs` defines an actor-backed log:

- `LogID::spawn(world)` creates the log actor.
- `debug`, `info`, `warn`, and `error` helpers send log messages through `kay`.
- Entries store topic/message offsets into a compact shared string buffer.
- Browser clients can request log entries after their last known index.

### Browser Debug Window

`cb_browser_ui/src/debug` registers `LogUI` and exports debug helpers to JS.
The React debug window shows:

- connection status
- networking turns by machine
- actor queue lengths
- message statistics
- simulation log entries
- manual debug actions such as grid planning and car spawning

The debug window is toggled with the configured debug key, currently `.` by
default.

### Panic/Error Reporting

The native server writes the last panic report to `cb_last_error.txt` in the temp
directory and prints a backtrace. The browser error page still points at the
original upstream reporting link.

## Current Gaps

- The debug window is browser-only and tied to React state updates.
- Log levels are serialized, but the UI currently renders the raw enum class.
- There is no structured runtime snapshot/export for a city state.
- Pathfinding and economy failures mostly need targeted instrumentation.
- Error/report links still point to the original `citybound/citybound` repo.

## First Cleanup Targets

1. Point crash/report guidance at revival docs once the GitHub fork exists.
2. Add focused logs around:
   - planning project implementation
   - `Construction` action group start/finish/failure
   - pathfinding no-route outcomes
   - immigration/development decisions
3. Add a lightweight simulation snapshot command after save layout is better
   understood.

The automatic live-build, patron, and GitHub milestone fetches have been removed
from the revival UI. The browser smoke now fails on any new console or page
error and confirms that networking turns advance.

## Near-Term Rule

Prefer extending the existing actor log/debug window before adding a second
observability system. The current model already crosses the server/browser actor
boundary, which is exactly the boundary modernization needs to protect.
