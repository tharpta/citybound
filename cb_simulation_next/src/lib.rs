//! Modern simulation core developed alongside the Kay runtime.
//!
//! This crate is intentionally standalone while Citybound still depends on its
//! historical Rust toolchain. Subsystems move here behind behavioral tests
//! before the server or browser is switched away from Kay.

mod time;

pub use time::{LogicalTick, NextSimulation, SleepUntil, TemporalProbe, WakeProbe};
