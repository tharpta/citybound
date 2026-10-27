import { isDeepStrictEqual } from "node:util";

// Evaluated in the browser. Observe existing projections; never decode mmap data.
export function firstTownState() {
    const s = window.cbReactApp.state;
    const triangles = meshes => {
        const result = [];
        for (const mesh of meshes) {
            for (let i = 0; i < mesh.indices.length; i += 3) {
                const corners = Array.from(mesh.indices.slice(i, i + 3), index =>
                    JSON.stringify(Array.from(mesh.vertices.slice(index * 3, index * 3 + 3))));
                result.push([0, 1, 2].map(start => [0, 1, 2]
                    .map(offset => corners[(start + offset) % 3]).join("|")).sort()[0]);
            }
        }
        return result.sort();
    };
    const preview = s.planning.rendering.currentPreview;
    const buildings = Object.fromEntries(Object.entries(s.households.buildings)
        .filter(([, b]) => b.style !== "NeighboringTownConnection")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, b]) => [id, { ...b, households: [...b.households].sort(),
            position: s.households.buildingPositions[id],
            geometry: Object.fromEntries(["WhiteWall", "TiledRoof", "WoodenFence"].map(material =>
                [material, triangles([s.landUse.rendering.buildingMeshes[material][id]])])),
        }]));
    const ids = [...new Set(Object.values(buildings).flatMap(b => b.households))].sort();
    return {
        ticks: s.time.ticks, time: s.time.time, speed: s.time.speed,
        gestures: Object.fromEntries(["00000000-0000-4000-8000-000000006200",
            "00000000-0000-4000-8000-000000006201", "00000000-0000-4000-8000-000000006400"].map(id => [id, s.planning.master.gestures[id]])),
        zones: Object.fromEntries(["zoneGroups", "zoneOutlineGroups"].map(layer =>
            [layer, triangles(preview[layer].get("Residential").values())])),
        buildings,
        households: Object.fromEntries(ids.map(id => [id, s.households.householdInfo[id]?.core])),
    };
}

export function validateFirstTown(snapshot) {
    if (!Number.isInteger(snapshot.ticks) || snapshot.ticks <= 0 || snapshot.speed !== 0) {
        throw new Error("Continuity requires acknowledged paused simulation time.");
    }
    if (Object.keys(snapshot.gestures).length !== 3
        || !snapshot.zones.zoneGroups?.length || !snapshot.zones.zoneOutlineGroups?.length
        || !snapshot.roads.laneAsphaltGroups?.length || !snapshot.roads.laneMarkerGroups?.length) {
        throw new Error("Continuity requires the implemented road and residential zone.");
    }
    for (const [id, gesture] of Object.entries(snapshot.gestures)) {
        if (!gesture) throw new Error(`Missing implemented gesture ${id}.`);
    }
    for (const [layer, triangles] of Object.entries({ ...snapshot.zones, ...snapshot.roads })) {
        if (layer !== "laneMarkerGapGroups" && !triangles.length) {
            throw new Error(`Missing constructed geometry ${layer}.`);
        }
    }
    if (!Object.keys(snapshot.buildings).length || !Object.keys(snapshot.households).length) {
        throw new Error("Continuity requires developed buildings and resident households.");
    }
    for (const [id, building] of Object.entries(snapshot.buildings)) {
        if (building.style !== "FamilyHouse" || !building.households.length || !building.position
            || Object.values(building.geometry).some(mesh => !mesh.length)) {
            throw new Error(`Incomplete developed FamilyHouse ${id}.`);
        }
        for (const household of building.households) {
            const core = snapshot.households[household];
            if (!core?.member_tasks?.length || !core.resources || !core.member_resources) {
                throw new Error(`Missing household state ${household}.`);
            }
        }
    }
}

export function assertFirstTownContinuity(before, after, phase) {
    validateFirstTown(before);
    validateFirstTown(after);
    const difference = (a, b, path) => {
        if (isDeepStrictEqual(a, b)) return;
        if (a && b && typeof a === "object" && typeof b === "object") {
            for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
                const found = difference(a[key], b[key], `${path}.${key}`);
                if (found) return found;
            }
        }
        return `${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`;
    };
    const changed = difference(before, after, "town");
    if (changed) throw new Error(`${phase}: first-town continuity changed at ${changed}`);
}
