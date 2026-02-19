from fastapi import APIRouter, Depends
from providers.base import BaseProvider
from routes.deps import get_provider

router = APIRouter(prefix="/account", tags=["account"])


@router.get("")
async def get_account(provider: BaseProvider = Depends(get_provider)):
    return await provider.get_account()
