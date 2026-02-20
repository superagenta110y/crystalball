from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{symbol}")
async def quote(symbol: str, provider: BaseProvider = Depends(get_provider)):
    return await provider.get_quote(symbol.upper())


@router.get("/history/{symbol}")
async def history(
    symbol: str,
    timeframe: str = Query("1Day", description="1Min|5Min|1Hour|1Day|1Week"),
    limit: int = Query(252, le=1000),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_history(symbol.upper(), timeframe=timeframe, limit=limit)


@router.get("/trades/{symbol}")
async def trades(
    symbol: str,
    limit: int = Query(200, le=1000),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_trades(symbol.upper(), limit=limit)


@router.get("/options/{symbol}")
async def options_chain(
    symbol: str,
    expiration_date: str | None = Query(None, description="YYYY-MM-DD"),
    option_type: str | None = Query(None, description="call|put"),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_options_chain(symbol.upper(), expiration_date=expiration_date, option_type=option_type)
