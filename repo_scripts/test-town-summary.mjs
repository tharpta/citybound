import test from "node:test";
import assert from "node:assert/strict";
import { summarizeTown } from "../cb_browser_ui/src/households_browser/townSummary.mjs";

test("town feedback distinguishes development, move-in, and road boundary households", () => {
    assert.deepEqual(summarizeTown({}), { buildings: [], occupied: 0, households: 0 });
    const snapshot = {
        boundary: { style: "NeighboringTownConnection", households: ["trade"] },
        house: { style: "FamilyHouse", households: [] },
        shop: { style: "GroceryShop", households: ["retailer"] },
    };
    const before = summarizeTown(snapshot);
    assert.equal(before.buildings.length, 2);
    assert.equal(before.occupied, 1);
    assert.equal(before.households, 1);
    // A move-in replaces a building snapshot; repeated/reconnect updates must
    // count the household once, not count events or family members as population.
    snapshot.house = { style: "FamilyHouse", households: ["family"] };
    const movedIn = summarizeTown(snapshot);
    assert.equal(movedIn.buildings.length, 2);
    assert.equal(movedIn.occupied, 2);
    assert.equal(movedIn.households, 2);
    assert.deepEqual(summarizeTown({ ...snapshot }), movedIn);
    delete snapshot.house;
    assert.equal(summarizeTown(snapshot).households, 1);
});
