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

router = APIRouter(tags=["websocket"])

# symbol → set of connected WebSocket clients
_connections: dict[str, Set[WebSocket]] = defaultdict(set)
# symbol → running asyncio Task
_poll_tasks: dict[str, asyncio.Task] = {}


async def _poll_loop(symbol: str):
    """Poll Alpaca REST every 1s and broadcast to all connected clients for this symbol."""
    from routes.deps import get_provider

    while True:
        clients = _connections.get(symbol)
        if not clients:
            break  # no subscribers left — exit and let GC clean up

        try:
            provider = await get_provider()
            quote = await provider.get_quote(symbol)
            msg = json.dumps({
                "symbol": symbol,
                "price":  quote.get("last_price"),
                "bid":    quote.get("bid_price"),
                "ask":    quote.get("ask_price"),
                "ts":     quote.get("timestamp"),
            })
            dead: Set[WebSocket] = set()
            for ws in list(clients):
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.add(ws)
            clients -= dead
        except Exception:
            pass  # transient API errors — keep polling

        await asyncio.sleep(1)

    # Clean up task ref
    _poll_tasks.pop(symbol, None)


async def _handle_client(websocket: WebSocket, symbol: str):
    symbol = symbol.upper()
    await websocket.accept()

    _connections[symbol].add(websocket)

    # Start polling task for this symbol if not already running
    task = _poll_tasks.get(symbol)
    if task is None or task.done():
        _poll_tasks[symbol] = asyncio.create_task(_poll_loop(symbol))

    try:
        while True:
            # Wait for client close or ping — 30s timeout then send keepalive
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


# Legacy endpoint — kept for any existing consumers
@router.websocket("/ws/market/{symbol}")
async def market_stream_legacy(websocket: WebSocket, symbol: str):
    await _handle_client(websocket, symbol)
