use revm::{
    primitives::{Address, ExecutionResult, Output, TransactTo, U256 as RevmU256},
    Evm,
    InMemoryDB,
};
use tracing::debug;

use crate::types::{ArbOpportunity, SimulationResult};

pub struct LocalSimulator {
    db: InMemoryDB,
}

impl LocalSimulator {
    pub fn new() -> Self {
        Self {
            db: InMemoryDB::default(),
        }
    }

    pub fn simulate_arbitrage(&mut self, opportunity: &ArbOpportunity) -> SimulationResult {
        let start_time = std::time::Instant::now();

        let mut evm = Evm::builder()
            .with_db(&mut self.db)
            .modify_tx_env(|tx| {
                tx.caller = Address::from([0x11u8; 20]);
                tx.transact_to = TransactTo::Call(Address::from([0x22u8; 20]));
                tx.value = RevmU256::from(opportunity.required_capital);
                tx.gas_limit = opportunity.gas_estimate + 50000;
                tx.gas_price = RevmU256::from(50_000_000_000u64);
            })
            .build();

        let result = match evm.transact() {
            Ok(result) => result,
            Err(e) => {
                return SimulationResult {
                    success: false,
                    profit: 0,
                    gas_used: 0,
                    revert_reason: Some(format!("EVM Error: {:?}", e)),
                    execution_time_micros: start_time.elapsed().as_micros() as u64,
                };
            }
        };

        let gas_used = result.result.gas_used();

        match result.result {
            ExecutionResult::Success { output, .. } => {
                let profit = if let Output::Call(bytes) = output {
                    if bytes.len() >= 32 {
                        let mut arr = [0u8; 16];
                        arr.copy_from_slice(&bytes.as_ref()[..16]);
                        u128::from_be_bytes(arr)
                    } else {
                        0
                    }
                } else {
                    0
                };

                SimulationResult {
                    success: true,
                    profit: profit as i128,
                    gas_used,
                    revert_reason: None,
                    execution_time_micros: start_time.elapsed().as_micros() as u64,
                }
            }
            ExecutionResult::Revert { output, .. } => {
                SimulationResult {
                    success: false,
                    profit: 0,
                    gas_used,
                    revert_reason: Some(format!("Reverted: {:?}", output)),
                    execution_time_micros: start_time.elapsed().as_micros() as u64,
                }
            }
            ExecutionResult::Halt { reason, .. } => {
                SimulationResult {
                    success: false,
                    profit: 0,
                    gas_used,
                    revert_reason: Some(format!("Halted: {:?}", reason)),
                    execution_time_micros: start_time.elapsed().as_micros() as u64,
                }
            }
        }
    }

    pub fn estimate_profit_offchain(&self, opportunity: &ArbOpportunity) -> Option<u128> {
        if opportunity.expected_profit > opportunity.required_capital {
            Some(opportunity.expected_profit - opportunity.required_capital)
        } else {
            None
        }
    }
}
