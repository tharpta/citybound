# First town: development, move-ins, and household trips

This increment leaves #40 open pending a proven household-to-local-business trip.
The Town activity panel shows development, occupancy, and household trips on
the built road network. Trips use the existing economy and traffic simulation.

## Play the flow

1. Build the pinned compatibility browser and server using
   [local development](LOCAL_DEVELOPMENT.md). For the known #68 build issue,
   explicitly select `RUSTUP_TOOLCHAIN=nightly-2020-03-10-x86_64-apple-darwin`.
2. Start `target/debug/citybound --mode local --bind 127.0.0.1:8080
   --bind-sim 127.0.0.1:9999 /tmp/my-first-town` with a new city directory.
   Open the local page and close the About menu.
3. Select Planning (pencil), then **Start new project**, then Roads. Click two
   points to draw a straight road; click the final point again to finish.
   Wait for the asphalt preview, then press **Implement**. The connected-town
   probe also adds a perpendicular road at the endpoint to form a T-junction.
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
7. Zone **Commercial** land on the opposite side of the same road and implement
   it. Allow time for a shop, bakery, or mill to develop and become occupied.
   Household needs and available offers determine when trips happen; zoning
   does not immediately create cars. Use a slower speed to watch short trips.
8. **Household trips on roads** lists members whose current task matches a real
   car on a lane. Read the destination/purpose and click **Center on car** to
   see it. This centers once; it does not lock the camera to the moving car.
   The row disappears after arrival. An empty list means no matching road car
   is currently sampled, not that the economy is broken.
9. Reload the page, or stop safely with Ctrl-C and restart against the same city
   directory. The panel is rebuilt from simulation building/occupant updates;
   click a building again to inspect the restored household.

For a known development-friendly geometry, the automated flow uses a road from
`(-320, -300)` to `(-220, -300)` and a residential rectangle with corners
`(-300, -300), (-240, -300), (-240, -240), (-300, -240)`.
Use commercial corners `(-300, -300), (-240, -300), (-240, -360), (-300, -360)`
for frontage on the other side of that road. The connected-town fixture also
builds a road from `(-220, -400)` to `(-220, -200)`.

Current limitation: the connected-town probe reaches occupied residential and
commercial development but times out at its bounded trip check. Real trip
movement, centering, arrival, and in-flight reload acceptance remain unproven.
The single-road routing graph cannot seed a landmark under the current minimum
of three predecessor links; the T-junction result needs further classification.
The UI provides no artificial trips or fallback car animations.

## Evidence

- `npm run test-town-summary`: deterministic regression distinguishing vacant,
  occupied, and neighboring-town trade buildings, repeated snapshots and removal.
- `CITYBOUND_FIRST_TOWN_EVIDENCE_DIR=... npm run smoke-first-town-compat`:
  isolated Chromium and disposable city; actual exported planning commands create
  the road and zone, normal development and immigration run, and real UI clicks
  check focus, counts, and the household inspector before and after both reloads.
  Fixed geometry uses the same Rust commands as the UI; drawing by mouse is not
  automated by this probe.
- `npm run test-town-trips`: deterministic join of household task IDs to lane
  car IDs, including duplicate samples, movement, completion, missing data,
  neighboring-town exclusion, and building removal.
- `CITYBOUND_FIRST_TOWN_EVIDENCE_DIR=/tmp/connected-town npm run smoke-connected-town-compat`:
  extends the first-town flow with occupied commercial development. It checks a
  town household trip (such as a commercial supply run or family commute), movement of that same car, row-click
  camera centering, successful arrival/activity start, and row removal. The same
  in-flight trip must survive page reload and clean server restart before it
  resumes and arrives. The camera is centered
  using a real UI button; fixed planning geometry uses exported Rust commands.
- Keep transient screenshots, snapshots, and logs outside the repository. Link
  concise results from the PR or issue discussion.

The panel projects existing building render notifications into browser memory.
Household refreshes replace each keyed building snapshot; destruction removes it.
The inspector rejects late replies for buildings other than the selected one.

Trip feedback polls town occupants through the existing household inspector
protocol every 500 ms and joins `InTrip` task IDs with lane car render samples.
The displayed trip count covers sampled town household cars, not all network
traffic or a completed-trip total. Brief trips can fall between household polls.
Road destruction clears the browser's corresponding car and trip buffers.
Reload starts with empty browser projections and reconstructs them from the
simulation. The new car metadata is held in the browser actor's existing
non-persisted `External` state. Actor fields/layouts, registrations, generated
network methods, native server code, and save files are unchanged.
