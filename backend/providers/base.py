"""
Abstract base class for all market data / execution providers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseProvider(ABC):
    """
    Every provider must implement these methods.
    Return values are plain dicts / lists — no ORM objects — so they
    serialise straight to JSON.
    """

    # ── Market data ───────────────────────────────────────────────────────────

    @abstractmethod
    async def get_quote(self, symbol: str) -> dict[str, Any]:
        """
        Return latest quote for *symbol*.

        Expected keys (at minimum):
          symbol, bid_price, ask_price, last_price, timestamp
        """

    @abstractmethod
    async def get_history(
        self,
        symbol: str,
        timeframe: str = "1Day",
        limit: int = 252,
    ) -> list[dict[str, Any]]:
        """
        Return OHLCV bars for *symbol*.

        Each bar:
          timestamp, open, high, low, close, volume
        """

    @abstractmethod
    async def get_options_chain(
        self,
        symbol: str,
        expiration_date: str | None = None,
        option_type: str | None = None,  # "call" | "put" | None (both)
    ) -> list[dict[str, Any]]:
        """
        Return the full options chain for *symbol*.

        Each contract (at minimum):
          symbol, strike_price, expiration_date, option_type,
          bid_price, ask_price, mark_price,
          delta, gamma, theta, vega,
          open_interest, implied_volatility
        """

    # ── Order management ──────────────────────────────────────────────────────

    @abstractmethod
    async def place_order(self, order: dict[str, Any]) -> dict[str, Any]:
        """
        Submit a new order.

        *order* fields (Alpaca-style):
          symbol, qty (or notional), side ("buy"|"sell"),
          type ("market"|"limit"), time_in_force, limit_price?

        Returns the broker's order object.
        """

    @abstractmethod
    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel an open order by broker order ID."""

    @abstractmethod
    async def get_orders(
        self,
        status: str = "open",
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Return a list of orders matching *status*."""

    # ── Trades ───────────────────────────────────────────────────────────────

    async def get_trades(self, symbol: str, limit: int = 200) -> list[dict[str, Any]]:
        """Return recent trades. Providers may override; default returns []."""
        return []

    # ── News ─────────────────────────────────────────────────────────────────

    async def get_news(self, symbols: list[str], limit: int = 20) -> list[dict[str, Any]]:
        """Return recent news articles. Providers may override; default returns []."""
        return []

    # ── Account ───────────────────────────────────────────────────────────────

    @abstractmethod
    async def get_account(self) -> dict[str, Any]:
        """
        Return account summary.

        Expected keys:
          id, equity, cash, buying_power, portfolio_value,
          pattern_day_trader, trading_blocked
        """
