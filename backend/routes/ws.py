"""
WebSocket quote stream.
Backend polls Alpaca REST every 1 second and pushes to all connected clients.
No Alpaca WebSocket connections used.
"""
from __future__ import annotations
import asyncio
import json
from collections import defaultdict
from typing import Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services import screener_cache
from routes.deps import get_provider

router = APIRouter(tags=["websocket"])

_connections: dict[str, Set[WebSocket]] = defaultdict(set)
_poll_tasks: dict[str, asyncio.Task] = {}
_orderflow_connections: dict[str, Set[WebSocket]] = defaultdict(set)
_orderflow_tasks: dict[str, asyncio.Task] = {}


async def _poll_loop(symbol: str):
    while True:
        clients = _connections.get(symbol)
        if not clients:
            break

        try:
            provider = await get_provider()
            quote = await provider.get_quote(symbol)
            msg = json.dumps({
                "symbol": symbol,
                "price": quote.get("last_price"),
                "bid": quote.get("bid_price"),
                "ask": quote.get("ask_price"),
                "ts": quote.get("timestamp"),
            })
            dead: Set[WebSocket] = set()
            for ws in list(clients):
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.add(ws)
            clients -= dead
        except Exception:
            pass

        await asyncio.sleep(1)

    _poll_tasks.pop(symbol, None)


async def _handle_client(websocket: WebSocket, symbol: str):
    symbol = symbol.upper()
    await websocket.accept()
    _connections[symbol].add(websocket)

    task = _poll_tasks.get(symbol)
    if task is None or task.done():
        _poll_tasks[symbol] = asyncio.create_task(_poll_loop(symbol))

    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"ping": True}))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        _connections[symbol].discard(websocket)


@router.websocket("/ws/quotes/{symbol}")
async def quote_stream(websocket: WebSocket, symbol: str):
    await _handle_client(websocket, symbol)


@router.websocket("/ws/market/{symbol}")
async def market_stream_legacy(websocket: WebSocket, symbol: str):
    await _handle_client(websocket, symbol)


@router.websocket("/ws/screener")
async def screener_stream(websocket: WebSocket):
    await websocket.accept()
    symbols: list[str] = []
    provider = await get_provider()
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
                msg = json.loads(raw)
                symbols = [str(s).upper() for s in (msg.get("symbols") or [])][:100]
            except asyncio.TimeoutError:
                pass

            if symbols:
                await screener_cache.refresh_if_needed(provider, symbols, {})
                items = [x for x in (screener_cache.get_symbol(s) for s in symbols) if x]
                await websocket.send_text(json.dumps({"type": "screener", "items": items}))
            else:
                await websocket.send_text(json.dumps({"ping": True}))
    except (WebSocketDisconnect, Exception):
        return


async def _orderflow_loop(symbol: str):
    symbol = symbol.upper()
    while True:
        clients = _orderflow_connections.get(symbol)
        if not clients:
            break
        try:
            provider = await get_provider()
            quote = await provider.get_quote(symbol)
            trades = await provider.get_trades(symbol, limit=1200)
            mid = 0.0
            try:
                bid = float(quote.get("bid_price") or 0)
                ask = float(quote.get("ask_price") or 0)
                mid = ((bid + ask) / 2.0) if bid and ask else float(quote.get("last_price") or 0)
            except Exception:
                mid = 0.0

            ordered = sorted(trades or [], key=lambda t: t.get("timestamp", ""))
            by_sec: dict[int, dict[str, float]] = {}
            prev_trade_price = 0.0
            now_sec = int(asyncio.get_event_loop().time())
            for t in ordered:
                ts_raw = t.get("timestamp")
                if not ts_raw:
                    continue
                try:
                    ts = ts_raw.replace("Z", "+00:00") if isinstance(ts_raw, str) else ""
                    sec = int(__import__("datetime").datetime.fromisoformat(ts).timestamp())
                except Exception:
                    continue
                if sec < (int(__import__("time").time()) - 300):
                    continue
                price = float(t.get("price") or 0)
                size = float(t.get("size") or 0)
                if not price or not size:
                    continue
                conds = t.get("conditions") or []
                is_t = isinstance(conds, list) and ("T" in conds)
                slot = by_sec.get(sec) or {"buy": 0.0, "sell": 0.0}
                if is_t and prev_trade_price > 0:
                    if price > prev_trade_price:
                        slot["buy"] += size
                    elif price < prev_trade_price:
                        slot["sell"] += size
                    else:
                        slot["buy"] += size / 2; slot["sell"] += size / 2
                elif mid > 0:
                    if price > mid:
                        slot["buy"] += size
                    elif price < mid:
                        slot["sell"] += size
                    else:
                        slot["buy"] += size / 2; slot["sell"] += size / 2
                else:
                    slot["buy"] += size / 2; slot["sell"] += size / 2
                by_sec[sec] = slot
                prev_trade_price = price

            payload = {
                "type": "orderflow",
                "symbol": symbol,
                "mid": mid,
                "buckets": [{"sec": k, "buy": v["buy"], "sell": v["sell"]} for k, v in sorted(by_sec.items())],
            }
            msg = json.dumps(payload)
            dead: Set[WebSocket] = set()
            for ws in list(clients):
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.add(ws)
            clients -= dead
        except Exception:
            pass
        await asyncio.sleep(1)
    _orderflow_tasks.pop(symbol, None)


@router.websocket("/ws/orderflow/{symbol}")
async def orderflow_stream(websocket: WebSocket, symbol: str):
    symbol = symbol.upper()
    await websocket.accept()
    _orderflow_connections[symbol].add(websocket)
    task = _orderflow_tasks.get(symbol)
    if task is None or task.done():
        _orderflow_tasks[symbol] = asyncio.create_task(_orderflow_loop(symbol))
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"ping": True}))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        _orderflow_connections[symbol].discard(websocket)
