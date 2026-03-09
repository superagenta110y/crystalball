"""Alpaca Markets provider (paper + live trading, market data)."""
from __future__ import annotations
from typing import Any
from datetime import date, datetime, timedelta, timezone
import httpx
from .base import BaseProvider
from config import get_settings


class AlpacaProvider(BaseProvider):
    def __init__(self, config: dict | None = None):
        s = get_settings()
        cfg = config or {}
        api_key    = cfg.get("api_key")    or s.alpaca_api_key
        secret_key = cfg.get("secret_key") or s.alpaca_secret_key
        paper      = cfg.get("paper",      s.alpaca_paper)
        data_url   = cfg.get("data_url")   or s.alpaca_data_url
        trade_base = "https://paper-api.alpaca.markets" if paper else "https://api.alpaca.markets"

        self._headers = {
            "APCA-API-KEY-ID":     api_key,
            "APCA-API-SECRET-KEY": secret_key,
        }
        self._trade_url = cfg.get("trade_url") or trade_base
        self._data_url  = data_url
        self._feed      = cfg.get("feed") or s.alpaca_feed

    async def get_quote(self, symbol: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as c:
            bid = ask = last = ts = None

            # Best effort: latest quote
            qr = await c.get(
                f"{self._data_url}/v2/stocks/{symbol}/quotes/latest",
                headers=self._headers,
            )
            if qr.status_code == 200:
                q = qr.json().get("quote", {})
                bid = q.get("bp")
                ask = q.get("ap")
                ts = q.get("t")

            # Prefer latest trade as last price when available
            tr = await c.get(
                f"{self._data_url}/v2/stocks/{symbol}/trades/latest",
                headers=self._headers,
            )
            if tr.status_code == 200:
                t = tr.json().get("trade", {})
                last = t.get("p")
                ts = t.get("t") or ts

            if last is None and bid is not None and ask is not None:
                last = (float(bid) + float(ask)) / 2
            if last is None:
                last = ask or bid

            return {
                "symbol": symbol,
                "bid_price": bid,
                "ask_price": ask,
                "last_price": last,
                "timestamp": ts,
            }

    async def get_history(self, symbol: str, timeframe: str = "1Day", limit: int = 252) -> list[dict[str, Any]]:
        # Alpaca can return empty bars when only limit is provided (e.g., weekends/after-hours).
        # Provide an explicit time window so historical candles always resolve.
        tf = (timeframe or "1Day").strip()
        tf_to_minutes = {
            "1Min": 1,
            "5Min": 5,
            "15Min": 15,
            "30Min": 30,
            "1Hour": 60,
            "1Day": 390,
            "1Week": 5 * 390,
        }
        minutes = tf_to_minutes.get(tf, 390)
        # Add generous padding to survive weekends/holidays and sparse feeds.
        # For intraday, always look back at least 7 days.
        lookback_minutes = max(max(limit, 1) * minutes * 12, 7 * 24 * 60)

        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(minutes=lookback_minutes)

        params = {
            "timeframe": tf,
            "limit": limit,
            "adjustment": "raw",
            "start": start_dt.isoformat().replace("+00:00", "Z"),
            "end": end_dt.isoformat().replace("+00:00", "Z"),
            "feed": self._feed,
        }

        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"{self._data_url}/v2/stocks/{symbol}/bars",
                headers=self._headers,
                params=params,
            )
            r.raise_for_status()
            bars = r.json().get("bars") or []
            return [
                {"timestamp": b["t"], "open": b["o"], "high": b["h"],
                 "low": b["l"], "close": b["c"], "volume": b["v"]}
                for b in bars
            ]

    async def get_options_chain(self, symbol: str, expiration_date: str | None = None, option_type: str | None = None) -> list[dict[str, Any]]:
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

    async def get_option_expirations(self, symbol: str) -> list[str]:
        params: dict[str, Any] = {
            "underlying_symbols": symbol,
            "expiration_date_gte": date.today().isoformat(),
            "limit": 1000,
        }
        expirations: set[str] = set()
        page_token: str | None = None

        async with httpx.AsyncClient(timeout=20.0) as c:
            for _ in range(10):
                p = dict(params)
                if page_token:
                    p["page_token"] = page_token
                r = await c.get(
                    f"{self._trade_url}/v2/options/contracts",
                    headers=self._headers,
                    params=p,
                )
                if r.status_code != 200:
                    break
                body = r.json() if r.content else {}
                for con in body.get("option_contracts", []):
                    exp = con.get("expiration_date")
                    if exp:
                        expirations.add(str(exp))
                page_token = body.get("next_page_token")
                if not page_token:
                    break

        return sorted(expirations)

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
