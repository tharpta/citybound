// Road endpoints create neighboring-town connections with trade households.
// They are simulation boundaries, not buildings developed in the player's town.
export function summarizeTown(allBuildings) {
    const buildings = Object.entries(allBuildings)
        .filter(([, building]) => building.style !== "NeighboringTownConnection")
        .sort(([a], [b]) => a.localeCompare(b));
    return {
        buildings,
        occupied: buildings.filter(([, building]) => building.households.length > 0).length,
        households: new Set(buildings.flatMap(([, building]) => building.households)).size,
    };
}
