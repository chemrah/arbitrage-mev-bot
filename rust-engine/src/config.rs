use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub rpc_url: String,
    pub ws_url: String,
    pub private_key: String,
    pub executor_address: String,
    pub flashbots_relay: String,
    pub beaver_build_relay: String,
    pub titan_relay: String,
    pub builder069_relay: String,
    pub binance_api_key: Option<String>,
    pub binance_api_secret: Option<String>,
    pub okx_api_key: Option<String>,
    pub okx_api_secret: Option<String>,
    pub min_profit_threshold: u64,
    pub max_gas_price: u64,
    pub tip_percentage: u32,
    pub autopilot: bool,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            rpc_url: env::var("RPC_URL").unwrap_or_default(),
            ws_url: env::var("WS_URL").unwrap_or_default(),
            private_key: env::var("PRIVATE_KEY").unwrap_or_default(),
            executor_address: env::var("EXECUTOR_ADDRESS").unwrap_or_default(),
            flashbots_relay: env::var("FLASHBOTS_RELAY").unwrap_or_else(|_| "https://relay.flashbots.net".to_string()),
            beaver_build_relay: env::var("BEAVER_RELAY").unwrap_or_else(|_| "https://rpc.beaverbuild.org".to_string()),
            titan_relay: env::var("TITAN_RELAY").unwrap_or_else(|_| "https://rpc.titanbuilder.net".to_string()),
            builder069_relay: env::var("BUILDER069_RELAY").unwrap_or_else(|_| "https://builder0x69.io".to_string()),
            binance_api_key: env::var("BINANCE_API_KEY").ok(),
            binance_api_secret: env::var("BINANCE_API_SECRET").ok(),
            okx_api_key: env::var("OKX_API_KEY").ok(),
            okx_api_secret: env::var("OKX_API_SECRET").ok(),
            min_profit_threshold: env::var("MIN_PROFIT_THRESHOLD").ok().and_then(|s| s.parse().ok()).unwrap_or(1000000000000000), // 0.001 ETH
            max_gas_price: env::var("MAX_GAS_PRICE").ok().and_then(|s| s.parse().ok()).unwrap_or(500000000000), // 500 gwei
            tip_percentage: env::var("TIP_PERCENTAGE").ok().and_then(|s| s.parse().ok()).unwrap_or(85),
            autopilot: env::var("AUTOPILOT").map(|s| s == "true").unwrap_or(false),
        }
    }
}