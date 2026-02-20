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
        from datetime import date, timedelta
        from services.bs import bs_greeks, iv_from_price

        today = date.today()
        exp_gte = expiration_date or today.strftime("%Y-%m-%d")
        exp_lte = expiration_date or (today + timedelta(days=1)).strftime("%Y-%m-%d")

        # 1. Fetch contracts (OI, strike, type)
        params: dict[str, Any] = {
            "underlying_symbols": symbol,
            "expiration_date_gte": exp_gte,
            "expiration_date_lte": exp_lte,
            "limit": 500,
        }
        if option_type:
            params["type"] = option_type

        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get(
                f"https://paper-api.alpaca.markets/v2/options/contracts",
                headers=self._headers,
                params=params,
            )
            r.raise_for_status()
            contracts = r.json().get("option_contracts", [])

            # 2. Fetch snapshots for market data (bid/ask)
            syms = [con["symbol"] for con in contracts if con.get("symbol")]
            snap_map: dict[str, dict] = {}
            if syms:
                # batch in groups of 100
                for i in range(0, len(syms), 100):
                    batch = syms[i:i+100]
                    sr = await c.get(
                        f"{self._data_url}/v1beta1/options/snapshots",
                        headers=self._headers,
                        params={"symbols": ",".join(batch)},
                    )
                    if sr.status_code == 200:
                        snap_map.update(sr.json().get("snapshots", {}))

            # 3. Get spot price for BS
            try:
                qr = await c.get(
                    f"{self._data_url}/v2/stocks/{symbol}/quotes/latest",
                    headers=self._headers,
                )
                spot = float(qr.json().get("quote", {}).get("ap", 0)) if qr.status_code == 200 else 0
            except Exception:
                spot = 0

        # 4. Combine + compute BS Greeks
        chain = []
        for con in contracts:
            sym = con.get("symbol", "")
            strike = float(con.get("strike_price") or 0)
            exp = con.get("expiration_date", "")
            otype = con.get("type", "call")
            oi = float(con.get("open_interest") or 0)
            snap = snap_map.get(sym, {})
            quote = snap.get("latestQuote", {})
            bid = float(quote.get("bp") or 0)
            ask = float(quote.get("ap") or 0)
            mark = round((bid + ask) / 2, 2) if bid and ask else None

            # Compute Greeks via BS
            try:
                exp_dt = date.fromisoformat(exp)
                T = max((exp_dt - today).days / 365, 0.0)
            except Exception:
                T = 0.0

            iv = 0.20
            greeks = {"delta": None, "gamma": None, "theta": None, "vega": None}
            if spot > 0 and T > 0 and mark and mark > 0:
                iv = iv_from_price(mark, spot, strike, T, option_type=otype)
                g = bs_greeks(spot, strike, T, sigma=iv, option_type=otype)
                greeks = g

            chain.append({
                "symbol": sym,
                "strike_price": strike,
                "expiration_date": exp,
                "option_type": otype,
                "bid_price": bid or None,
                "ask_price": ask or None,
                "mark_price": mark,
                "delta": greeks["delta"],
                "gamma": greeks["gamma"],
                "theta": greeks["theta"],
                "vega": greeks["vega"],
                "open_interest": oi,
                "implied_volatility": iv,
            })
        return chain

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

    async def get_trades(self, symbol: str, limit: int = 200) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(
                f"{self._data_url}/v2/stocks/{symbol}/trades",
                headers=self._headers,
                params={"limit": limit, "feed": "sip"},
            )
            if r.status_code != 200:
                return []
            trades = r.json().get("trades", [])
            return [{"price": float(t.get("p", 0)), "size": int(t.get("s", 0)), "timestamp": t.get("t", "")} for t in trades]

    async def get_news(self, symbols: list[str], limit: int = 20) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(
                f"{self._data_url}/v1beta1/news",
                headers=self._headers,
                params={"symbols": ",".join(symbols), "limit": limit, "sort": "desc"},
            )
            if r.status_code != 200:
                return []
            items = r.json().get("news", [])
            return [
                {
                    "id": str(item.get("id", "")),
                    "headline": item.get("headline", ""),
                    "summary": item.get("summary", ""),
                    "source": item.get("source", ""),
                    "symbols": item.get("symbols", []),
                    "url": item.get("url", ""),
                    "createdAt": item.get("created_at", ""),
                }
                for item in items
            ]

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
