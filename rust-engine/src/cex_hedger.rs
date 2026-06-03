use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tokio::time::interval;
use tracing::{debug, error, info, warn};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};

use crate::config::Config;
use crate::types::ArbOpportunity;

const BINANCE_WS_URL: &str = "wss://stream.binance.com:9443/ws";
const BINANCE_REST_URL: &str = "https://api.binance.com";
const OKX_WS_URL: &str = "wss://ws.okx.com:8443/ws/v5/public";
const OKX_REST_URL: &str = "https://www.okx.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinanceOrderBook {
    pub last_update_id: u64,
    pub bids: Vec<[String; 2]>,
    pub asks: Vec<[String; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OKXTicker {
    pub instId: String,
    pub last: String,
    pub ask: String,
    pub bid: String,
    pub vol24h: String,
}

pub struct CEXHedger {
    client: Client,
    binance_api_key: Option<String>,
    binance_api_secret: Option<String>,
    okx_api_key: Option<String>,
    okx_api_secret: Option<String>,
}

impl CEXHedger {
    pub fn new(config: &Config) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
            binance_api_key: config.binance_api_key.clone(),
            binance_api_secret: config.binance_api_secret.clone(),
            okx_api_key: config.okx_api_key.clone(),
            okx_api_secret: config.okx_api_secret.clone(),
        }
    }
    
    /// Start WebSocket listeners for Binance and OKX
    pub async fn start_listeners(&self) -> Result<(), Box<dyn std::error::Error>> {
        tokio::select! {
            result = self.start_binance_listener() => {
                if let Err(e) = result {
                    error!("Binance listener error: {:?}", e);
                }
            }
            result = self.start_okx_listener() => {
                if let Err(e) = result {
                    error!("OKX listener error: {:?}", e);
                }
            }
        }
        
        Ok(())
    }
    
    async fn start_binance_listener(&self) -> Result<(), Box<dyn std::error::Error>> {
        let ws_url = format!("{}/ethusdt@bookTicker", BINANCE_WS_URL);
        let (ws_stream, _) = tokio_tungstenite::connect_async(&ws_url).await?;
        
        info!("Connected to Binance WebSocket");
        
        // Implementation would process incoming WebSocket messages
        // and update internal state with latest prices
        
        Ok(())
    }
    
    async fn start_okx_listener(&self) -> Result<(), Box<dyn std::error::Error>> {
        let ws_url = format!("{}", OKX_WS_URL);
        let (ws_stream, _) = tokio_tungstenite::connect_async(&ws_url).await?;
        
        info!("Connected to OKX WebSocket");
        
        // Subscribe to ETH/USDT ticker
        let subscribe_msg = json!({
            "op": "subscribe",
            "args": [{
                "channel": "tickers",
                "instId": "ETH-USDT"
            }]
        });
        
        // Implementation would send subscription and process messages
        
        Ok(())
    }
    
    /// Place a delta-hedged order on Binance Futures
    pub async fn place_hedge_order(
        &self,
        symbol: &str,
        side: &str, // "BUY" or "SELL"
        quantity: f64,
        order_type: &str, // "MARKET" or "LIMIT"
    ) -> Result<String, Box<dyn std::error::Error>> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis();
        
        let params = json!({
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "quantity": quantity,
            "timestamp": timestamp,
        });
        
        let signature = self.generate_binance_signature(&params.to_string())?;
        
        let response = self.client
            .post(format!("{}/api/v3/order", BINANCE_REST_URL))
            .header("X-MBX-APIKEY", self.binance_api_key.as_ref().unwrap())
            .query(&[(&signature, &"" as &str)])
            .json(&params)
            .send()
            .await?;
        
        let status = response.status();
        let body = response.text().await?;
        
        if status.is_success() {
            info!("Successfully placed Binance hedge order: {}", body);
            Ok(body)
        } else {
            Err(format!("Binance API Error: {} - {}", status, body).into())
        }
    }
    
    /// Calculate optimal hedge size based on DEX position
    pub fn calculate_hedge_size(&self, dex_position_size: f64, price: f64) -> f64 {
        // For delta-neutral: hedge size = -position size
        // Additional logic can be added for partial hedging
        -dex_position_size
    }
    
    fn generate_binance_signature(&self, query_string: &str) -> Result<String, Box<dyn std::error::Error>> {
        let api_secret = self.binance_api_secret.as_ref()
            .ok_or("Binance API secret not configured")?;
        
        let mut mac = Hmac::<Sha256>::new_from_slice(api_secret.as_bytes())?;
        mac.update(query_string.as_bytes());
        let result = mac.finalize();
        let signature = hex::encode(result.into_bytes());
        
        Ok(signature)
    }
}