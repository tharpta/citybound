import assert from "node:assert/strict";
import test from "node:test";
import { roadGeometry } from "./road-reload-geometry.mjs";

test("road evidence tolerates regrouping but detects lost, moved, or reversed surfaces", () => {
    const mesh = { vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
        indices: new Uint16Array([0, 1, 2]) };
    const layers = asphalt => ({
        laneAsphaltGroups: asphalt,
        laneMarkerGroups: new Map([[7, mesh]]),
        laneMarkerGapGroups: new Map(),
    });
    const original = roadGeometry(layers(new Map([[1, mesh], [2, mesh]])));
    assert.equal(original.laneAsphaltGroups.length, 2);
    assert.equal(original.laneMarkerGroups[0], "[0,0,0]|[1,0,0]|[1,1,0]");
    const reindexed = { vertices: new Float32Array([1, 1, 0, 0, 0, 0, 1, 0, 0]),
        indices: new Uint16Array([1, 2, 0]) };
    assert.deepEqual(roadGeometry(layers(new Map([[90, reindexed], [3, mesh]]))), original);
    assert.notDeepEqual(roadGeometry(layers(new Map([[1, mesh]]))), original);
    const reversed = { ...mesh, indices: new Uint16Array([0, 2, 1]) };
    assert.notDeepEqual(roadGeometry(layers(new Map([[1, mesh], [2, reversed]]))), original);
    const moved = { ...mesh, vertices: new Float32Array([0, 0, 0, 2, 0, 0, 1, 1, 0]) };
    assert.notDeepEqual(roadGeometry(layers(new Map([[1, mesh], [2, moved]]))), original);
    assert.notDeepEqual(roadGeometry({ ...layers(new Map([[1, mesh], [2, mesh]])),
        laneMarkerGroups: new Map() }), original);
});
