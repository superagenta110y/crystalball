"""FastAPI dependency — resolves the active provider from DB (falls back to config)."""
from __future__ import annotations
from providers.base import BaseProvider
from config import get_settings

_provider_instance: BaseProvider | None = None


def invalidate_provider_cache():
    global _provider_instance
    _provider_instance = None


async def _build_provider() -> BaseProvider:
    from db import get_active_provider, get_provider_config
    settings = get_settings()

    active = await get_active_provider() or settings.provider

    if active == "hoodwink":
        from providers.hoodwink import HoodwinkProvider
        cfg = await get_provider_config("hoodwink")
        if cfg:
            import os
            os.environ["HOODWINK_URL"] = cfg.get("url", settings.hoodwink_url)
            os.environ["HOODWINK_API_KEY"] = cfg.get("api_key", settings.hoodwink_api_key)
            get_settings.cache_clear()
        return HoodwinkProvider()

    from providers.alpaca import AlpacaProvider
    cfg = await get_provider_config("alpaca")
    if cfg:
        import os
        os.environ["ALPACA_API_KEY"] = cfg.get("api_key", settings.alpaca_api_key)
        os.environ["ALPACA_SECRET_KEY"] = cfg.get("secret_key", settings.alpaca_secret_key)
        os.environ["ALPACA_PAPER"] = "true" if cfg.get("paper", settings.alpaca_paper) else "false"
        get_settings.cache_clear()
    return AlpacaProvider()


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
