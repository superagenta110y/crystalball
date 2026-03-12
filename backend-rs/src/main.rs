use axum::{
    extract::{Path, Query, State, WebSocketUpgrade},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};

mod storage;

#[derive(Clone)]
struct AppState {
    sqlite: storage::SqliteStore,
    lmdb: storage::LmdbCache,
    // Placeholder for provider clients + shared caches.
    memory: Arc<RwLock<HashMap<String, serde_json::Value>>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let sqlite = storage::SqliteStore::open("crystalball.db")?;
    sqlite.init()?;
    let lmdb = storage::LmdbCache::open("./cache.lmdb")?;

    let state = AppState {
        sqlite,
        lmdb,
        memory: Arc::new(RwLock::new(HashMap::new())),
    };

    let api = Router::new()
        // status
        .route("/status", get(status))
        // market
        .route("/market/quote/:symbol", get(market_quote))
        .route("/market/history/:symbol", get(market_history))
        .route("/market/trades/:symbol", get(market_trades))
        .route("/market/options/:symbol", get(market_options))
        .route("/market/expirations/:symbol", get(market_expirations))
        .route("/market/symbols", get(market_symbols))
        // analytics
        .route("/analytics/gex/:symbol", get(analytics_gex))
        .route("/analytics/dex/:symbol", get(analytics_dex))
        .route("/analytics/oi/:symbol", get(analytics_oi))
        // orders/account/reports/news/ai/screener
        .route("/orders", get(orders_list).post(orders_create))
        .route("/orders/:order_id", delete(orders_delete))
        .route("/account", get(account_get))
        .route("/reports/daily-bias/:symbol", get(report_daily_bias))
        .route("/news", get(news_feed))
        .route("/ai/status", get(ai_status))
        .route("/ai/chat", post(ai_chat))
        .route("/screener", get(screener_get))
        // providers/settings
        .route("/providers", get(providers_list).post(providers_create))
        .route("/providers/:provider_id", get(providers_get).put(providers_update).delete(providers_delete))
        .route("/providers/:provider_id/activate", put(providers_activate))
        .route("/settings", get(settings_get))
        .route("/settings/alpaca", put(settings_alpaca))
        .route("/settings/hoodlink", put(settings_hoodlink))
        .route("/settings/active-provider", put(settings_active_provider))
        .route("/settings/ui-theme", get(settings_ui_theme_get).put(settings_ui_theme_put))
        .with_state(state.clone());

    let ws = Router::new()
        .route("/ws/quotes/:symbol", get(ws_quotes))
        .route("/ws/market/:symbol", get(ws_quotes))
        .route("/ws/screener", get(ws_screener))
        .route("/ws/orderflow/:symbol", get(ws_orderflow))
        .with_state(state.clone());

    // Same shape as current Python backend: /api + mirrored /api/ws
    let app = Router::new()
        .nest("/api", api.clone())
        .merge(ws.clone())
        .nest("/api", ws)
        .fallback_service(ServeDir::new("../frontend/out"))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "0.0.0.0:8000".parse()?;
    tracing::info!(%addr, "crystalball-rs listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Serialize)]
struct StatusResponse {
    status: &'static str,
    provider: &'static str,
    version: &'static str,
}

async fn status() -> Json<StatusResponse> {
    Json(StatusResponse { status: "ok", provider: "pending", version: "0.1.0-rs" })
}

// ---- placeholder handlers (endpoint parity scaffold) ----
async fn market_quote(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({"todo":"market_quote"})) }
async fn market_history(Path(_): Path<String>, Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!({"todo":"market_history"})) }
async fn market_trades(Path(_): Path<String>, Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!({"todo":"market_trades"})) }
async fn market_options(Path(_): Path<String>, Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!([])) }
async fn market_expirations(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({"expirations": []})) }
async fn market_symbols(Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!({"items": []})) }
async fn analytics_gex(Path(_): Path<String>, Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!([])) }
async fn analytics_dex(Path(_): Path<String>, Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!([])) }
async fn analytics_oi(Path(_): Path<String>, Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!([])) }
async fn orders_list() -> Json<serde_json::Value> { Json(serde_json::json!([])) }
async fn orders_create() -> Json<serde_json::Value> { Json(serde_json::json!({"todo":"orders_create"})) }
async fn orders_delete(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({"ok": true})) }
async fn account_get() -> Json<serde_json::Value> { Json(serde_json::json!({"todo":"account"})) }
async fn report_daily_bias(Path(_): Path<String>) -> String { "TODO: daily bias".into() }
async fn news_feed(Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!([])) }
async fn ai_status() -> Json<serde_json::Value> { Json(serde_json::json!({"configured": false})) }
async fn ai_chat() -> Json<serde_json::Value> { Json(serde_json::json!({"reply":"TODO"})) }
async fn screener_get(Query(_q): Query<HashMap<String,String>>) -> Json<serde_json::Value> { Json(serde_json::json!({"i":[],"t":0,"p":1,"ps":50})) }
async fn providers_list() -> Json<serde_json::Value> { Json(serde_json::json!({"providers":[],"active":{}})) }
async fn providers_create() -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }
async fn providers_get(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({})) }
async fn providers_update(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }
async fn providers_delete(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }
async fn providers_activate(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }
async fn settings_get() -> Json<serde_json::Value> { Json(serde_json::json!({})) }
async fn settings_alpaca() -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }
async fn settings_hoodlink() -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }
async fn settings_active_provider() -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }
async fn settings_ui_theme_get() -> Json<serde_json::Value> { Json(serde_json::json!({"mode":"dark"})) }
async fn settings_ui_theme_put() -> Json<serde_json::Value> { Json(serde_json::json!({"ok":true})) }

async fn ws_quotes(_ws: WebSocketUpgrade, State(_s): State<AppState>, Path(_symbol): Path<String>) -> impl IntoResponse {
    // TODO: 1s polling loop, push quote payload parity.
    axum::http::StatusCode::NOT_IMPLEMENTED
}
async fn ws_screener(_ws: WebSocketUpgrade, State(_s): State<AppState>) -> impl IntoResponse {
    axum::http::StatusCode::NOT_IMPLEMENTED
}
async fn ws_orderflow(_ws: WebSocketUpgrade, State(_s): State<AppState>, Path(_symbol): Path<String>) -> impl IntoResponse {
    axum::http::StatusCode::NOT_IMPLEMENTED
}
