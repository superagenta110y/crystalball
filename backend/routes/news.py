from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider

router = APIRouter(prefix="/news", tags=["news"])


@router.get("")
async def get_news(
    symbols: str = Query("SPY", description="Comma-separated symbols"),
    limit: int = Query(20, le=50),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_news(symbols=symbols.split(","), limit=limit)
