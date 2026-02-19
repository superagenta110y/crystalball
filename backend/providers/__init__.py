"""
Provider factory — returns the active provider based on config.
"""

from __future__ import annotations

from config import get_settings
from providers.base import BaseProvider


def get_provider() -> BaseProvider:
    settings = get_settings()
    if settings.provider == "hoodwink":
        from providers.hoodwink import HoodwinkProvider
        return HoodwinkProvider()
    # default
    from providers.alpaca import AlpacaProvider
    return AlpacaProvider()


__all__ = ["get_provider", "BaseProvider"]
