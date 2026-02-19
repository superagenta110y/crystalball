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
        while True:
            try:
                quote = await provider.get_quote(symbol.upper())
                await websocket.send_text(json.dumps(quote))
            except Exception as e:
                await websocket.send_text(json.dumps({"error": str(e)}))
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
