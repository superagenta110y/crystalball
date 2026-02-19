"""
Delta Exposure (DEX) calculation.

DEX per strike = delta * open_interest * 100
  Calls: positive (market makers short calls → short delta → need to buy)
  Puts:  negative (market makers short puts → long delta)
"""
from __future__ import annotations
from collections import defaultdict


def compute_dex(options_chain: list[dict], spot_price: float) -> list[dict]:
    """
    Returns a list of {strike, dex} sorted by strike.
    """
    buckets: dict[float, float] = defaultdict(float)

    for opt in options_chain:
        try:
            strike = float(opt.get("strike_price", 0))
            delta = float(opt.get("delta") or 0)
            oi = float(opt.get("open_interest") or 0)
            opt_type = (opt.get("option_type") or "").lower()

            exposure = delta * oi * 100
            if opt_type == "put":
                exposure = -exposure

            buckets[strike] += exposure
        except (TypeError, ValueError):
            continue

    return [
        {"strike": strike, "dex": round(dex, 2)}
        for strike, dex in sorted(buckets.items())
    ]
