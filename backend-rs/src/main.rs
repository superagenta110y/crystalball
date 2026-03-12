use axum::{
    extract::{Path, Query, State, WebSocketUpgrade, ws::{WebSocket, Message}},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use chrono::{Utc, DateTime, FixedOffset, TimeZone};
use futures_util::{StreamExt, SinkExt};
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

    // Reuse the existing Python backend DB for provider/settings continuity.
    let sqlite = storage::SqliteStore::open("../backend/crystalball.db")?;
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
    provider: String,
    version: &'static str,
}

#[derive(Deserialize)]
struct ProviderUpsertReq {
    r#type: String,
    config: serde_json::Value,
    name: Option<String>,
}

#[derive(Deserialize)]
struct ActivateReq {
    role: String,
}

#[derive(Deserialize)]
struct ActiveProviderReq {
    provider: String,
}

#[derive(Deserialize)]
struct ThemeReq {
    mode: String,
    accent: Option<String>,
    bull: Option<String>,
    bear: Option<String>,
}

async fn status(State(s): State<AppState>) -> Json<StatusResponse> {
    let provider = s.sqlite.get_setting("active_provider_data").ok().flatten().unwrap_or_else(|| "pending".into());
    Json(StatusResponse { status: "ok", provider, version: "0.1.0-rs" })
}

// ---- market/provider implementation (first real parity block) ----
#[derive(Clone)]
enum ActiveProvider {
    Alpaca { api_key: String, secret_key: String, data_url: String },
    Hoodlink { base_url: String, api_key: String },
}

fn active_provider(state: &AppState) -> ActiveProvider {
    let active = state.sqlite.get_setting("active_provider_data").ok().flatten();
    let providers = state.sqlite.list_providers().unwrap_or_default();

    // Prefer explicitly active provider, otherwise first alpaca/hoodlink.
    let p = active
        .as_ref()
        .and_then(|id| providers.iter().find(|x| &x.id == id))
        .or_else(|| providers.iter().find(|x| x.r#type == "alpaca"))
        .or_else(|| providers.iter().find(|x| x.r#type == "hoodlink"));

    if let Some(p) = p {
        if p.r#type == "hoodlink" {
            let url = p.config.get("url").and_then(|v| v.as_str()).unwrap_or("http://127.0.0.1:7878");
            let key = p.config.get("api_key").and_then(|v| v.as_str()).unwrap_or("");
            return ActiveProvider::Hoodlink { base_url: format!("{}/api/v1", url.trim_end_matches('/')), api_key: key.to_string() };
        }
        let api = p.config.get("api_key").and_then(|v| v.as_str()).unwrap_or("");
        let sec = p.config.get("secret_key").and_then(|v| v.as_str()).unwrap_or("");
        let data_url = p.config.get("data_url").and_then(|v| v.as_str()).unwrap_or("https://data.alpaca.markets");
        return ActiveProvider::Alpaca { api_key: api.to_string(), secret_key: sec.to_string(), data_url: data_url.to_string() };
    }

    ActiveProvider::Alpaca { api_key: String::new(), secret_key: String::new(), data_url: "https://data.alpaca.markets".into() }
}

fn alpaca_headers(api_key: &str, secret_key: &str) -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert("APCA-API-KEY-ID", reqwest::header::HeaderValue::from_str(api_key).unwrap_or(reqwest::header::HeaderValue::from_static("")));
    h.insert("APCA-API-SECRET-KEY", reqwest::header::HeaderValue::from_str(secret_key).unwrap_or(reqwest::header::HeaderValue::from_static("")));
    h
}

fn tf_step_seconds(tf: &str) -> i64 {
    match tf {
        "1Min" => 60,
        "5Min" => 300,
        "15Min" => 900,
        "30Min" => 1800,
        "1Hour" => 3600,
        "4Hour" => 14400,
        "1Day" => 86400,
        "1Week" => 604800,
        _ => 300,
    }
}

fn json_num(v: Option<&serde_json::Value>) -> f64 {
    if let Some(x) = v {
        if let Some(n) = x.as_f64() { return n; }
        if let Some(n) = x.as_i64() { return n as f64; }
        if let Some(s) = x.as_str() { return s.parse::<f64>().unwrap_or(0.0); }
    }
    0.0
}

fn normalize_time_anchor(v: &str, tf: &str) -> String {
    let t = v.trim();
    let step = tf_step_seconds(tf).max(1);
    if t.eq_ignore_ascii_case("now") {
        let now = Utc::now().timestamp();
        let snapped = (now / step) * step;
        if let Some(dt) = Utc.timestamp_opt(snapped, 0).single() {
            return dt.to_rfc3339();
        }
        return Utc::now().to_rfc3339();
    }
    if let Ok(n) = t.parse::<i64>() {
        // Frontend may send unix seconds (or ms). Alpaca expects RFC3339.
        let secs = if n > 1_000_000_000_000 { n / 1000 } else { n };
        let snapped = (secs / step) * step;
        if let Some(dt) = Utc.timestamp_opt(snapped, 0).single() {
            return dt.to_rfc3339();
        }
    }
    t.to_string()
}

async fn market_quote(Path(symbol): Path<String>, State(s): State<AppState>) -> Json<serde_json::Value> {
    let sym = symbol.to_uppercase();
    let client = reqwest::Client::new();
    match active_provider(&s) {
        ActiveProvider::Hoodlink { base_url, api_key } => {
            let r = client
                .get(format!("{}/market/quote/{}", base_url, sym))
                .header("X-API-Key", api_key)
                .send().await;
            if let Ok(resp) = r {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    return Json(serde_json::json!({
                        "symbol": sym,
                        "bid_price": v.get("bid_price"),
                        "ask_price": v.get("ask_price"),
                        "last_price": v.get("last_trade_price").or_else(|| v.get("ask_price")),
                        "timestamp": v.get("updated_at"),
                    }));
                }
            }
        }
        ActiveProvider::Alpaca { api_key, secret_key, data_url } => {
            let headers = alpaca_headers(&api_key, &secret_key);
            let q = match client.get(format!("{}/v2/stocks/{}/quotes/latest", data_url, sym)).headers(headers.clone()).send().await {
                Ok(r) => r.json::<serde_json::Value>().await.ok(),
                Err(_) => None,
            };
            let t = match client.get(format!("{}/v2/stocks/{}/trades/latest", data_url, sym)).headers(headers).send().await {
                Ok(r) => r.json::<serde_json::Value>().await.ok(),
                Err(_) => None,
            };
            let bid = q.as_ref().and_then(|x| x.get("quote")).and_then(|x| x.get("bp")).and_then(|x| x.as_f64());
            let ask = q.as_ref().and_then(|x| x.get("quote")).and_then(|x| x.get("ap")).and_then(|x| x.as_f64());
            let last = t.as_ref().and_then(|x| x.get("trade")).and_then(|x| x.get("p")).and_then(|x| x.as_f64()).or_else(|| ask.or(bid));
            let ts = t.as_ref().and_then(|x| x.get("trade")).and_then(|x| x.get("t")).cloned().or_else(|| q.as_ref().and_then(|x| x.get("quote")).and_then(|x| x.get("t")).cloned());
            return Json(serde_json::json!({"symbol": sym, "bid_price": bid, "ask_price": ask, "last_price": last, "timestamp": ts}));
        }
    }
    Json(serde_json::json!({"symbol": sym, "bid_price": null, "ask_price": null, "last_price": null}))
}

async fn market_history(Path(symbol): Path<String>, Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    let sym = symbol.to_uppercase();
    let timeframe = q.get("timeframe").cloned().unwrap_or_else(|| "1Day".into());
    let limit = q.get("limit").and_then(|x| x.parse::<usize>().ok()).unwrap_or(252);
    let latest = q.get("latest").cloned();
    let start = q.get("start").cloned();
    let end = q.get("end").cloned();

    let cache_key = format!("hist:{}:{}:{}:{:?}:{:?}:{:?}", sym, timeframe, limit, latest, start, end);
    if let Ok(Some(v)) = s.lmdb.get_json(&cache_key) {
        return Json(v);
    }

    let (api_key, secret_key, data_url) = match active_provider(&s) {
        ActiveProvider::Alpaca { api_key, secret_key, data_url } => (api_key, secret_key, data_url),
        ActiveProvider::Hoodlink { .. } => {
            // Hoodlink fallback to basic empty parity payload for now.
            return Json(serde_json::json!({"s":sym,"tf":timeframe,"b":[]}));
        }
    };

    let tf = timeframe.clone();
    let client = reqwest::Client::new();
    let end_anchor = end.or(latest).unwrap_or_else(|| "now".into());
    let end_iso = normalize_time_anchor(&end_anchor, &tf);
    let start_iso = if let Some(sv) = start {
        sv
    } else {
        // Cursor-like bounded window (parity with Python behavior for pan/backfill).
        let step = tf_step_seconds(&tf);
        let end_secs = DateTime::parse_from_rfc3339(&end_iso).map(|d| d.timestamp()).unwrap_or_else(|_| Utc::now().timestamp());
        let lookback_bars = std::cmp::max((limit as i64 * 3) / 2, 400);
        let start_secs = std::cmp::max(0, end_secs - step * lookback_bars);
        Utc.timestamp_opt(start_secs, 0).single().map(|d| d.to_rfc3339()).unwrap_or_else(|| end_iso.clone())
    };

    let mut bars: Vec<serde_json::Value> = vec![];
    let mut params: Vec<(String,String)> = vec![
        ("timeframe".into(), tf.clone()),
        ("limit".into(), limit.to_string()),
        ("adjustment".into(), "raw".into()),
        ("feed".into(), "sip".into()),
        ("sort".into(), "desc".into()),
        ("end".into(), end_iso.clone()),
        ("start".into(), start_iso.clone()),
    ];
    if let Ok(resp) = client
        .get(format!("{}/v2/stocks/{}/bars", data_url, sym))
        .headers(alpaca_headers(&api_key, &secret_key))
        .query(&params)
        .send().await
    {
        if resp.status().is_success() {
            if let Ok(v) = resp.json::<serde_json::Value>().await {
                bars = v.get("bars").and_then(|x| x.as_array()).cloned().unwrap_or_default();
            }
        }
    }
    if bars.is_empty() {
        params.retain(|(k, _)| k != "feed");
        params.push(("feed".into(), "iex".into()));
        if let Ok(resp) = client
            .get(format!("{}/v2/stocks/{}/bars", data_url, sym))
            .headers(alpaca_headers(&api_key, &secret_key))
            .query(&params)
            .send().await
        {
            if resp.status().is_success() {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    bars = v.get("bars").and_then(|x| x.as_array()).cloned().unwrap_or_default();
                }
            }
        }
    }

    bars.sort_by(|a,b| {
        let ta = a.get("t").and_then(|x| x.as_str()).unwrap_or("");
        let tb = b.get("t").and_then(|x| x.as_str()).unwrap_or("");
        ta.cmp(tb)
    });
    if bars.len() > limit { bars = bars.split_off(bars.len() - limit); }

    let compact: Vec<serde_json::Value> = bars.into_iter().map(|b| serde_json::json!({
        "ts": b.get("t"), "o": b.get("o"), "h": b.get("h"), "l": b.get("l"), "c": b.get("c"), "v": b.get("v")
    })).collect();
    let payload = serde_json::json!({"s": sym, "tf": timeframe, "b": compact});
    let _ = s.lmdb.set_json(&cache_key, &payload, 10);
    Json(payload)
}

async fn market_trades(Path(symbol): Path<String>, Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    let sym = symbol.to_uppercase();
    let limit = q.get("limit").and_then(|x| x.parse::<usize>().ok()).unwrap_or(200);
    let client = reqwest::Client::new();
    match active_provider(&s) {
        ActiveProvider::Alpaca { api_key, secret_key, data_url } => {
            let r = client.get(format!("{}/v2/stocks/{}/trades", data_url, sym))
                .headers(alpaca_headers(&api_key, &secret_key))
                .query(&[("limit", limit.to_string()), ("feed", "sip".into())])
                .send().await;
            if let Ok(resp) = r {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    let out: Vec<serde_json::Value> = v.get("trades").and_then(|x| x.as_array()).cloned().unwrap_or_default().into_iter().map(|t| serde_json::json!({
                        "price": t.get("p"), "size": t.get("s"), "timestamp": t.get("t"), "conditions": t.get("c").cloned().unwrap_or(serde_json::json!([]))
                    })).collect();
                    return Json(serde_json::Value::Array(out));
                }
            }
        }
        ActiveProvider::Hoodlink { .. } => {}
    }
    Json(serde_json::json!([]))
}

async fn market_options(Path(symbol): Path<String>, Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    let sym = symbol.to_uppercase();
    let expiration = q.get("expiration_date").cloned();
    let otype = q.get("option_type").cloned();
    let client = reqwest::Client::new();

    match active_provider(&s) {
        ActiveProvider::Hoodlink { base_url, api_key } => {
            let mut qp: Vec<(String,String)> = vec![];
            if let Some(e) = expiration { qp.push(("expiration_dates".into(), e)); }
            if let Some(t) = otype { qp.push(("type".into(), t)); }
            let r = client.get(format!("{}/market/options/{}", base_url, sym))
                .header("X-API-Key", api_key)
                .query(&qp)
                .send().await;
            if let Ok(resp) = r {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    return Json(v.get("results").cloned().unwrap_or_else(|| serde_json::json!([])));
                }
            }
        }
        ActiveProvider::Alpaca { api_key, secret_key, .. } => {
            let mut qp: Vec<(String,String)> = vec![
                ("underlying_symbols".into(), sym.clone()),
                ("limit".into(), "500".into()),
            ];
            if let Some(e) = expiration.clone() {
                qp.push(("expiration_date_gte".into(), e.clone()));
                qp.push(("expiration_date_lte".into(), e));
            }
            if let Some(t) = otype { qp.push(("type".into(), t)); }
            let r = client.get("https://paper-api.alpaca.markets/v2/options/contracts")
                .headers(alpaca_headers(&api_key, &secret_key))
                .query(&qp)
                .send().await;
            if let Ok(resp) = r {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    return Json(v.get("option_contracts").cloned().unwrap_or_else(|| serde_json::json!([])));
                }
            }
        }
    }

    Json(serde_json::json!([]))
}

async fn market_expirations(Path(symbol): Path<String>, State(s): State<AppState>) -> Json<serde_json::Value> {
    let sym = symbol.to_uppercase();
    let client = reqwest::Client::new();
    match active_provider(&s) {
        ActiveProvider::Alpaca { api_key, secret_key, .. } => {
            let today = Utc::now().date_naive().to_string();
            let r = client
                .get("https://paper-api.alpaca.markets/v2/options/contracts")
                .headers(alpaca_headers(&api_key, &secret_key))
                .query(&[("underlying_symbols", sym.clone()), ("expiration_date_gte", today), ("limit", "500".into())])
                .send().await;
            if let Ok(resp) = r {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    let mut exps: Vec<String> = v.get("option_contracts")
                        .and_then(|x| x.as_array())
                        .cloned()
                        .unwrap_or_default()
                        .into_iter()
                        .filter_map(|c| c.get("expiration_date").and_then(|x| x.as_str()).map(|s| s.to_string()))
                        .collect();
                    exps.sort(); exps.dedup();
                    return Json(serde_json::json!({"symbol": sym, "expirations": exps}));
                }
            }
        }
        ActiveProvider::Hoodlink { .. } => {}
    }
    Json(serde_json::json!({"symbol": sym, "expirations": []}))
}

async fn market_symbols(Query(q): Query<HashMap<String,String>>) -> Json<serde_json::Value> {
    let query = q.get("q").cloned().unwrap_or_default().to_uppercase();
    let limit = q.get("limit").and_then(|x| x.parse::<usize>().ok()).unwrap_or(20).min(100);
    let symbols = vec![
        ("SPY","SPDR S&P 500 ETF"),("QQQ","Invesco QQQ Trust"),("IWM","iShares Russell 2000 ETF"),
        ("AAPL","Apple Inc."),("MSFT","Microsoft Corp."),("NVDA","NVIDIA Corp."),("AMZN","Amazon.com Inc."),
        ("GOOGL","Alphabet Class A"),("META","Meta Platforms"),("TSLA","Tesla Inc."),("AMD","Advanced Micro Devices"),
        ("NFLX","Netflix Inc."),("JPM","JPMorgan Chase"),("BAC","Bank of America"),("GS","Goldman Sachs"),
        ("XOM","Exxon Mobil"),("CVX","Chevron"),("UNH","UnitedHealth Group"),("PFE","Pfizer Inc."),
        ("PLTR","Palantir"),("COIN","Coinbase"),("MSTR","MicroStrategy")
    ];
    let out: Vec<serde_json::Value> = symbols.into_iter()
        .filter(|(s,n)| query.is_empty() || s.contains(&query) || n.to_uppercase().contains(&query))
        .take(limit)
        .map(|(s,n)| serde_json::json!({"symbol": s, "name": n}))
        .collect();
    let syms: Vec<String> = out.iter().filter_map(|x| x.get("symbol").and_then(|v| v.as_str()).map(|s| s.to_string())).collect();
    Json(serde_json::json!({"symbols": syms, "items": out}))
}
async fn analytics_gex(Path(symbol): Path<String>, Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    analytics_core(symbol, q, s, "gex").await
}
async fn analytics_dex(Path(symbol): Path<String>, Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    analytics_core(symbol, q, s, "dex").await
}
async fn analytics_oi(Path(symbol): Path<String>, Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    analytics_core(symbol, q, s, "oi").await
}

async fn analytics_core(symbol: String, q: HashMap<String,String>, s: AppState, kind: &str) -> Json<serde_json::Value> {
    let sym = symbol.to_uppercase();
    let cache_key = format!("an:{}:{}:{:?}", kind, sym, q);
    if let Ok(Some(v)) = s.lmdb.get_json(&cache_key) { return Json(v); }

    let quote = market_quote(Path(sym.clone()), State(s.clone())).await.0;
    let spot = quote.get("last_price").and_then(|x| x.as_f64()).unwrap_or(0.0);
    let opts = market_options(Path(sym.clone()), Query(q.clone()), State(s.clone())).await.0;
    let arr = opts.as_array().cloned().unwrap_or_default();

    let payload = if kind == "oi" {
        let mut by_strike: std::collections::BTreeMap<i64, (f64, f64)> = std::collections::BTreeMap::new();
        for o in arr {
            let strike = json_num(o.get("strike_price").or_else(|| o.get("strike")));
            if strike <= 0.0 { continue; }
            let key = (strike * 100.0).round() as i64;
            let oi = json_num(o.get("open_interest"));
            let t = o.get("option_type").or_else(|| o.get("type")).and_then(|x| x.as_str()).unwrap_or("").to_lowercase();
            let e = by_strike.entry(key).or_insert((0.0, 0.0));
            if t == "put" { e.1 += oi; } else { e.0 += oi; }
        }
        let data: Vec<serde_json::Value> = by_strike.into_iter().map(|(k, (c, p))| {
            let strike = (k as f64) / 100.0;
            serde_json::json!({"strike": strike, "oi_call": c, "oi_put": p, "oi_total": c + p, "volume_total": 0})
        }).collect();
        serde_json::json!({"symbol": sym, "spot": spot, "expirations": [], "data": data})
    } else {
        let mut by_strike: std::collections::BTreeMap<i64, f64> = std::collections::BTreeMap::new();
        for o in arr {
            let strike = json_num(o.get("strike_price").or_else(|| o.get("strike")));
            if strike <= 0.0 { continue; }
            let key = (strike * 100.0).round() as i64;
            let oi = json_num(o.get("open_interest"));
            let gamma = json_num(o.get("gamma"));
            let delta = json_num(o.get("delta"));
            let t = o.get("option_type").or_else(|| o.get("type")).and_then(|x| x.as_str()).unwrap_or("").to_lowercase();
            let sign = if t == "put" { -1.0 } else { 1.0 };
            let value = if kind == "gex" { sign * gamma * oi } else { sign * delta * oi };
            *by_strike.entry(key).or_insert(0.0) += value;
        }
        let data: Vec<serde_json::Value> = by_strike.into_iter().map(|(k, v)| {
            let strike = (k as f64) / 100.0;
            if kind == "gex" { serde_json::json!({"strike": strike, "gex": v}) }
            else { serde_json::json!({"strike": strike, "dex": v}) }
        }).collect();
        serde_json::json!({"symbol": sym, "spot": spot, "expirations": [], "data": data})
    };

    let _ = s.lmdb.set_json(&cache_key, &payload, 10);
    Json(payload)
}
async fn orders_list() -> Json<serde_json::Value> { Json(serde_json::json!([])) }
async fn orders_create() -> Json<serde_json::Value> { Json(serde_json::json!({"todo":"orders_create"})) }
async fn orders_delete(Path(_): Path<String>) -> Json<serde_json::Value> { Json(serde_json::json!({"ok": true})) }
async fn account_get() -> Json<serde_json::Value> { Json(serde_json::json!({"todo":"account"})) }
async fn report_daily_bias(Path(_): Path<String>) -> String { "TODO: daily bias".into() }
async fn news_feed(Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    let limit = q.get("limit").and_then(|x| x.parse::<usize>().ok()).unwrap_or(20).clamp(1, 50);
    let symbols = q.get("symbols").cloned().unwrap_or_default();
    let client = reqwest::Client::new();

    match active_provider(&s) {
        ActiveProvider::Alpaca { api_key, secret_key, data_url } => {
            let mut params: Vec<(String,String)> = vec![("limit".into(), limit.to_string())];
            if !symbols.trim().is_empty() { params.push(("symbols".into(), symbols)); }
            let r = client
                .get(format!("{}/v1beta1/news", data_url))
                .headers(alpaca_headers(&api_key, &secret_key))
                .query(&params)
                .send().await;
            if let Ok(resp) = r {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    let items = v.get("news").and_then(|x| x.as_array()).cloned().unwrap_or_default();
                    let out: Vec<serde_json::Value> = items.into_iter().map(|n| serde_json::json!({
                        "id": n.get("id").cloned().unwrap_or(serde_json::json!("")),
                        "headline": n.get("headline").cloned().unwrap_or(serde_json::json!("")),
                        "summary": n.get("summary").cloned().unwrap_or(serde_json::json!("")),
                        "source": n.get("source").cloned().unwrap_or(serde_json::json!("")),
                        "url": n.get("url").cloned().unwrap_or(serde_json::json!("")),
                        "created_at": n.get("created_at").cloned().unwrap_or(serde_json::json!("")),
                        "symbols": n.get("symbols").cloned().unwrap_or(serde_json::json!([])),
                    })).collect();
                    return Json(serde_json::Value::Array(out));
                }
            }
        }
        ActiveProvider::Hoodlink { .. } => {}
    }

    Json(serde_json::json!([]))
}
async fn ai_status() -> Json<serde_json::Value> { Json(serde_json::json!({"configured": false})) }
async fn ai_chat() -> Json<serde_json::Value> { Json(serde_json::json!({"reply":"TODO"})) }

async fn screener_get(Query(q): Query<HashMap<String,String>>, State(s): State<AppState>) -> Json<serde_json::Value> {
    let page = q.get("page").and_then(|x| x.parse::<usize>().ok()).unwrap_or(1).max(1);
    let page_size = q.get("page_size").and_then(|x| x.parse::<usize>().ok()).unwrap_or(50).clamp(1, 200);
    let cache_key = "screener:snapshot:v1";

    let snapshot = if let Ok(Some(v)) = s.lmdb.get_json(cache_key) {
        v
    } else {
        let universe = vec!["SPY","QQQ","IWM","AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AMD","NFLX","JPM","BAC","GS","XOM","CVX","UNH","PFE","PLTR","COIN","MSTR"];
        let mut items: Vec<serde_json::Value> = Vec::new();
        for sym in universe {
            let quote = market_quote(Path(sym.to_string()), State(s.clone())).await.0;
            let p = quote.get("last_price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            items.push(serde_json::json!({
                "s": sym,
                "p": p,
                "sec": "Unknown",
                "mc": 0,
                "rv": 0,
                "c1m": 0,
                "c1h": 0,
                "c1d": 0,
                "c1w": 0,
                "c1mo": 0,
                "c1y": 0,
                "ytd": 0,
                "lg": "",
            }));
        }
        let payload = serde_json::json!({"items": items});
        let _ = s.lmdb.set_json(cache_key, &payload, 15);
        payload
    };

    let items = snapshot.get("items").and_then(|x| x.as_array()).cloned().unwrap_or_default();
    let total = items.len();
    let a = (page - 1) * page_size;
    let b = (a + page_size).min(total);
    let slice = if a < total { items[a..b].to_vec() } else { vec![] };
    Json(serde_json::json!({"i": slice, "t": total, "p": page, "ps": page_size}))
}
async fn providers_list(State(s): State<AppState>) -> Json<serde_json::Value> {
    let providers = s.sqlite.list_providers().unwrap_or_default();
    let data = s.sqlite.get_setting("active_provider_data").ok().flatten();
    let ai = s.sqlite.get_setting("active_provider_ai").ok().flatten();
    Json(serde_json::json!({"providers": providers, "active": {"data": data, "ai": ai}}))
}

async fn providers_create(State(s): State<AppState>, Json(req): Json<ProviderUpsertReq>) -> Json<serde_json::Value> {
    let name = req.name.unwrap_or_else(|| req.r#type.clone());
    let id = s.sqlite.upsert_provider(None, &req.r#type, &name, req.config).unwrap_or_default();
    Json(serde_json::json!({"id": id}))
}

async fn providers_get(State(s): State<AppState>, Path(provider_id): Path<String>) -> Json<serde_json::Value> {
    let p = s.sqlite.get_provider(&provider_id).ok().flatten();
    Json(serde_json::json!(p))
}

async fn providers_update(State(s): State<AppState>, Path(provider_id): Path<String>, Json(req): Json<ProviderUpsertReq>) -> Json<serde_json::Value> {
    let name = req.name.unwrap_or_else(|| req.r#type.clone());
    let id = s.sqlite.upsert_provider(Some(provider_id), &req.r#type, &name, req.config).unwrap_or_default();
    Json(serde_json::json!({"id": id, "ok": true}))
}

async fn providers_delete(State(s): State<AppState>, Path(provider_id): Path<String>) -> Json<serde_json::Value> {
    let _ = s.sqlite.delete_provider(&provider_id);
    Json(serde_json::json!({"ok": true}))
}

async fn providers_activate(State(s): State<AppState>, Path(provider_id): Path<String>, Json(req): Json<ActivateReq>) -> Json<serde_json::Value> {
    let key = if req.role == "ai" { "active_provider_ai" } else { "active_provider_data" };
    let _ = s.sqlite.set_setting(key, &provider_id);
    Json(serde_json::json!({"ok": true}))
}

async fn settings_get(State(s): State<AppState>) -> Json<serde_json::Value> {
    let alpaca = s.sqlite.list_providers().unwrap_or_default().into_iter().find(|p| p.r#type == "alpaca").map(|p| p.config).unwrap_or_else(|| serde_json::json!({}));
    let hoodlink = s.sqlite.list_providers().unwrap_or_default().into_iter().find(|p| p.r#type == "hoodlink").map(|p| p.config).unwrap_or_else(|| serde_json::json!({}));
    let active_provider = s.sqlite.get_setting("active_provider_data").ok().flatten();
    Json(serde_json::json!({"alpaca": alpaca, "hoodlink": hoodlink, "active_provider": active_provider}))
}

async fn settings_alpaca(State(s): State<AppState>, Json(cfg): Json<serde_json::Value>) -> Json<serde_json::Value> {
    let _ = s.sqlite.upsert_provider(None, "alpaca", "Alpaca", cfg);
    Json(serde_json::json!({"ok": true}))
}

async fn settings_hoodlink(State(s): State<AppState>, Json(cfg): Json<serde_json::Value>) -> Json<serde_json::Value> {
    let _ = s.sqlite.upsert_provider(None, "hoodlink", "Hoodlink", cfg);
    Json(serde_json::json!({"ok": true}))
}

async fn settings_active_provider(State(s): State<AppState>, Json(req): Json<ActiveProviderReq>) -> Json<serde_json::Value> {
    let _ = s.sqlite.set_setting("active_provider_data", &req.provider);
    Json(serde_json::json!({"ok": true}))
}

async fn settings_ui_theme_get(State(s): State<AppState>) -> Json<serde_json::Value> {
    let raw = s.sqlite.get_setting("ui_theme").ok().flatten().unwrap_or_else(|| "{}".into());
    let v: serde_json::Value = serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({"mode":"dark"}));
    Json(v)
}

async fn settings_ui_theme_put(State(s): State<AppState>, Json(req): Json<ThemeReq>) -> Json<serde_json::Value> {
    let payload = serde_json::json!({"mode": req.mode, "accent": req.accent, "bull": req.bull, "bear": req.bear});
    let _ = s.sqlite.set_setting("ui_theme", &payload.to_string());
    Json(serde_json::json!({"ok": true}))
}

async fn ws_quotes(ws: WebSocketUpgrade, State(s): State<AppState>, Path(symbol): Path<String>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_quotes(socket, s, symbol))
}

async fn handle_ws_quotes(mut socket: WebSocket, state: AppState, symbol: String) {
    let sym = symbol.to_uppercase();
    loop {
        let payload = market_quote(Path(sym.clone()), State(state.clone())).await.0;
        if socket.send(Message::Text(payload.to_string())).await.is_err() {
            break;
        }
        tokio::select! {
            _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => {},
            msg = socket.recv() => {
                if msg.is_none() { break; }
            }
        }
    }
}

async fn ws_screener(ws: WebSocketUpgrade, State(s): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_screener(socket, s))
}

async fn handle_ws_screener(mut socket: WebSocket, state: AppState) {
    let mut symbols: Vec<String> = vec!["SPY".into(), "QQQ".into()];
    loop {
        if let Some(Ok(Message::Text(txt))) = socket.recv().await {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt) {
                if let Some(arr) = v.get("symbols").and_then(|x| x.as_array()) {
                    symbols = arr.iter().filter_map(|x| x.as_str().map(|s| s.to_uppercase())).take(100).collect();
                }
            }
        }

        let mut items = Vec::new();
        for sym in &symbols {
            let q = market_quote(Path(sym.clone()), State(state.clone())).await.0;
            items.push(serde_json::json!({
                "s": sym,
                "p": q.get("last_price").cloned().unwrap_or(serde_json::json!(0)),
                "rv": 0,
                "c1d": 0,
            }));
        }
        let msg = serde_json::json!({"type":"screener","items":items}).to_string();
        if socket.send(Message::Text(msg)).await.is_err() { break; }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}

async fn ws_orderflow(ws: WebSocketUpgrade, State(s): State<AppState>, Path(symbol): Path<String>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_orderflow(socket, s, symbol))
}

async fn handle_ws_orderflow(mut socket: WebSocket, state: AppState, symbol: String) {
    let sym = symbol.to_uppercase();
    loop {
        let trades = market_trades(Path(sym.clone()), Query(HashMap::from([(String::from("limit"), String::from("500"))])), State(state.clone())).await.0;
        let arr = trades.as_array().cloned().unwrap_or_default();
        let mut by_sec: HashMap<i64, (f64,f64)> = HashMap::new();
        let mut prev = 0.0;
        for t in arr {
            let price = t.get("price").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let size = t.get("size").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let ts = t.get("timestamp").and_then(|x| x.as_str()).unwrap_or("");
            if price <= 0.0 || size <= 0.0 || ts.is_empty() { continue; }
            let sec = DateTime::<FixedOffset>::parse_from_rfc3339(ts).map(|d| d.timestamp()).unwrap_or(0);
            let e = by_sec.entry(sec).or_insert((0.0,0.0));
            if prev > 0.0 {
                if price >= prev { e.0 += size; } else { e.1 += size; }
            } else { e.0 += size * 0.5; e.1 += size * 0.5; }
            prev = price;
        }
        let mut buckets: Vec<serde_json::Value> = by_sec.into_iter().map(|(sec,(buy,sell))| serde_json::json!({"sec":sec,"buy":buy,"sell":sell})).collect();
        buckets.sort_by(|a,b| a.get("sec").and_then(|x| x.as_i64()).cmp(&b.get("sec").and_then(|x| x.as_i64())));
        let msg = serde_json::json!({"type":"orderflow","symbol":sym,"buckets":buckets}).to_string();
        if socket.send(Message::Text(msg)).await.is_err() { break; }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}
