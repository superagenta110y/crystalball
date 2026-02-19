from fastapi import APIRouter, Depends, Query
from providers.base import BaseProvider
from routes.deps import get_provider

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("")
async def list_orders(
    status: str = Query("open", description="open|closed|all"),
    limit: int = Query(50, le=500),
    provider: BaseProvider = Depends(get_provider),
):
    return await provider.get_orders(status=status, limit=limit)


@router.post("")
async def place_order(order: dict, provider: BaseProvider = Depends(get_provider)):
    return await provider.place_order(order)


@router.delete("/{order_id}")
async def cancel_order(order_id: str, provider: BaseProvider = Depends(get_provider)):
    return await provider.cancel_order(order_id)
