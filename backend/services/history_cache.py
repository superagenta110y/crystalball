from __future__ import annotations

import time
from typing import Any

_CACHE: dict[str, tuple[float, Any]] = {}


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
