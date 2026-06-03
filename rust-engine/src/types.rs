use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbOpportunity {
    pub id: String,
    pub pair_path: Vec<String>,
    pub arbitrage_type: ArbitrageType,
    pub expected_profit: u128,
    pub required_capital: u128,
    pub success_probability: f64,
    pub gas_estimate: u64,
    pub latency_micros: u64,
    pub timestamp: u64,
    pub pools: Vec<String>,
    pub slippage_estimate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArbitrageType {
    TriangularV3,
    TriangularV4,
    CrossPoolV3V4,
    CexDex,
    FlashLoanJIT,
    IntentBased,
}

#[derive(Debug, Clone)]
pub struct PoolState {
    pub sqrt_price_x96: u128,
    pub tick: i32,
    pub liquidity: u128,
    pub fee: u32,
    pub token0: String,
    pub token1: String,
    pub last_update: Instant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorConfig {
    pub autopilot: bool,
    pub min_profit_threshold: u64,
    pub max_gas_price: u64,
    pub tip_percentage: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub success: bool,
    pub profit: i128,
    pub gas_used: u64,
    pub revert_reason: Option<String>,
    pub execution_time_micros: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub event_capture: u64,
    pub math_computation: u64,
    pub evm_simulation: u64,
    pub bundle_submission: u64,
    pub total_latency: u64,
    pub opportunities_scanned: u64,
    pub opportunities_executed: u64,
    pub total_profit: f64,
}
