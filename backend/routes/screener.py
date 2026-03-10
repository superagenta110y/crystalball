from __future__ import annotations

import json
from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider

router = APIRouter(prefix="/screener", tags=["screener"])

UNIVERSE = {
    "SPY": {"sec": "ETF", "mc": 500, "logo": "spdrs.com"},
    "QQQ": {"sec": "ETF", "mc": 300, "logo": "invesco.com"},
    "IWM": {"sec": "ETF", "mc": 80, "logo": "ishares.com"},
    "AAPL": {"sec": "Technology", "mc": 3200, "logo": "apple.com"},
    "MSFT": {"sec": "Technology", "mc": 3100, "logo": "microsoft.com"},
    "NVDA": {"sec": "Technology", "mc": 2800, "logo": "nvidia.com"},
    "AMZN": {"sec": "Consumer", "mc": 1900, "logo": "amazon.com"},
    "GOOGL": {"sec": "Technology", "mc": 2200, "logo": "abc.xyz"},
    "META": {"sec": "Technology", "mc": 1600, "logo": "meta.com"},
    "TSLA": {"sec": "Consumer", "mc": 900, "logo": "tesla.com"},
    "AMD": {"sec": "Technology", "mc": 350, "logo": "amd.com"},
    "NFLX": {"sec": "Communication", "mc": 250, "logo": "netflix.com"},
    "JPM": {"sec": "Financials", "mc": 600, "logo": "jpmorganchase.com"},
    "BAC": {"sec": "Financials", "mc": 350, "logo": "bankofamerica.com"},
    "GS": {"sec": "Financials", "mc": 150, "logo": "goldmansachs.com"},
    "XOM": {"sec": "Energy", "mc": 450, "logo": "exxonmobil.com"},
    "CVX": {"sec": "Energy", "mc": 300, "logo": "chevron.com"},
    "UNH": {"sec": "Healthcare", "mc": 450, "logo": "unitedhealthgroup.com"},
    "PFE": {"sec": "Healthcare", "mc": 160, "logo": "pfizer.com"},
    "PLTR": {"sec": "Technology", "mc": 70, "logo": "palantir.com"},
    "COIN": {"sec": "Financials", "mc": 60, "logo": "coinbase.com"},
    "MSTR": {"sec": "Technology", "mc": 40, "logo": "microstrategy.com"},
}


def _close(arr: list[dict], idx_from_end: int) -> float:
    if not arr:
        return 0.0
    i = max(0, len(arr) - 1 - idx_from_end)
    x = arr[i]
    return float(x.get("close") or x.get("c") or 0)


def _pct(a: float, b: float) -> float:
    return ((a - b) / b) * 100 if a and b else 0.0


def _matches(row: dict, cond: dict) -> bool:
    f = str(cond.get("f") or "")
    op = str(cond.get("op") or "=")
    v = cond.get("v")
    raw = row.get(f)
    if f in {"sec", "s"}:
        vals = [x.strip() for x in str(v or "").split(",") if x.strip()]
        if op == "in":
            return str(raw) in vals
        if op == "not-in":
            return str(raw) not in vals
        if op == "=":
            return str(raw) == str(v)
        if op == "!=":
            return str(raw) != str(v)
        return True

    try:
        a = float(raw)
        b = float(v)
    except Exception:
        return True
    if op == "=":
        return a == b
    if op == "!=":
        return a != b
    if op == ">":
        return a > b
    if op == "<":
        return a < b
    if op == ">=":
        return a >= b
    if op == "<=":
        return a <= b
    return True


@router.get("")
async def screener(
    symbols: str | None = Query(None, description="csv symbols; defaults to built-in universe"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = Query("c1d"),
    dir: str = Query("desc"),
    filters: str | None = Query(None, description="JSON array of compact conditions [{f,op,v}]"),
    provider: BaseProvider = Depends(get_provider),
):
    syms = [s.strip().upper() for s in symbols.split(",")] if symbols else list(UNIVERSE.keys())

    rows: list[dict] = []
    for sym in syms:
        try:
            q = await provider.get_quote(sym)
            h1 = await provider.get_history(sym, timeframe="1Min", limit=390)
            hh = await provider.get_history(sym, timeframe="1Hour", limit=200)
            dd = await provider.get_history(sym, timeframe="1Day", limit=260)
            p = float(q.get("last_price") or 0)
            vol_now = sum(float(x.get("volume") or x.get("v") or 0) for x in h1)
            dd30 = dd[-30:]
            vol_avg = (sum(float(x.get("volume") or x.get("v") or 0) for x in dd30) / max(1, len(dd30))) if dd30 else 0
            rows.append({
                "s": sym,
                "p": p,
                "sec": (UNIVERSE.get(sym) or {}).get("sec", "Unknown"),
                "mc": float((UNIVERSE.get(sym) or {}).get("mc", 0)),
                "rv": (vol_now / vol_avg) if vol_avg else 0,
                "c1m": _pct(p, _close(h1, 1)),
                "c1h": _pct(p, _close(hh, 1)),
                "c1d": _pct(p, _close(dd, 1)),
                "c1w": _pct(p, _close(dd, 5)),
                "c1mo": _pct(p, _close(dd, 21)),
                "c1y": _pct(p, _close(dd, 252)),
                "ytd": _pct(p, _close(dd, min(max(0, len(dd)-1), 60))),
                "lg": (UNIVERSE.get(sym) or {}).get("logo", ""),
            })
        except Exception:
            continue

    conds = []
    if filters:
        try:
            conds = json.loads(filters)
            if not isinstance(conds, list):
                conds = []
        except Exception:
            conds = []

    if conds:
        rows = [r for r in rows if all(_matches(r, c if isinstance(c, dict) else {}) for c in conds)]

    rev = dir.lower() != "asc"
    if sort in {"s", "sec"}:
        rows.sort(key=lambda x: str(x.get(sort, "")), reverse=rev)
    else:
        rows.sort(key=lambda x: float(x.get(sort, 0) or 0), reverse=rev)

    total = len(rows)
    a = (page - 1) * page_size
    b = a + page_size
    return {"i": rows[a:b], "t": total, "p": page, "ps": page_size}
