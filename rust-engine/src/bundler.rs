use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, error, info, warn};

use crate::types::ArbOpportunity;
use crate::config::Config;

const FLASHBOTS_RPC: &str = "https://relay.flashbots.net";
const BEAVER_BUILD_RPC: &str = "https://rpc.beaverbuild.org";
const TITAN_RPC: &str = "https://rpc.titanbuilder.net";
const BUILDER069_RPC: &str = "https://builder0x69.io";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashbotsBundle {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    pub params: Vec<BundleParams>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleParams {
    pub txs: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_timestamp: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_timestamp: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reverting_tx_hashes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replacement_uuid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: Option<BundleResult>,
    pub error: Option<BundleError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleResult {
    pub bundle_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleError {
    pub code: i32,
    pub message: String,
}

pub struct BundleBuilder {
    client: Client,
    relay_urls: Vec<String>,
    rpc_url: String,
    eth_client: Client,
}

impl BundleBuilder {
    pub fn new(config: &Config) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        let relay_urls = vec![
            FLASHBOTS_RPC.to_string(),
            BEAVER_BUILD_RPC.to_string(),
            TITAN_RPC.to_string(),
            BUILDER069_RPC.to_string(),
        ];

        Self {
            client,
            relay_urls,
            rpc_url: config.rpc_url.clone(),
            eth_client: Client::new(),
        }
    }

    pub async fn submit_bundle(&self, opportunity: &ArbOpportunity, signed_txs: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
        let block_number = self.get_current_block_number().await?;
        let bundle = FlashbotsBundle {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "eth_sendBundle".to_string(),
            params: vec![BundleParams {
                txs: signed_txs,
                block_number: Some(format!("0x{:x}", block_number + 1)),
                min_timestamp: Some(self.get_timestamp()),
                max_timestamp: Some(self.get_timestamp() + 60),
                reverting_tx_hashes: None,
                replacement_uuid: Some(uuid::Uuid::new_v4().to_string()),
            }],
        };

        let futures = self.relay_urls.iter().map(|url| {
            self.submit_to_relay(url.clone(), &bundle)
        });

        let results = futures::future::join_all(futures).await;

        for (i, result) in results.iter().enumerate() {
            match result {
                Ok(response) => {
                    info!("Bundle submitted to relay {}: {:?}", i, response);
                }
                Err(e) => {
                    warn!("Failed to submit to relay {}: {:?}", i, e);
                }
            }
        }

        Ok(())
    }

    async fn submit_to_relay(&self, url: String, bundle: &FlashbotsBundle) -> Result<BundleResponse, Box<dyn std::error::Error>> {
        let response = self.client
            .post(&url)
            .json(bundle)
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;

        if !status.is_success() {
            return Err(format!("HTTP Error {}: {}", status, body).into());
        }

        let bundle_response: BundleResponse = serde_json::from_str(&body)?;
        Ok(bundle_response)
    }

    pub async fn get_current_block_number(&self) -> Result<u64, Box<dyn std::error::Error>> {
        if self.rpc_url.is_empty() {
            return Ok(0u64);
        }

        let body = json!({
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        });

        let response = self.eth_client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .await?;

        let result: serde_json::Value = response.json().await?;
        if let Some(block_hex) = result["result"].as_str() {
            let block = u64::from_str_radix(block_hex.trim_start_matches("0x"), 16)?;
            Ok(block)
        } else {
            Err("Failed to parse block number from RPC response".into())
        }
    }

    fn get_timestamp(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }
}
