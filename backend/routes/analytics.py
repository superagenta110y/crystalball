from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider
from services.gex import compute_gex
from services.dex import compute_dex
from services.oi import compute_oi

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def _chain_and_spot(symbol: str, expiration_date: str | None, provider: BaseProvider):
    chain, quote = await provider.get_options_chain(symbol, expiration_date=expiration_date), None
    quote = await provider.get_quote(symbol)
    spot = float(quote.get("last_price") or 0)
    return chain, spot


@router.get("/gex/{symbol}")
async def gex(
    symbol: str,
    expiration_date: str | None = Query(None),
    provider: BaseProvider = Depends(get_provider),
):
    chain, spot = await _chain_and_spot(symbol.upper(), expiration_date, provider)
    return {"symbol": symbol, "spot": spot, "data": compute_gex(chain, spot)}


@router.get("/dex/{symbol}")
async def dex(
    symbol: str,
    expiration_date: str | None = Query(None),
    provider: BaseProvider = Depends(get_provider),
):
    chain, spot = await _chain_and_spot(symbol.upper(), expiration_date, provider)
    return {"symbol": symbol, "spot": spot, "data": compute_dex(chain, spot)}


@router.get("/oi/{symbol}")
async def open_interest(
    symbol: str,
    expiration_date: str | None = Query(None),
    provider: BaseProvider = Depends(get_provider),
):
    chain, _ = await _chain_and_spot(symbol.upper(), expiration_date, provider)
    return {"symbol": symbol, "data": compute_oi(chain)}
