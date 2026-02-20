"""FastAPI dependency — resolves the active provider from DB."""
from __future__ import annotations
from providers.base import BaseProvider

_provider_instance: BaseProvider | None = None


def invalidate_provider_cache():
    global _provider_instance
    _provider_instance = None


async def _build_provider() -> BaseProvider:
    from db import get_active_provider_config
    from config import get_settings

    provider_type, config = await get_active_provider_config("data")
    settings = get_settings()

    if not provider_type:
        provider_type = settings.provider

    if provider_type == "hoodwink":
        from providers.hoodwink import HoodwinkProvider
        return HoodwinkProvider(config or {})

    from providers.alpaca import AlpacaProvider
    return AlpacaProvider(config or {})


async def get_provider() -> BaseProvider:
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = await _build_provider()
    return _provider_instance


def get_provider_instance() -> BaseProvider:
    """Sync version for WebSocket — returns cached instance or raises."""
    if _provider_instance is None:
        raise RuntimeError("Provider not yet initialised")
    return _provider_instance
