//! Historical Bevy ECS experiment retained as quarantined research.
//!
//! This crate is intentionally standalone and is not an approved migration
//! target or Kay replacement. Do not connect production code or migrate another
//! subsystem here without a new accepted ADR.

mod time;

pub use time::{LogicalTick, NextSimulation, SleepUntil, TemporalProbe, WakeProbe};
