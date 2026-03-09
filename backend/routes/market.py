from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{symbol}")
async def quote(symbol: str, provider: BaseProvider = Depends(get_provider)):
    return await provider.get_quote(symbol.upper())


@router.get("/history/{symbol}")
async def history(
    symbol: str,
    timeframe: str = Query("1Day", description="1Min|5Min|1Hour|1Day|1Week"),
    limit: int = Query(252, le=5000),
    start: str | None = Query(None, description="ISO timestamp"),
    end: str | None = Query(None, description="ISO timestamp"),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_history(symbol.upper(), timeframe=timeframe, limit=limit, start=start, end=end)


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
