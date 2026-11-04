use kay::{ActorSystem, World, Actor};
use cb_util::random::{seed, Rng};

use cb_time::actors::{Temporal, TemporalID, TimeID};
use cb_time::units::{TimeOfDay, TimeOfDayRange, Instant, Duration, Ticks};
use economy::resources::Resource;
use economy::resources::Resource::*;
use economy::market::{Deal, EvaluationRequester, EvaluationRequesterID, EvaluatedSearchResult};
use land_use::buildings::BuildingID;
use transport::pathfinding::trip::{TripResult, TripListenerID};
use transport::pathfinding::RoughLocationID;

pub mod names;
use self::names::{family_name, member_name};

use economy::households::{Household, HouseholdID, HouseholdCore,
MemberIdx, Offer, OfferID, OfferIdx};

#[derive(Compact, Clone)]
pub struct Family {
    id: FamilyID,
    home: BuildingID,
    core: HouseholdCore,
}

impl Family {
    pub fn move_into(
        id: FamilyID,
        n_members: u32,
        home: BuildingID,
        time: TimeID,
        world: &mut World,
    ) -> Family {
        time.wake_up_in(Ticks(0), id.into(), world);

        let mut core = HouseholdCore::new(
            id.into(),
            world,
            n_members as usize,
            home.into(),
            vec![Offer::new(
                MemberIdx(0),
                TimeOfDayRange::new(16, 0, 11, 0),
                Deal::new(Some((Wakefulness, 3.0)), Duration::from_hours(1)),
                1,
                true,
            )]
            .into(),
        );

        core.used_offers.insert(
            Wakefulness,
            OfferID {
                household: id.into(),
                idx: OfferIdx(0),
            },
        );

        Family { id, home, core }
    }
}

use cb_time::actors::{Sleeper, SleeperID};

impl Sleeper for Family {
    fn wake(&mut self, current_instant: Instant, world: &mut World) {
        self.update_core(current_instant, world);
    }
}

use economy::households::ResultAspect;

impl EvaluationRequester for Family {
    fn expect_n_results(&mut self, resource: Resource, n: u32, world: &mut World) {
        use kay::TypedID;
        if let Some(style) = essential_development_request(&self.core, resource, n) {
            ::economy::immigration_and_development::DevelopmentManagerID::global_first(world)
                .try_develop(style, world);
        }
        self.update_results(resource, &ResultAspect::SetTarget(n), world);
    }

    fn on_result(&mut self, result: &EvaluatedSearchResult, world: &mut World) {
        let &EvaluatedSearchResult {
            resource,
            ref evaluated_deals,
            ..
        } = result;
        self.update_results(
            resource,
            &ResultAspect::AddDeals(evaluated_deals.clone()),
            world,
        );
    }
}

// A failed live grocery search may request normal eligible development. Occupancy
// remains weighted, and the development manager still serializes/rejects requests.
fn essential_development_request(
    core: &HouseholdCore,
    resource: Resource,
    n_offers: u32,
) -> Option<::land_use::buildings::BuildingStyle> {
    use economy::households::DecisionState;
    if core.being_destroyed || resource != Groceries || n_offers != 0 {
        return None;
    }
    if let DecisionState::Choosing(_, _, ref problems, ref entries) = core.decision_state {
        if entries.get(Groceries).is_some()
            && problems.iter().any(|&(r, severity)| r == Groceries && severity > 0.1)
            && core.resources.get(Groceries).map_or(false, |amount| *amount < 0.0)
        {
            return Some(::land_use::buildings::BuildingStyle::GroceryShop);
        }
    }
    None
}

use transport::pathfinding::trip::{TripListener, TripID};

impl TripListener for Family {
    fn trip_created(&mut self, trip: TripID, world: &mut World) {
        self.on_trip_created(trip, world);
    }

    fn trip_result(
        &mut self,
        trip: TripID,
        result: TripResult,
        rough_source: RoughLocationID,
        rough_destination: RoughLocationID,
        world: &mut World,
    ) {
        self.on_trip_result(trip, result, rough_source, rough_destination, world);
    }
}

impl Household for Family {
    fn core(&self) -> &HouseholdCore {
        &self.core
    }

    fn core_mut(&mut self) -> &mut HouseholdCore {
        &mut self.core
    }

    fn site(&self) -> RoughLocationID {
        self.home.into()
    }

    fn is_shared(resource: Resource) -> bool {
        match resource {
            Wakefulness | Satiety => false,
            Money | Groceries => true,
            _ => unimplemented!(),
        }
    }

    fn supplier_shared(resource: Resource) -> bool {
        match resource {
            Money => false,
            Wakefulness | Satiety | Groceries => true,
            _ => unimplemented!(),
        }
    }

    fn importance(resource: Resource, time: TimeOfDay) -> f32 {
        let hour = time.hours_minutes().0;

        let bihourly_importance = match resource {
            Wakefulness => Some([7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 7, 7]),
            Satiety => Some([0, 0, 5, 5, 1, 5, 5, 1, 5, 5, 1, 1]),
            Money => Some([0, 0, 3, 3, 5, 5, 5, 3, 3, 1, 1, 1]),
            Groceries => Some([0, 0, 4, 4, 1, 4, 4, 4, 4, 4, 0, 0]),
            _ => None,
        };

        bihourly_importance
            .map(|lookup| lookup[hour / 2] as f32)
            .unwrap_or(0.0)
    }

    fn interesting_resources() -> &'static [Resource] {
        &[
            Wakefulness,
            Satiety, //Entertainment,
            Money,
            Groceries,
            /* Furniture,
             *Clothes,
             *Devices,
             *Services, */
        ]
    }

    fn decay(&mut self, dt: Duration, _: &mut World) {
        for (i, member_resources) in self.core.member_resources.iter_mut().enumerate() {
            {
                let individuality = seed((self.id, i)).gen_range(0.8, 1.2);
                let wakefulness = member_resources.mut_entry_or(Wakefulness, 0.0);
                *wakefulness -= 1.0 * individuality * dt.as_hours();
            }
            {
                let individuality = seed((self.id, i, 1u8)).gen_range(0.8, 1.2);
                let satiety = member_resources.mut_entry_or(Satiety, 0.0);
                if *satiety < 0.0 {
                    let groceries = self.core.resources.mut_entry_or(Groceries, 0.0);
                    *groceries -= 1.0;
                    *satiety += 1.0;
                }
                *satiety -= 3.0 * individuality * dt.as_days();
            }
            // {
            //     let individuality = seed((self.id, i)).gen_range(0.8, 1.2);
            //     let entertainment = member_resources.mut_entry_or(Entertainment, 0.0);
            //     *entertainment -= 0.2 * individuality * dt.as_hours();
            // }
        }
        // {
        //     let individuality = seed(self.id).gen_range(0.8, 1.2);
        //     let furniture = self.core.resources.mut_entry_or(Furniture, 0.0);
        //     *furniture -= 0.005 * individuality * dt.as_hours();
        // }
        // {
        //     let individuality = seed(self.id).gen_range(0.8, 1.2);
        //     let devices = self.core.resources.mut_entry_or(Devices, 0.0);
        //     *devices -= 0.005 * individuality * dt.as_hours();
        // }
        // {
        //     let individuality = seed(self.id).gen_range(0.8, 1.2);
        //     let services = self.core.resources.mut_entry_or(Services, 0.0);
        //     *services -= 0.01 * individuality * dt.as_hours();
        // }
    }

    fn on_destroy(&mut self, world: &mut World) {
        self.home.remove_household(self.id_as(), world);
    }

    fn household_name(&self) -> String {
        format!("The {} Family", family_name(self.id))
    }

    fn member_name(&self, member: MemberIdx) -> String {
        member_name(self.id, member)
    }
}

impl Temporal for Family {
    fn tick(&mut self, _dt: f32, current_instant: Instant, world: &mut World) {
        self.on_tick(current_instant, world);
    }
}

use transport::pathfinding::{RoughLocation, RoughLocationResolve};

impl RoughLocation for Family {
    fn resolve(&self) -> RoughLocationResolve {
        RoughLocationResolve::SameAs(self.site())
    }
}

pub fn setup(system: &mut ActorSystem) {
    system.register::<Family>();
    auto_setup(system);
}

mod kay_auto;
pub use self::kay_auto::*;

#[cfg(test)]
mod essential_development_tests {
    use super::*;
    use compact::{CVec, CDict, COption};
    use economy::households::{DecisionState, DecisionResourceEntry};
    use economy::resources::ResourceMap;
    use cb_util::async_counter::AsyncCounter;
    use land_use::buildings::BuildingStyle;

    fn choosing_family() -> HouseholdCore {
        let mut entries = CDict::new();
        entries.insert(Groceries, DecisionResourceEntry {
            results_counter: AsyncCounter::new(),
            best_deal: COption(None),
            best_deal_usefulness: 0.0,
        });
        HouseholdCore {
            resources: Some((Groceries, -1.0)).into_iter().collect(),
            member_resources: CVec::new(),
            member_tasks: CVec::new(),
            decision_state: DecisionState::Choosing(
                MemberIdx::new(0), Instant::new(0),
                vec![(Groceries, 4.0)].into(), entries,
            ),
            used_offers: ResourceMap::new(),
            member_used_offers: CVec::new(),
            provided_offers: CVec::new(),
            being_destroyed: false,
        }
    }

    #[test]
    fn live_unserved_grocery_deficit_requests_ordinary_shop_development() {
        let core = choosing_family();
        for _ in 0..3 {
            assert_eq!(essential_development_request(&core, Groceries, 0),
                Some(BuildingStyle::GroceryShop));
        }
        // Policy has no pending state: normal development admission handles repeats.
        assert_eq!(*core.resources.get(Groceries).unwrap(), -1.0);
    }

    #[test]
    fn available_offers_and_other_resources_do_not_request_development() {
        let core = choosing_family();
        assert_eq!(essential_development_request(&core, Groceries, 1), None);
        assert_eq!(essential_development_request(&core, Groceries, 20), None);
        for resource in &[Money, Wakefulness, Satiety, Produce, Grain, Flour,
            BakedGoods, Meat, DairyGoods] {
            assert_eq!(essential_development_request(&core, *resource, 0), None);
        }
    }

    #[test]
    fn destroyed_and_inactive_families_do_not_request_development() {
        let mut core = choosing_family();
        core.being_destroyed = true;
        assert_eq!(essential_development_request(&core, Groceries, 0), None);
        core.being_destroyed = false;
        core.decision_state = DecisionState::None;
        assert_eq!(essential_development_request(&core, Groceries, 0), None);
        core.decision_state = DecisionState::WaitingForTrip(MemberIdx::new(0));
        assert_eq!(essential_development_request(&core, Groceries, 0), None);
    }

    #[test]
    fn resolved_or_unqueried_deficit_does_not_request_development() {
        let mut core = choosing_family();
        for amount in &[0.0, 1.0] {
            *core.resources.mut_entry_or(Groceries, 0.0) = *amount;
            assert_eq!(essential_development_request(&core, Groceries, 0), None);
        }
        *core.resources.mut_entry_or(Groceries, 0.0) = -1.0;
        if let DecisionState::Choosing(_, _, ref mut problems, _) = core.decision_state {
            problems.clear();
        }
        assert_eq!(essential_development_request(&core, Groceries, 0), None);
        let mut core = choosing_family();
        if let DecisionState::Choosing(_, _, _, ref mut entries) = core.decision_state {
            *entries = CDict::new();
        }
        assert_eq!(essential_development_request(&core, Groceries, 0), None);
    }

    #[test]
    fn requested_shop_retains_zone_frontage_and_geometry_requirements() {
        use descartes::{P2, Area, ClosedLinePath, LinePath};
        use land_use::zone_planning::{Lot, ZoneConfig, LandUse};
        use land_use::vacant_lots::VacantLotID;
        use kay::TypedID;
        let style = essential_development_request(&choosing_family(), Groceries, 0).unwrap();
        assert!(style.can_appear_in(LandUse::Commercial));
        assert!(!style.can_appear_in(LandUse::Residential));
        assert!(!style.can_appear_in(LandUse::Agricultural));
        let network = kay::Networking::new(0, vec!["127.0.0.1:0".to_owned()], 4096, 1, 1);
        let mut system = ActorSystem::new(network, Default::default());
        ::setup_common(&mut system);
        let mut world = system.world();
        let log_as = VacantLotID::global_first(&mut world);
        let area = Area::new_simple(ClosedLinePath::new(LinePath::new(vec![
            P2::new(0.0, 0.0), P2::new(0.0, 24.0), P2::new(18.0, 24.0),
            P2::new(18.0, 0.0), P2::new(0.0, 0.0),
        ].into()).unwrap()).unwrap());
        let mut lot = Lot {
            area: area.clone(), original_area: area, original_lot_id: 0,
            zone_configs: vec![ZoneConfig { land_use: LandUse::Commercial,
                max_height: None, set_back: None }].into(),
            road_boundaries: vec![LinePath::new(vec![P2::new(18.0, 0.0),
                P2::new(0.0, 0.0)].into()).unwrap()].into(),
        };
        assert!(lot.split_for(style, true, true, ::std::f32::INFINITY,
            0, log_as, &mut world).unwrap().is_some());
        lot.road_boundaries.clear();
        assert!(lot.split_for(style, true, true, ::std::f32::INFINITY,
            0, log_as, &mut world).unwrap().is_none());
    }

}
