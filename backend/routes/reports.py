from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from providers.base import BaseProvider
from routes.deps import get_provider
from services.market_report import generate_daily_bias_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily-bias/{symbol}", response_class=PlainTextResponse)
async def daily_bias(symbol: str, provider: BaseProvider = Depends(get_provider)):
    return await generate_daily_bias_report(symbol.upper(), provider)
