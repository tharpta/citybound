import test from "node:test";
import assert from "node:assert/strict";
import { firstTownState, validateFirstTown, assertFirstTownContinuity } from "./first-town-continuity.mjs";

function browserState() {
    const mesh = { vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint16Array([0, 1, 2]) };
    const batch = new Map([["batch", mesh]]);
    return { time: { ticks: 100, time: [7, 5], speed: 0 },
        planning: { master: { gestures: {
            "00000000-0000-4000-8000-000000006200": { intent: { Road: [1, 1] }, points: [[-320, -300], [-220, -300]] },
            "00000000-0000-4000-8000-000000006201": { intent: { Road: [1, 1] }, points: [[-220, -400], [-220, -200]] },
            "00000000-0000-4000-8000-000000006400": { intent: { Zone: "Residential" }, points: [[-300, -300], [-240, -240]] },
        } }, rendering: { currentPreview: {
            zoneGroups: new Map([["Residential", batch]]), zoneOutlineGroups: new Map([["Residential", batch]]),
        } } },
        households: { buildings: { house1: { style: "FamilyHouse", households: ["family1"] } },
            buildingPositions: { house1: [-270, -270] }, householdInfo: { family1: { core: {
                resources: { Money: 100 }, member_resources: [{ Groceries: 2 }],
                member_tasks: [{ state: { StartedAt: [90, "home"] }, goal: null }],
                used_offers: [], decision_state: "Idle",
            } } } },
        landUse: { rendering: { buildingMeshes: Object.fromEntries(["WhiteWall", "TiledRoof", "WoodenFence"]
            .map(material => [material, { house1: mesh }])) } },
    };
}
function snapshot(state = browserState()) {
    globalThis.window = { cbReactApp: { state } };
    const value = firstTownState();
    delete globalThis.window;
    return { ...value, roads: { laneAsphaltGroups: ["asphalt"], laneMarkerGroups: ["marker"], laneMarkerGapGroups: [] } };
}

test("fresh page objects and cyclic triangle reindexing preserve semantic state", () => {
    const before = snapshot();
    const state = browserState();
    for (const material of Object.values(state.landUse.rendering.buildingMeshes)) {
        material.house1 = { vertices: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 0]), indices: new Uint16Array([2, 0, 1]) };
    }
    const after = snapshot(state);
    after.households.family1 = Object.fromEntries(Object.entries(after.households.family1).reverse());
    assert.doesNotThrow(() => assertFirstTownContinuity(before, after, "restart"));
});

for (const [label, mutate, path] of [
    ["road loss", s => s.roads.laneAsphaltGroups.push("different"), "roads.laneAsphaltGroups"],
    ["zone loss", s => s.zones.zoneGroups.push("different"), "zones.zoneGroups"],
    ["gesture change", s => Object.values(s.gestures)[0].points[0][0]++, "gestures"],
    ["building replacement", s => { s.buildings.house2 = s.buildings.house1; delete s.buildings.house1; }, "buildings"],
    ["building position", s => s.buildings.house1.position[0]++, "buildings.house1.position"],
    ["household resource loss", s => s.households.family1.resources.Money--, "households.family1.resources.Money"],
    ["household task reset", s => s.households.family1.member_tasks[0].state = "Idle", "households.family1.member_tasks"],
    ["time reset", s => s.ticks--, "ticks"],
]) {
    test(`detects ${label} with a diagnostic property path`, () => {
        const before = snapshot();
        const after = structuredClone(before);
        mutate(after);
        assert.throws(() => assertFirstTownContinuity(before, after, "restart"), error =>
            error.message.includes("restart") && error.message.includes(path));
    });
}

test("rejects missing state and an unacknowledged pause", () => {
    for (const mutate of [s => s.speed = 1, s => s.gestures = {}, s => s.roads = {},
        s => s.zones = {}, s => s.buildings = {}, s => s.households = {},
        s => delete s.households.family1.member_tasks]) {
        const value = snapshot();
        mutate(value);
        assert.throws(() => validateFirstTown(value));
    }
});

test("geometry comparison preserves winding and duplicate triangle counts", () => {
    const before = snapshot();
    const reversed = browserState();
    reversed.landUse.rendering.buildingMeshes.WhiteWall.house1 = {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint16Array([0, 2, 1]),
    };
    assert.throws(() => assertFirstTownContinuity(before, snapshot(reversed), "restart"), /geometry.WhiteWall/);
    const duplicate = browserState();
    duplicate.landUse.rendering.buildingMeshes.WhiteWall.house1 = {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint16Array([0, 1, 2, 0, 1, 2]),
    };
    assert.throws(() => assertFirstTownContinuity(before, snapshot(duplicate), "restart"), /geometry.WhiteWall/);
});
