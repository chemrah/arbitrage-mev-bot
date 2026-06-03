use std::sync::Arc;
use std::time::Instant;
use dashmap::DashMap;
use tracing::{info, error, warn, debug};
use tokio::sync::{mpsc, broadcast};

mod config;
mod types;
mod math;
mod listener;
mod solver;
mod cex_hedger;
mod bundler;
mod simulator;
mod ws_server;

use config::Config;
use types::*;
use listener::PoolListener;
use solver::IntentSolver;
use cex_hedger::CEXHedger;
use bundler::BundleBuilder;
use simulator::LocalSimulator;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Arbitrage Rust Engine v0.1.0");

    let cfg = Config::from_env();
    let pool_states: Arc<DashMap<String, PoolState>> = Arc::new(DashMap::new());

    let (opportunity_tx, _) = broadcast::channel::<ArbOpportunity>(256);
    let (telemetry_tx, _) = broadcast::channel::<TelemetrySnapshot>(256);
    let (pool_state_tx, mut pool_state_rx) = mpsc::unbounded_channel::<PoolState>();

    let app_state = Arc::new(ws_server::AppState {
        opportunity_tx: opportunity_tx.clone(),
        telemetry_tx: telemetry_tx.clone(),
    });

    // Start WebSocket server for frontend
    let ws_app_state = app_state.clone();
    let ws_addr = "0.0.0.0:3001";
    tokio::spawn(async move {
        let app = ws_server::create_router(ws_app_state);
        let listener = tokio::net::TcpListener::bind(ws_addr).await.unwrap();
        info!("WebSocket API server listening on {}", ws_addr);
        axum::serve(listener, app).await.unwrap();
    });

    // Start pool listener in background
    let listener = PoolListener::new(cfg.clone(), pool_states.clone(), pool_state_tx);
    tokio::spawn(async move {
        if let Err(e) = listener.start().await {
            warn!("Pool listener failed to start: {:?}", e);
        }
    });

    // Start intent solver
    let solver = IntentSolver::new(&cfg);
    let solver_opp_tx = opportunity_tx.clone();
    tokio::spawn(async move {
        info!("Starting intent solver monitoring...");
        if let Err(e) = solver.start_monitoring().await {
            error!("Intent solver error: {:?}", e);
        }
    });

    // Start CEX hedger
    let hedger = CEXHedger::new(&cfg);
    tokio::spawn(async move {
        info!("Starting CEX hedger...");
        if let Err(e) = hedger.start_listeners().await {
            error!("CEX hedger error: {:?}", e);
        }
    });

    // Initialize bundle builder
    let bundle_builder = BundleBuilder::new(&cfg);

    // Initialize local simulator
    let mut simulator = LocalSimulator::new();

    info!("Engine initialized with {} configured pools", math::SUBSCRIBED_POOLS.len());

    let mut telemetry = TelemetrySnapshot {
        event_capture: 0,
        math_computation: 0,
        evm_simulation: 0,
        bundle_submission: 0,
        total_latency: 0,
        opportunities_scanned: 0,
        opportunities_executed: 0,
        total_profit: 0.0,
    };

    // Main event loop
    loop {
        tokio::select! {
            Some(pool_state) = pool_state_rx.recv() => {
                telemetry.opportunities_scanned += 1;
                debug!("Pool state updated: tick={}, liquidity={}",
                    pool_state.tick, pool_state.liquidity);
            }
            _ = tokio::signal::ctrl_c() => {
                info!("Shutdown signal received, exiting gracefully...");
                break;
            }
        }

        // Periodically broadcast telemetry
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        if now % 5 == 0 {
            telemetry.total_latency = telemetry.event_capture
                + telemetry.math_computation
                + telemetry.evm_simulation
                + telemetry.bundle_submission;

            let _ = telemetry_tx.send(telemetry.clone());
        }
    }

    Ok(())
}
