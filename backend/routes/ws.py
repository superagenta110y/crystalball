"""
WebSocket endpoint — streams live quotes for a symbol.
Clients connect to /ws/market/{symbol} and receive JSON quote updates.
"""
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from providers.base import BaseProvider
from routes.deps import get_provider_instance

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/market/{symbol}")
async def market_stream(websocket: WebSocket, symbol: str):
    await websocket.accept()
    provider: BaseProvider = get_provider_instance()
    try:
        # WebSocket streaming disabled — use REST polling instead
        await websocket.send_text(json.dumps({"info": "Use REST /api/market/quote/{symbol} for live quotes"}))
        while True:
            await asyncio.sleep(30)  # keep connection alive without hammering API
    except WebSocketDisconnect:
        pass
