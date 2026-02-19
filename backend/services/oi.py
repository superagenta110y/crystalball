"""Open Interest aggregation by strike."""
from __future__ import annotations
from collections import defaultdict


def compute_oi(options_chain: list[dict]) -> list[dict]:
    """
    Returns a list of {strike, oi_call, oi_put, oi_total} sorted by strike.
    """
    calls: dict[float, float] = defaultdict(float)
    puts: dict[float, float] = defaultdict(float)

    for opt in options_chain:
        try:
            strike = float(opt.get("strike_price", 0))
            oi = float(opt.get("open_interest") or 0)
            opt_type = (opt.get("option_type") or "").lower()
            if opt_type == "call":
                calls[strike] += oi
            elif opt_type == "put":
                puts[strike] += oi
        except (TypeError, ValueError):
            continue

    all_strikes = sorted(set(calls) | set(puts))
    return [
        {
            "strike": s,
            "oi_call": round(calls.get(s, 0), 0),
            "oi_put": round(puts.get(s, 0), 0),
            "oi_total": round(calls.get(s, 0) + puts.get(s, 0), 0),
        }
        for s in all_strikes
    ]
