import test from 'node:test';
import assert from 'node:assert/strict';
import { townTrips } from '../cb_browser_ui/src/households_browser/townTrips.mjs';

test('only current town household tasks joined to lane cars become visible trips', () => {
    const buildings = {
        home: { style: 'FamilyHouse', households: ['family', 'family'] },
        shop: { style: 'GroceryShop', households: ['shopkeeper'] },
        edge: { style: 'NeighboringTownConnection', households: ['trade'] },
    };
    const goal = ['Money', { household: 'shopkeeper', idx: 0 }];
    const info = {
        family: { core: { member_tasks: [
            { state: { InTrip: 'commute' }, goal },
            { state: { InTrip: 'unresolved' }, goal },
            { state: { StartedAt: [10, 'shop'] }, goal },
        ] } },
        trade: { core: { member_tasks: [{ state: { InTrip: 'boundary' }, goal }] } },
    };
    const cars = [['commute', [2, 3]], ['boundary', [7, 8]], ['unrelated', [4, 5]]];
    const expected = [{ building: 'home', household: 'family', member: 0,
        trip: 'commute', position: [2, 3], goal }];
    assert.deepEqual(townTrips(buildings, info, cars), expected);
    assert.deepEqual(townTrips(buildings, info, [...cars, ['commute', [3, 3]]]),
        [{ ...expected[0], position: [3, 3] }]);
    assert.deepEqual(townTrips(buildings, info, []), []); // car finished / reconnect
    assert.deepEqual(townTrips(buildings, {}, cars), []); // household not refreshed
    assert.deepEqual(townTrips({ shop: buildings.shop }, info, cars), []); // home removed
    info.family.core.member_tasks[0].state = { IdleAt: 'shop' };
    assert.deepEqual(townTrips(buildings, info, cars), []); // completed task
});
