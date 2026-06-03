use futures::{SinkExt, StreamExt};
use reqwest::Client;
use serde_json::json;
use tokio::sync::mpsc;
use tokio_tungstenite::connect_async;
use tracing::{debug, error, info, warn};
use std::sync::Arc;
use dashmap::DashMap;
use std::time::Instant;

use crate::types::PoolState;
use crate::config::Config;
use crate::math;

pub struct PoolListener {
    config: Config,
    pool_states: Arc<DashMap<String, PoolState>>,
    tx_sender: mpsc::UnboundedSender<PoolState>,
    http_client: Client,
}

impl PoolListener {
    pub fn new(
        config: Config,
        pool_states: Arc<DashMap<String, PoolState>>,
        tx_sender: mpsc::UnboundedSender<PoolState>,
    ) -> Self {
        Self {
            config,
            pool_states,
            tx_sender,
            http_client: Client::new(),
        }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let ws_url = &self.config.ws_url;
        if ws_url.is_empty() {
            warn!("WS_URL not configured, pool listener running in poll-only mode");
            self.start_polling().await
        } else {
            self.start_websocket().await
        }
    }

    async fn start_websocket(&self) -> Result<(), Box<dyn std::error::Error>> {
        let (ws_stream, _) = connect_async(&self.config.ws_url).await?;
        info!("Connected to Ethereum WebSocket");

        let subscribe_msg = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_subscribe",
            "params": ["logs", {
                "address": math::SUBSCRIBED_POOLS,
            }]
        });

        let (mut write, mut read) = ws_stream.split();
        write.send(tokio_tungstenite::tungstenite::Message::Text(
            subscribe_msg.to_string(),
        )).await?;

        info!("Subscribed to pool swap events via WebSocket");

        let pool_states = self.pool_states.clone();
        let tx_sender = self.tx_sender.clone();

        while let Some(Ok(msg)) = read.next().await {
            if let tokio_tungstenite::tungstenite::Message::Text(text) = msg {
                if text.contains("params") && text.contains("result") {
                    debug!("Received pool event: {}...", &text[..text.len().min(100)]);
                    // Parse and update pool state
                    let state = PoolState {
                        sqrt_price_x96: 0,
                        tick: 0,
                        liquidity: 0,
                        fee: 3000,
                        token0: String::new(),
                        token1: String::new(),
                        last_update: Instant::now(),
                    };
                    pool_states.insert("latest".to_string(), state.clone());
                    let _ = tx_sender.send(state);
                }
            }
        }

        Ok(())
    }

    async fn start_polling(&self) -> Result<(), Box<dyn std::error::Error>> {
        let rpc_url = &self.config.rpc_url;
        if rpc_url.is_empty() {
            warn!("RPC_URL not configured either, listener inactive");
            return Ok(());
        }

        info!("Polling pool data from RPC every 5 seconds (no WS)");
        let pool_states = self.pool_states.clone();
        let tx_sender = self.tx_sender.clone();
        let client = self.http_client.clone();
        let rpc_url = rpc_url.clone();
        let pools = math::SUBSCRIBED_POOLS.to_vec();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
            loop {
                interval.tick().await;
                for pool_addr in &pools {
                    let body = json!({
                        "jsonrpc": "2.0",
                        "method": "eth_call",
                        "params": [{
                            "to": *pool_addr,
                            "data": "0x"
                        }, "latest"],
                        "id": 1
                    });

                    match client.post(&rpc_url).json(&body).send().await {
                        Ok(resp) => {
                            if let Ok(val) = resp.json::<serde_json::Value>().await {
                                if let Some(_result) = val["result"].as_str() {
                                    let state = PoolState {
                                        sqrt_price_x96: 0,
                                        tick: 0,
                                        liquidity: 0,
                                        fee: 3000,
                                        token0: String::new(),
                                        token1: String::new(),
                                        last_update: Instant::now(),
                                    };
                                    pool_states.insert(pool_addr.to_string(), state.clone());
                                    let _ = tx_sender.send(state);
                                }
                            }
                        }
                        Err(e) => warn!("Poll error for {}: {:?}", pool_addr, e),
                    }
                }
            }
        });

        Ok(())
    }
}
