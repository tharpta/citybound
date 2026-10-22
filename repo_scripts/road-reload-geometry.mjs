// Canonical transport triangles ignore batching and index order, preserving winding.
export function roadGeometry(rendering = window.cbReactApp.state.transport.rendering) {
    const result = {};
    for (const layer of ["laneAsphaltGroups", "laneMarkerGroups", "laneMarkerGapGroups"]) {
        const triangles = [];
        for (const mesh of rendering[layer].values()) {
            for (let i = 0; i < mesh.indices.length; i += 3) {
                const corners = Array.from(mesh.indices.slice(i, i + 3), index =>
                    Array.from(mesh.vertices.slice(index * 3, index * 3 + 3)));
                const vertices = corners.map(corner => JSON.stringify(corner));
                // Cyclic rotation preserves winding (reversed faces differ).
                triangles.push([0, 1, 2].map(start =>
                    [0, 1, 2].map(offset => vertices[(start + offset) % 3]).join("|")
                ).sort()[0]);
            }
        }
        result[layer] = triangles.sort();
    }
    return result;
}
