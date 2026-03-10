from __future__ import annotations

import asyncio
import time
from typing import Any
import httpx

TTL_SEC = 15
_cache: dict[str, dict[str, Any]] = {}
_last_refresh = 0.0
_lock = asyncio.Lock()


def _pct(a: float, b: float) -> float:
    return ((a - b) / b) * 100 if a and b else 0.0


async def refresh_if_needed(provider: Any, symbols: list[str], universe_meta: dict[str, dict[str, Any]]) -> None:
    global _last_refresh
    now = time.time()
    if now - _last_refresh < TTL_SEC and _cache:
      return
    async with _lock:
      now = time.time()
      if now - _last_refresh < TTL_SEC and _cache:
        return

      data_url = getattr(provider, "_data_url", None)
      headers = getattr(provider, "_headers", None)
      if not data_url or not headers:
        return

      out: dict[str, dict[str, Any]] = {}
      async with httpx.AsyncClient(timeout=20.0) as c:
        for i in range(0, len(symbols), 200):
          batch = symbols[i:i+200]
          r = await c.get(
            f"{data_url}/v2/stocks/snapshots",
            headers=headers,
            params={"symbols": ",".join(batch), "feed": "sip"},
          )
          if r.status_code != 200:
            continue
          snaps = r.json().get("snapshots", {})
          for sym in batch:
            s = snaps.get(sym) or {}
            trade = s.get("latestTrade") or {}
            day = s.get("dailyBar") or {}
            prev = s.get("prevDailyBar") or {}
            minbar = s.get("minuteBar") or {}
            p = float(trade.get("p") or day.get("c") or 0)
            prev_c = float(prev.get("c") or 0)
            day_c = float(day.get("c") or p)
            day_o = float(day.get("o") or p)
            v = float(day.get("v") or 0)
            mv = float(minbar.get("v") or 0)
            meta = universe_meta.get(sym, {})
            out[sym] = {
              "s": sym,
              "p": p,
              "sec": meta.get("sec", "Unknown"),
              "mc": float(meta.get("mc", 0)),
              "rv": (mv / (v / 390.0)) if v > 0 else 0,
              "c1m": 0.0,
              "c1h": 0.0,
              "c1d": _pct(day_c, prev_c),
              "c1w": 0.0,
              "c1mo": 0.0,
              "c1y": 0.0,
              "ytd": _pct(day_c, day_o),
              "lg": meta.get("logo", ""),
              "vol": v,
            }

      _cache.clear()
      _cache.update(out)
      _last_refresh = time.time()


def get_rows(symbols: list[str]) -> list[dict[str, Any]]:
    return [v for s, v in _cache.items() if s in symbols]


def get_symbol(symbol: str) -> dict[str, Any] | None:
    return _cache.get(symbol)
