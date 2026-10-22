import React from 'react';
import update from 'immutability-helper';
import { fmtId } from '../browser_utils/Utils';
import { Interactive3DShape } from '../browser_utils/Utils';
import { summarizeTown } from './townSummary.mjs';
import { townTrips } from './townTrips.mjs';

export const initialState = {
    buildings: {},
    buildingPositions: {},
    buildingShapes: {},
    inspectedBuilding: null,
    inspectedBuildingPinned: false,
    inspectedBuildingState: null,
    householdInfo: {},
};

export function render(state, setState) {
    return {};
}

// Building updates already include occupants when construction, move-ins, or
// reconnects refresh the renderer. These counts never infer population from meshes.
export function TownActivity({ state, setState }) {
    const { buildings, occupied, households } = summarizeTown(state.households.buildings);
    const inspect = id => setState(old => update(old, {
        uiMode: { $set: "inspection" },
        camera: { target: { $set: [...old.households.buildingPositions[id], 0] } },
        households: {
            inspectedBuilding: { $set: id },
            inspectedBuildingState: { $set: null },
            inspectedBuildingPinned: { $set: true },
        }
    }));

    return <details className="window town-activity" open data-citybound-town-activity>
        <summary>Town activity</summary>
        <p role="status" data-town-counts>
            Buildings: {buildings.length} · Occupied: {occupied} · Households: {households}
        </p>
        <TownTrips state={state} setState={setState} />
        {buildings.length === 0
            ? <p>Implement road-connected residential zoning, then advance time to see development and move-ins here.</p>
            : <div className="town-building-list">{buildings.map(([id, building]) =>
                <button key={id} data-town-building={id} onClick={() => inspect(id)}>
                    {fmtId(id)} · {building.style} · {building.households.length === 0
                        ? "Vacant" : `${building.households.length} household(s)`}
                </button>
            )}</div>}
    </details>;
}

// Refresh through the existing household inspector protocol. No simulation
// actor, trip, or save state is created by observing activity.
class TownTrips extends React.Component {
    componentDidMount() {
        this.refresh = () => {
            const { buildings } = summarizeTown(this.props.state.households.buildings);
            const ids = new Set(buildings.flatMap(([, b]) => b.households));
            ids.forEach(id => cbRustBrowser.get_household_info(id));
        };
        this.refresh();
        this.interval = setInterval(this.refresh, 500);
    }

    componentWillUnmount() { clearInterval(this.interval); }

    render() {
        const { state, setState } = this.props;
        const trips = townTrips(state.households.buildings,
            state.households.householdInfo, state.transport.roadTrips);
        const follow = position => setState(old => update(old, {
            uiMode: { $set: "inspection" },
            camera: { target: { $set: [...position, 0] } },
            households: { inspectedBuilding: { $set: null },
                inspectedBuildingPinned: { $set: false } },
        }));
        return <div className="town-trip-list">
            <p role="status" data-town-trips>Household trips on roads: {trips.length}</p>
            {trips.length === 0
                ? <p>Connect residential and commercial zoning with roads, then advance time. Trips appear when households travel for work or supplies.</p>
                : trips.map(t => <button key={t.trip} data-town-trip={t.trip}
                    onClick={() => follow(t.position)}>
                    {fmtId(t.household)} · Member {t.member} · <StateAndGoal
                        state={{ InTrip: t.trip }} goal={t.goal} /> · Center on car
                </button>)}
        </div>;
    }
}

export function Shapes(props) {
    const { state, setState } = props;
    if (state.uiMode != "inspection") {
        return null;
    } else {
        return Object.keys(state.households.buildingShapes).map(buildingId => {
            const buildingShape = state.households.buildingShapes[buildingId];

            return <Interactive3DShape
                id={buildingId}
                shape={{
                    type: "polygon",
                    area: buildingShape,
                }}
                zIndex={2}
                cursorHover="pointer"
                cursorActive="pointer"
                onEvent={e => {
                    if (e.hover) {
                        if (e.hover.now && !state.households.inspectedBuildingPinned) {
                            setState(oldState => update(oldState, {
                                households: { inspectedBuilding: { $set: buildingId } }
                            }))
                        } else if (e.hover.end && !state.households.inspectedBuildingPinned) {
                            setState(oldState => update(oldState, {
                                households: {
                                    inspectedBuilding: { $set: null },
                                    inspectedBuildingState: { $set: null },
                                }
                            }))
                        }
                    } else if (e.drag && e.drag.end && !state.households.inspectedBuildingPinned) {
                        setState(oldState => update(oldState, {
                            households: { inspectedBuildingPinned: { $set: true } }
                        }))
                    }
                }} />
        });
    }
}

export function Windows(props) {
    const { inspectedBuilding, inspectedBuildingState, inspectedBuildingPinned, householdInfo, buildingPositions } = props.state.households;
    if (props.state.uiMode == "inspection" && inspectedBuilding && buildingPositions[inspectedBuilding]) {
        const buildingPosition3d = [...buildingPositions[inspectedBuilding], 0.0];

        const closeWindow = () => props.setState(oldState => update(oldState, {
            households: {
                inspectedBuilding: { $set: null },
                inspectedBuildingState: { $set: null },
                inspectedBuildingPinned: { $set: false },
            }
        }));

        return <BuildingInfo
            buildingPosition2d={props.project3dTo2d(buildingPosition3d)}
            pinned={inspectedBuildingPinned}
            {...{ inspectedBuilding, inspectedBuildingState, householdInfo, closeWindow }}
        />
    } else {
        return null;
    }
}

class BuildingInfo extends React.Component {
    constructor(props) {
        super(props);

        this.refresh = () => {
            cbRustBrowser.get_building_info(this.props.inspectedBuilding);
            if (this.props.inspectedBuildingState) {
                for (let householdId of this.props.inspectedBuildingState.households) {
                    cbRustBrowser.get_household_info(householdId);
                }
            }
        }
    }

    componentWillMount() {
        this.refresh();
        this.refreshInterval = setInterval(this.refresh, 30);
    }

    componentWillUnmount() {
        clearInterval(this.refreshInterval);
    }

    render() {
        return <div
            className={"window building " + (this.props.pinned ? "pinned" : "")}
            style={{
                pointerEvents: this.props.pinned ? "all" : "none",
                transform: `translate(calc(${this.props.buildingPosition2d[0]}px - 50% - 0.5em), calc(${this.props.buildingPosition2d[1]}px - 100% - 30px))`,
                maxHeight: `calc(${this.props.buildingPosition2d[1]}px - 30px)`
            }}>
            <p>{fmtId(this.props.inspectedBuilding)}</p>
            {this.props.pinned && <a className="close-window" onClick={this.props.closeWindow}>×</a>}
            {this.props.inspectedBuildingState && [
                <h1>{this.props.inspectedBuildingState.style}</h1>,
                <div className="household-list">
                    {this.props.inspectedBuildingState.households.map(id => <div className="household">{[
                        <h3>{fmtId(id)}</h3>,
                        this.props.householdInfo[id] && <HouseholdInfo core={this.props.householdInfo[id].core} id={id} here={this.props.inspectedBuilding} />
                    ]}</div>)}
                </div>
            ]}
        </div>;
    }
}

function HouseholdInfo(props) {
    const { resources, member_resources, member_tasks } = props.core;

    return [
        resources.entries.map(([resource, amount]) =>
            <p>{resource}: {amount.toFixed(2)}</p>
        ),
        member_resources.map((memberResources, memberI) =>
            [
                <h4>Member {memberI}</h4>,
                <p><StateAndGoal here={props.here} state={member_tasks[memberI].state} goal={member_tasks[memberI].goal} /></p>,
                memberResources.entries.map(([resource, amount]) =>
                    <p>{resource}: {amount.toFixed(2)}</p>
                ),
            ]
        )
    ]
}

function StateAndGoal(props) {
    let statePart;
    let goalGerund = false;

    if (props.state) {
        if (props.state.IdleAt) {
            if (props.state.IdleAt == props.here) {
                statePart = "Idle here";
            } else {
                statePart = "Idle at " + fmtId(props.state.IdleAt) + (props.goal ? " after" : "");
                goalGerund = true;
            }
        } else if (props.state.StartedAt) {
            statePart = "Currently";
            goalGerund = true;
        } else if (props.state.InTrip) {
            statePart = "On the way to"
        } else {
            statePart = JSON.stringify(props)
        }

        let goalPart;

        if (props.goal) {
            if (props.goal[0] == "Money") {
                goalPart = (goalGerund ? "working at " : "work at ") + fmtId(props.goal[1].household)
            } else if (props.goal[0] == "Wakefulness") {
                goalPart = (goalGerund ? "sleeping at " : "sleep at ") + fmtId(props.goal[1].household)
            } else {
                goalPart = (goalGerund ? "getting " : "get ") + props.goal[0].toLowerCase() + " at " + fmtId(props.goal[1].household)
            }
            return statePart + " " + goalPart + ".";
        } else {
            return statePart + ".";
        }
    } else {
        return "Gone missing?"
    }
}