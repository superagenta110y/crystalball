"""
Hoodwink provider — bridges CrystalBall to Robinhood via the local
Hoodwink server (FastAPI + Chrome extension). Hoodwink must be running
on the configured host before this provider can be used.
"""
from __future__ import annotations
from typing import Any
import httpx
from .base import BaseProvider
from config import get_settings


class HoodwinkProvider(BaseProvider):
    def __init__(self, config: dict | None = None):
        s = get_settings()
        cfg = config or {}
        url     = cfg.get("url")     or s.hoodwink_url
        api_key = cfg.get("api_key") or s.hoodwink_api_key
        self._base    = url.rstrip("/") + "/api/v1"
        self._headers = {"X-API-Key": api_key}

    async def _get(self, path: str, **params) -> Any:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(f"{self._base}{path}", headers=self._headers, params=params)
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, body: dict) -> Any:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.post(f"{self._base}{path}", headers=self._headers, json=body)
            r.raise_for_status()
            return r.json()

    async def _delete(self, path: str) -> Any:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.delete(f"{self._base}{path}", headers=self._headers)
            r.raise_for_status()
            return r.json()

    async def get_quote(self, symbol: str) -> dict[str, Any]:
        data = await self._get(f"/market/quote/{symbol}")
        return {
            "symbol": symbol,
            "bid_price": data.get("bid_price"),
            "ask_price": data.get("ask_price"),
            "last_price": data.get("last_trade_price") or data.get("ask_price"),
            "timestamp": data.get("updated_at"),
        }

    async def get_history(self, symbol: str, timeframe: str = "1Day", limit: int = 252) -> list[dict[str, Any]]:
        # Map CrystalBall timeframe → Hoodwink interval/span
        interval_map = {
            "1Min": ("5minute", "day"),
            "5Min": ("5minute", "week"),
            "1Hour": ("hour", "3month"),
            "1Day": ("day", "year"),
            "1Week": ("week", "5year"),
        }
        interval, span = interval_map.get(timeframe, ("day", "year"))
        data = await self._get(f"/market/history/{symbol}", interval=interval, span=span)
        historicals = data.get("historicals", [])
        return [
            {
                "timestamp": b.get("begins_at"),
                "open": float(b.get("open_price", 0)),
                "high": float(b.get("high_price", 0)),
                "low": float(b.get("low_price", 0)),
                "close": float(b.get("close_price", 0)),
                "volume": int(b.get("volume", 0)),
            }
            for b in historicals
        ]

    async def get_options_chain(self, symbol: str, expiration_date: str | None = None, option_type: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {}
        if expiration_date:
            params["expiration_dates"] = expiration_date
        if option_type:
            params["type"] = option_type
        data = await self._get(f"/market/options/{symbol}", **params)
        results = data.get("results", [])
        chain = []
        for opt in results:
            chain.append({
                "symbol": opt.get("chain_symbol", symbol),
                "strike_price": float(opt.get("strike_price", 0)),
                "expiration_date": opt.get("expiration_date"),
                "option_type": opt.get("type"),
                "bid_price": _f(opt.get("bid_price")),
                "ask_price": _f(opt.get("ask_price")),
                "mark_price": _f(opt.get("mark_price")),
                "delta": _f(opt.get("delta")),
                "gamma": _f(opt.get("gamma")),
                "theta": _f(opt.get("theta")),
                "vega": _f(opt.get("vega")),
                "open_interest": _f(opt.get("open_interest")),
                "implied_volatility": _f(opt.get("implied_volatility")),
                "volume": _f(opt.get("volume")),
            })
        return chain

    async def place_order(self, order: dict[str, Any]) -> dict[str, Any]:
        if order.get("asset_class") == "options":
            return await self._post("/trading/options/orders", order)
        return await self._post("/trading/orders", order)

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        return await self._delete(f"/trading/orders/{order_id}")

    async def get_orders(self, status: str = "open", limit: int = 50) -> list[dict[str, Any]]:
        active_only = status == "open"
        data = await self._get("/trading/orders", active_only=str(active_only).lower())
        return data.get("results", [])[:limit]

    async def get_account(self) -> dict[str, Any]:
        data = await self._get("/account/accounts")
        accounts = data.get("results", [data])
        a = accounts[0] if accounts else {}
        portfolio = await self._get("/account/portfolio")
        return {
            "id": a.get("account_number"),
            "equity": portfolio.get("equity"),
            "cash": a.get("cash_balances", {}).get("cash") if isinstance(a.get("cash_balances"), dict) else None,
            "buying_power": a.get("buying_power"),
            "portfolio_value": portfolio.get("market_value"),
            "pattern_day_trader": a.get("is_pattern_day_trader"),
            "trading_blocked": a.get("is_pinnacle_account"),
        }


def _f(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None
