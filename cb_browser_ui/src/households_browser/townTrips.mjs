import { summarizeTown } from './townSummary.mjs';

// Join real household tasks to real lane car samples by TripID. A sampled task
// alone does not prove a car is on the road. Reconnects begin with empty samples.
export function townTrips(buildings, householdInfo, roadTrips) {
    const cars = new Map(roadTrips);
    const seen = new Set();
    const trips = [];
    for (const [building, snapshot] of summarizeTown(buildings).buildings) {
        for (const household of snapshot.households) {
            if (seen.has(household)) continue;
            seen.add(household);
            const tasks = householdInfo[household]?.core?.member_tasks ?? [];
            tasks.forEach((task, member) => {
                const trip = task.state?.InTrip;
                const position = cars.get(trip);
                if (trip && position) trips.push({
                    building, household, member, trip, position, goal: task.goal,
                });
            });
        }
    }
    return trips;
}
