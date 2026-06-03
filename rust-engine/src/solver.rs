use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

use crate::types::ArbOpportunity;
use crate::config::Config;

const COW_API_URL: &str = "https://api.cow.fi/mainnet/api/v1";
const UNISWAPX_API_URL: &str = "https://api.uniswap.org/v2";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoWOrder {
    pub sellToken: String,
    pub buyToken: String,
    pub sellAmount: String,
    pub buyAmount: String,
    pub validTo: u64,
    pub appData: String,
    pub feeAmount: String,
    pub kind: String,
    pub partiallyFillable: bool,
    pub signature: String,
    pub signingScheme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniswapXOrder {
    pub encodedOrder: String,
    pub signature: String,
    pub inputToken: String,
    pub outputToken: String,
    pub inputAmount: String,
    pub outputAmount: String,
    pub deadline: u64,
}

pub struct IntentSolver {
    client: Client,
    watched_pairs: Vec<(String, String)>,
}

impl IntentSolver {
    pub fn new(_config: &Config) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");
        
        let watched_pairs = vec![
            ("WETH".to_string(), "USDC".to_string()),
            ("WETH".to_string(), "LINK".to_string()),
            ("USDC".to_string(), "LINK".to_string()),
        ];
        
        Self {
            client,
            watched_pairs,
        }
    }
    
    /// Monitor CoW Swap API for new orders and match them against pool liquidity
    pub async fn monitor_cow_orders(&self) -> Result<Vec<ArbOpportunity>, Box<dyn std::error::Error>> {
        let url = format!("{}/auction", COW_API_URL);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err("Failed to fetch CoW orders".into());
        }
        
        let orders: Vec<CoWOrder> = response.json().await?;
        let mut opportunities = Vec::new();
        
        for order in orders {
            // Check if we can fulfill this order profitably using on-chain liquidity
            if let Some(opportunity) = self.evaluate_cow_order(&order).await? {
                opportunities.push(opportunity);
            }
        }
        
        Ok(opportunities)
    }
    
    /// Monitor UniswapX API for new orders
    pub async fn monitor_uniswapx_orders(&self) -> Result<Vec<ArbOpportunity>, Box<dyn std::error::Error>> {
        let url = format!("{}/orders", UNISWAPX_API_URL);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err("Failed to fetch UniswapX orders".into());
        }
        
        let orders: Vec<UniswapXOrder> = response.json().await?;
        let mut opportunities = Vec::new();
        
        for order in orders {
            if let Some(opportunity) = self.evaluate_uniswapx_order(&order).await? {
                opportunities.push(opportunity);
            }
        }
        
        Ok(opportunities)
    }
    
    async fn evaluate_cow_order(&self, order: &CoWOrder) -> Result<Option<ArbOpportunity>, Box<dyn std::error::Error>> {
        // Compare order price against direct pool price
        // If profitable, create arbitrage opportunity
        
        // Placeholder implementation
        if order.sellAmount.parse::<u128>()? > order.buyAmount.parse::<u128>()? {
            return Ok(None);
        }
        
        let opportunity = ArbOpportunity {
            id: format!("cow-{}", order.signature),
            pair_path: vec![order.sellToken.clone(), order.buyToken.clone()],
            arbitrage_type: crate::types::ArbitrageType::IntentBased,
            expected_profit: 0,
            required_capital: order.sellAmount.parse().unwrap_or(0),
            success_probability: 0.85,
            gas_estimate: 150000,
            latency_micros: 0,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs(),
            pools: vec![],
            slippage_estimate: 0.001,
        };
        
        Ok(Some(opportunity))
    }
    
    async fn evaluate_uniswapx_order(&self, order: &UniswapXOrder) -> Result<Option<ArbOpportunity>, Box<dyn std::error::Error>> {
        // Similar logic for UniswapX orders
        // Check if fulfilling the order is profitable after gas costs
        
        let opportunity = ArbOpportunity {
            id: format!("uniswapx-{}", order.signature),
            pair_path: vec![order.inputToken.clone(), order.outputToken.clone()],
            arbitrage_type: crate::types::ArbitrageType::IntentBased,
            expected_profit: 0,
            required_capital: order.inputAmount.parse().unwrap_or(0),
            success_probability: 0.80,
            gas_estimate: 120000,
            latency_micros: 0,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs(),
            pools: vec![],
            slippage_estimate: 0.002,
        };
        
        Ok(Some(opportunity))
    }
    
    /// Start continuous monitoring loop
    pub async fn start_monitoring(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut interval = interval(Duration::from_millis(100)); // Check every 100ms
        
        loop {
            interval.tick().await;
            
            tokio::select! {
                cow_result = self.monitor_cow_orders() => {
                    match cow_result {
                        Ok(opportunities) => {
                            for opp in opportunities {
                                info!("Found CoW arbitrage opportunity: {:?}", opp);
                            }
                        }
                        Err(e) => {
                            warn!("CoW monitoring error: {:?}", e);
                        }
                    }
                }
                uniswapx_result = self.monitor_uniswapx_orders() => {
                    match uniswapx_result {
                        Ok(opportunities) => {
                            for opp in opportunities {
                                info!("Found UniswapX arbitrage opportunity: {:?}", opp);
                            }
                        }
                        Err(e) => {
                            warn!("UniswapX monitoring error: {:?}", e);
                        }
                    }
                }
            }
        }
    }
}