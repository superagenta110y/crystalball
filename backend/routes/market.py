from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider
from services import history_cache

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{symbol}")
async def quote(symbol: str, provider: BaseProvider = Depends(get_provider)):
    return await provider.get_quote(symbol.upper())


def _tf_sec(tf: str) -> int:
    t = (tf or "1Day").lower()
    return {
        "1min": 60, "5min": 300, "15min": 900, "30min": 1800,
        "1hour": 3600, "4hour": 14400, "1day": 86400, "1week": 604800,
    }.get(t, 86400)


def _parse_latest_to_end_ts(latest: str | None, timeframe: str) -> int:
    if not latest or latest == "now":
        ts = int(datetime.now(timezone.utc).timestamp())
    else:
        # accept unix seconds or ISO-8601
        try:
            ts = int(float(latest))
        except Exception:
            dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
            ts = int(dt.timestamp())
    step = _tf_sec(timeframe)
    return (ts // step) * step


def _ts_to_iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


@router.get("/history/{symbol}")
async def history(
    symbol: str,
    timeframe: str = Query("1Day", description="1Min|5Min|1Hour|1Day|1Week"),
    limit: int = Query(252, le=5000),
    start: str | None = Query(None, description="ISO timestamp"),
    end: str | None = Query(None, description="ISO timestamp"),
    latest: str | None = Query(None, description="unix seconds/ISO anchor or 'now' for paged mode"),
    provider: BaseProvider = Depends(get_provider),
):
    sym = symbol.upper()

    # Cursor-based mode (preferred for frontend panning)
    if latest is not None:
        end_ts = _parse_latest_to_end_ts(latest, timeframe)
        end_iso = _ts_to_iso(end_ts)

        # Constrain cursor loads to a recent bounded window to avoid provider returning stale/ancient slices.
        req_start = start
        if not req_start:
            step = _tf_sec(timeframe)
            lookback_bars = max(limit * 3, 400)
            start_ts = max(0, end_ts - step * lookback_bars)
            req_start = _ts_to_iso(start_ts)

        key = f"hist:{sym}:{timeframe}:{limit}:{req_start}:{end_iso}"
        cached = history_cache.get(key)
        if cached is not None:
            return cached

        bars = await provider.get_history(sym, timeframe=timeframe, limit=limit, start=req_start, end=end_iso)

        compact = [
            {"ts": b.get("timestamp"), "o": b.get("open"), "h": b.get("high"), "l": b.get("low"), "c": b.get("close"), "v": b.get("volume")}
            for b in bars
        ]
        payload = {"s": sym, "tf": timeframe, "b": compact}
        history_cache.setex(key, history_cache.ttl_for_timeframe(timeframe), payload)
        return payload

    # Legacy mode (backward compatible)
    return await provider.get_history(sym, timeframe=timeframe, limit=limit, start=start, end=end)


@router.get("/trades/{symbol}")
async def trades(
    symbol: str,
    limit: int = Query(200, le=1000),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_trades(symbol.upper(), limit=limit)


@router.get("/options/{symbol}")
async def options_chain(
    symbol: str,
    expiration_date: str | None = Query(None, description="YYYY-MM-DD"),
    option_type: str | None = Query(None, description="call|put"),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_options_chain(symbol.upper(), expiration_date=expiration_date, option_type=option_type)


@router.get("/expirations/{symbol}")
async def option_expirations(
    symbol: str,
    provider: BaseProvider = Depends(get_provider),
):
    expirations = await provider.get_option_expirations(symbol.upper())
    return {"symbol": symbol.upper(), "expirations": expirations}


POPULAR_SYMBOLS = [
    ("SPY","SPDR S&P 500 ETF"),("QQQ","Invesco QQQ Trust"),("IWM","iShares Russell 2000 ETF"),("DIA","SPDR Dow Jones ETF"),
    ("AAPL","Apple Inc."),("MSFT","Microsoft Corp."),("NVDA","NVIDIA Corp."),("AMZN","Amazon.com Inc."),("GOOGL","Alphabet Class A"),("META","Meta Platforms"),("TSLA","Tesla Inc."),("AMD","Advanced Micro Devices"),("NFLX","Netflix Inc."),
    ("JPM","JPMorgan Chase"),("BAC","Bank of America"),("GS","Goldman Sachs"),("XOM","Exxon Mobil"),("CVX","Chevron Corp."),("UNH","UnitedHealth Group"),("PFE","Pfizer Inc."),
    ("PLTR","Palantir Technologies"),("COIN","Coinbase Global"),("MSTR","MicroStrategy"),("HOOD","Robinhood Markets"),("SOFI","SoFi Technologies"),
    ("BABA","Alibaba Group"),("NIO","NIO Inc."),("DIS","Walt Disney Co."),("KO","Coca-Cola Co."),("WMT","Walmart Inc."),
]


@router.get("/symbols")
async def symbol_suggestions(
    q: str = Query("", description="Prefix or partial symbol"),
    limit: int = Query(20, ge=1, le=100),
):
    query = (q or "").strip().upper()
    if not query:
        items = [{"symbol": s, "name": n} for s, n in POPULAR_SYMBOLS[:limit]]
        return {"symbols": [x["symbol"] for x in items], "items": items}

    starts = [(s, n) for s, n in POPULAR_SYMBOLS if s.startswith(query) or n.upper().startswith(query)]
    contains = [(s, n) for s, n in POPULAR_SYMBOLS if (query in s or query in n.upper()) and (s, n) not in starts]
    merged = (starts + contains)[:limit]
    items = [{"symbol": s, "name": n} for s, n in merged]
    return {"symbols": [x["symbol"] for x in items], "items": items}
