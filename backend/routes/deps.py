"""FastAPI dependency — resolves the active provider from config."""
from functools import lru_cache
from providers.base import BaseProvider
from config import get_settings


@lru_cache(maxsize=1)
def get_provider_instance() -> BaseProvider:
    settings = get_settings()
    if settings.provider == "hoodwink":
        from providers.hoodwink import HoodwinkProvider
        return HoodwinkProvider()
    from providers.alpaca import AlpacaProvider
    return AlpacaProvider()


def get_provider() -> BaseProvider:
    return get_provider_instance()
