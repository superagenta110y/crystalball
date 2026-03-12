from __future__ import annotations

import time
from typing import Any

# Legacy request cache (short TTL, payload-level)
_CACHE: dict[str, tuple[float, Any]] = {}

# New immutable bar cache: symbol+tf -> ts -> compact bar
_BAR_CACHE: dict[str, dict[int, dict[str, Any]]] = {}


def _now() -> float:
    return time.time()


def get(key: str):
    row = _CACHE.get(key)
    if not row:
        return None
    exp, val = row
    if exp < _now():
        _CACHE.pop(key, None)
        return None
    return val


def setex(key: str, ttl_sec: int, value: Any):
    _CACHE[key] = (_now() + max(1, ttl_sec), value)


def ttl_for_timeframe(tf: str) -> int:
    t = (tf or "1Day").lower()
    if t in {"1min", "1m", "5min", "5m", "15min", "15m"}:
        return 10
    if t in {"30min", "30m", "1hour", "1h", "4hour", "4h"}:
        return 30
    if t in {"1day", "1d"}:
        return 120
    return 300


def _bar_key(symbol: str, timeframe: str) -> str:
    return f"{symbol.upper()}::{(timeframe or '1Day').lower()}"


def get_cached_bars(symbol: str, timeframe: str, end_ts: int, limit: int) -> list[dict[str, Any]]:
    key = _bar_key(symbol, timeframe)
    rows = _BAR_CACHE.get(key, {})
    if not rows:
        return []
    ts_sorted = sorted((ts for ts in rows.keys() if ts <= end_ts))
    if limit > 0:
        ts_sorted = ts_sorted[-limit:]
    return [rows[ts] for ts in ts_sorted]


def upsert_immutable_bars(symbol: str, timeframe: str, bars: list[dict[str, Any]], latest_closed_ts: int):
    if not bars:
        return
    key = _bar_key(symbol, timeframe)
    slot = _BAR_CACHE.setdefault(key, {})
    for b in bars:
        ts_val = b.get("ts")
        if ts_val is None:
            continue
        try:
            ts = int(ts_val)
        except Exception:
            continue
        # Only cache fully-formed bars indefinitely.
        if ts <= latest_closed_ts:
            slot[ts] = b


def clear_symbol(symbol: str, timeframe: str | None = None):
    sym = symbol.upper()
    if timeframe:
        _BAR_CACHE.pop(_bar_key(sym, timeframe), None)
        return
    for k in list(_BAR_CACHE.keys()):
        if k.startswith(f"{sym}::"):
            _BAR_CACHE.pop(k, None)
