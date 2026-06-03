use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
    Json,
};
use futures::{SinkExt, StreamExt};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tracing::{debug, info, warn};

use crate::types::{ArbOpportunity, TelemetrySnapshot};

pub struct AppState {
    pub opportunity_tx: broadcast::Sender<ArbOpportunity>,
    pub telemetry_tx: broadcast::Sender<TelemetrySnapshot>,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health_handler))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "version": "0.1.0",
        "service": "arbitrage-rust-engine"
    }))
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    let mut opp_rx = state.opportunity_tx.subscribe();
    let mut tel_rx = state.telemetry_tx.subscribe();

    let send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                Ok(opp) = opp_rx.recv() => {
                    let msg = serde_json::to_string(&json!({
                        "type": "opportunity",
                        "data": &opp
                    })).unwrap_or_default();
                    if sender.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
                Ok(tel) = tel_rx.recv() => {
                    let msg = serde_json::to_string(&json!({
                        "type": "telemetry",
                        "data": &tel
                    })).unwrap_or_default();
                    if sender.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                debug!("WS message received: {}", text);
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}
