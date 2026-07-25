use bevy_ecs::prelude::*;
use bevy_ecs::schedule::IntoScheduleConfigs;

/// The logical simulation instant and number of ticks processed per frame.
#[derive(Resource, Clone, Copy, Debug, PartialEq, Eq)]
pub struct LogicalTick {
    current: u64,
    speed: u16,
}

impl LogicalTick {
    pub fn current(self) -> u64 {
        self.current
    }

    pub fn speed(self) -> u16 {
        self.speed
    }
}

/// Temporary migration component used to verify `Temporal::tick` semantics.
#[derive(Component, Default, Debug, PartialEq, Eq)]
pub struct TemporalProbe {
    pub ticks: u64,
    pub last_instant: Option<u64>,
}

/// Wakes an entity once Kay's original strict deadline comparison is true.
#[derive(Component, Clone, Copy, Debug, PartialEq, Eq)]
pub struct SleepUntil(pub u64);

/// Temporary migration component used to verify `Sleeper::wake` semantics.
#[derive(Component, Default, Debug, PartialEq, Eq)]
pub struct WakeProbe {
    pub wakes: u64,
    pub last_instant: Option<u64>,
}

/// Standalone Bevy ECS runtime for incrementally replacing Kay.
pub struct NextSimulation {
    world: World,
    logical_tick_schedule: Schedule,
}

impl NextSimulation {
    pub fn new() -> Self {
        let mut world = World::new();
        world.insert_resource(LogicalTick {
            current: 0,
            speed: 1,
        });

        let mut logical_tick_schedule = Schedule::default();
        logical_tick_schedule.add_systems((tick_temporals, wake_sleepers, advance_clock).chain());

        Self {
            world,
            logical_tick_schedule,
        }
    }

    pub fn world(&self) -> &World {
        &self.world
    }

    pub fn world_mut(&mut self) -> &mut World {
        &mut self.world
    }

    pub fn clock(&self) -> LogicalTick {
        *self.world.resource::<LogicalTick>()
    }

    pub fn set_speed(&mut self, speed: u16) {
        self.world.resource_mut::<LogicalTick>().speed = speed;
    }

    /// Process one rendered frame using the configured simulation speed.
    pub fn progress_frame(&mut self) {
        let speed = self.clock().speed;
        for _ in 0..speed {
            self.logical_tick_schedule.run(&mut self.world);
        }
    }
}

impl Default for NextSimulation {
    fn default() -> Self {
        Self::new()
    }
}

fn tick_temporals(clock: Res<LogicalTick>, mut temporals: Query<&mut TemporalProbe>) {
    for mut temporal in &mut temporals {
        temporal.ticks += 1;
        temporal.last_instant = Some(clock.current);
    }
}

fn wake_sleepers(
    mut commands: Commands,
    clock: Res<LogicalTick>,
    mut sleepers: Query<(Entity, &SleepUntil, &mut WakeProbe)>,
) {
    for (entity, deadline, mut sleeper) in &mut sleepers {
        // Kay wakes when `deadline < current_instant`, not when they are equal.
        if deadline.0 < clock.current {
            sleeper.wakes += 1;
            sleeper.last_instant = Some(clock.current);
            commands.entity(entity).remove::<SleepUntil>();
        }
    }
}

fn advance_clock(mut clock: ResMut<LogicalTick>) {
    clock.current += 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_speed_controls_logical_tick_count() {
        let mut simulation = NextSimulation::new();
        let temporal = simulation.world_mut().spawn(TemporalProbe::default()).id();

        simulation.set_speed(3);
        simulation.progress_frame();

        assert_eq!(simulation.clock().current(), 3);
        assert_eq!(simulation.clock().speed(), 3);
        assert_eq!(
            simulation.world().get::<TemporalProbe>(temporal),
            Some(&TemporalProbe {
                ticks: 3,
                last_instant: Some(2),
            })
        );
    }

    #[test]
    fn sleepers_preserve_kays_strict_deadline_behavior() {
        let mut simulation = NextSimulation::new();
        let sleeper = simulation
            .world_mut()
            .spawn((SleepUntil(2), WakeProbe::default()))
            .id();

        for _ in 0..3 {
            simulation.progress_frame();
        }
        assert_eq!(simulation.clock().current(), 3);
        assert_eq!(
            simulation.world().get::<WakeProbe>(sleeper).unwrap().wakes,
            0
        );

        simulation.progress_frame();
        assert_eq!(
            simulation.world().get::<WakeProbe>(sleeper),
            Some(&WakeProbe {
                wakes: 1,
                last_instant: Some(3),
            })
        );
        assert!(!simulation.world().entity(sleeper).contains::<SleepUntil>());
    }

    #[test]
    fn zero_speed_pauses_the_simulation() {
        let mut simulation = NextSimulation::new();
        simulation.set_speed(0);
        simulation.progress_frame();

        assert_eq!(simulation.clock().current(), 0);
    }
}
