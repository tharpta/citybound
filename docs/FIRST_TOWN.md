# First town: development and move-ins

This slice adds live feedback for development and occupancy. Traffic remains
unverified; #40 stays open for a connected mixed-use trip acceptance.

## Play the flow

1. Build the pinned compatibility browser and server using
   [local development](LOCAL_DEVELOPMENT.md). For the known #68 build issue,
   explicitly select `RUSTUP_TOOLCHAIN=nightly-2020-03-10-x86_64-apple-darwin`.
2. Start `target/debug/citybound --mode local --bind 127.0.0.1:8080
   --bind-sim 127.0.0.1:9999 /tmp/my-first-town` with a new city directory.
   Open the local page and close the About menu.
3. Select Planning (pencil), then **Start new project**, then Roads. Click two
   points to draw a straight road; click the final point again to finish.
   Wait for the asphalt preview, then press **Implement**.
4. Start another project. Select Zoning, Residential, and draw a rectangle
   along the road, on one side of it. Click the final corner again to finish.
   The zone must have road frontage and room for houses. Wait for the colored
   preview and press **Implement**. The zone remains visible in Planning.
5. Advance time with the speed slider. The **Town activity** panel initially
   shows zero developed buildings. Normal development creates houses; immigration
   then increases **Occupied** and **Households**. These are households, not a
   resident/population count. Road endpoint trade connections are excluded.
6. Click a building in the panel. The camera centers on it, switches to
   Inspection, and pins its existing inspector. Read the household members,
   resources, and current tasks. A vacant building is labeled **Vacant**.
7. Reload the page, or stop safely with Ctrl-C and restart against the same city
   directory. The panel is rebuilt from simulation building/occupant updates;
   click a building again to inspect the restored household.

For a known development-friendly geometry, the automated flow uses a road from
`(-320, -300)` to `(-220, -300)` and a residential rectangle with corners
`(-300, -300), (-240, -300), (-240, -240), (-300, -240)`.

## Evidence

- `npm run test-town-summary`: deterministic regression distinguishing vacant,
  occupied, and neighboring-town trade buildings, repeated snapshots and removal.
- `CITYBOUND_FIRST_TOWN_EVIDENCE_DIR=... npm run smoke-first-town-compat`:
  isolated Chromium and disposable city; actual exported planning commands create
  the road and zone, normal development and immigration run, and real UI clicks
  check focus, counts, and the household inspector before and after both reloads.
  Fixed geometry uses the same Rust commands as the UI; drawing by mouse is not
  automated by this probe.
- Evidence is committed in `audit/evidence/first-town-551394f/`: screenshots,
  simulation snapshots and acceptance log. Screenshots were visually inspected.

The panel projects existing building render notifications into browser memory.
It adds no actor fields, actor registrations, network methods or save data.
Household refreshes replace each keyed building snapshot; destruction removes it.
The inspector rejects late replies for buildings other than the selected one.
The panel currently covers successfully rendered buildings only; it is not a
simulation-wide census or proof of healthy economy/pathfinding.

Build evidence uses the pinned compiler with the existing macOS linker wrapper
in `/private/tmp/citybound-issue-40-build`, followed by `node copyWasm.js` and
`npm run build-js` in that isolated copy. Dependencies were copied from the
previously accepted local cache; no installs or lifecycle scripts were run.
The native server is the accepted #8 binary (SHA-256 recorded in build identity);
this increment changes only browser code and uses the unchanged server protocol.
