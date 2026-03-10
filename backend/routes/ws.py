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
