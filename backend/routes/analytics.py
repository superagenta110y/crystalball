from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider
from services.gex import compute_gex
from services.dex import compute_dex
from services.oi import compute_oi

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _parse_expirations(expiration_date: str | None, expiration_dates: str | None) -> list[str]:
    out: list[str] = []
    if expiration_date:
        out.append(expiration_date.strip())
    if expiration_dates:
        out.extend([x.strip() for x in expiration_dates.split(",") if x.strip()])
    # de-dup, preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for x in out:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


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
    expiration_dates: str | None = Query(None, description="comma-separated expiration dates"),
    provider: BaseProvider = Depends(get_provider),
):
    sym = symbol.upper()
    requested_exps = _parse_expirations(expiration_date, expiration_dates)

    if not requested_exps:
        chain, _ = await _chain_and_spot(sym, None, provider)
        return {"symbol": sym, "expirations": [], "data": compute_oi(chain)}

    chain: list[dict] = []
    for exp in requested_exps:
        part = await provider.get_options_chain(sym, expiration_date=exp)
        chain.extend(part)

    return {"symbol": sym, "expirations": requested_exps, "data": compute_oi(chain)}
