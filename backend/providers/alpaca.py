"""Alpaca Markets provider (paper + live trading, market data)."""
from __future__ import annotations
from typing import Any
import httpx
from .base import BaseProvider
from config import get_settings


class AlpacaProvider(BaseProvider):
    def __init__(self):
        s = get_settings()
        self._headers = {
            "APCA-API-KEY-ID": s.alpaca_api_key,
            "APCA-API-SECRET-KEY": s.alpaca_secret_key,
        }
        self._trade_url = s.alpaca_base_url
        self._data_url = s.alpaca_data_url

    async def get_quote(self, symbol: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"{self._data_url}/v2/stocks/{symbol}/quotes/latest",
                headers=self._headers,
            )
            r.raise_for_status()
            q = r.json().get("quote", {})
            return {
                "symbol": symbol,
                "bid_price": q.get("bp"),
                "ask_price": q.get("ap"),
                "last_price": q.get("ap"),
                "timestamp": q.get("t"),
            }

    async def get_history(self, symbol: str, timeframe: str = "1Day", limit: int = 252) -> list[dict[str, Any]]:
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"{self._data_url}/v2/stocks/{symbol}/bars",
                headers=self._headers,
                params={"timeframe": timeframe, "limit": limit, "adjustment": "raw"},
            )
            r.raise_for_status()
            bars = r.json().get("bars", [])
            return [
                {"timestamp": b["t"], "open": b["o"], "high": b["h"],
                 "low": b["l"], "close": b["c"], "volume": b["v"]}
                for b in bars
            ]

    async def get_options_chain(self, symbol: str, expiration_date: str | None = None, option_type: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"underlying_symbols": symbol, "limit": 1000}
        if expiration_date:
            params["expiration_date"] = expiration_date
        if option_type:
            params["type"] = option_type
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"{self._data_url}/v2/options/contracts",
                headers=self._headers,
                params=params,
            )
            r.raise_for_status()
            contracts = r.json().get("option_contracts", [])
            return [
                {
                    "symbol": con.get("symbol"),
                    "strike_price": float(con.get("strike_price", 0)),
                    "expiration_date": con.get("expiration_date"),
                    "option_type": con.get("type"),
                    "bid_price": None,
                    "ask_price": None,
                    "mark_price": None,
                    "delta": None,
                    "gamma": None,
                    "theta": None,
                    "vega": None,
                    "open_interest": float(con.get("open_interest", 0)),
                    "implied_volatility": None,
                }
                for con in contracts
            ]

    async def place_order(self, order: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient() as c:
            r = await c.post(
                f"{self._trade_url}/v2/orders",
                headers=self._headers,
                json=order,
            )
            r.raise_for_status()
            return r.json()

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as c:
            r = await c.delete(
                f"{self._trade_url}/v2/orders/{order_id}",
                headers=self._headers,
            )
            r.raise_for_status()
            return {"cancelled": order_id}

    async def get_orders(self, status: str = "open", limit: int = 50) -> list[dict[str, Any]]:
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"{self._trade_url}/v2/orders",
                headers=self._headers,
                params={"status": status, "limit": limit},
            )
            r.raise_for_status()
            return r.json()

    async def get_account(self) -> dict[str, Any]:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{self._trade_url}/v2/account", headers=self._headers)
            r.raise_for_status()
            a = r.json()
            return {
                "id": a.get("id"),
                "equity": a.get("equity"),
                "cash": a.get("cash"),
                "buying_power": a.get("buying_power"),
                "portfolio_value": a.get("portfolio_value"),
                "pattern_day_trader": a.get("pattern_day_trader"),
                "trading_blocked": a.get("trading_blocked"),
            }
