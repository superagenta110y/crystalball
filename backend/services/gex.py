"""
Gamma Exposure (GEX) calculation.

GEX per strike = gamma * open_interest * 100 * spot^2 * 0.01
  Calls: positive contribution
  Puts:  negative contribution (market makers are short puts → long gamma)
"""
from __future__ import annotations
from collections import defaultdict


def compute_gex(options_chain: list[dict], spot_price: float) -> list[dict]:
    """
    Returns a list of {strike, gex, net_gex} sorted by strike.
    """
    buckets: dict[float, float] = defaultdict(float)

    for opt in options_chain:
        try:
            strike = float(opt.get("strike_price", 0))
            gamma = float(opt.get("gamma") or 0)
            oi = float(opt.get("open_interest") or 0)
            opt_type = (opt.get("option_type") or "").lower()

            exposure = gamma * oi * 100 * (spot_price ** 2) * 0.01
            if opt_type == "put":
                exposure = -exposure

            buckets[strike] += exposure
        except (TypeError, ValueError):
            continue

    return [
        {"strike": strike, "gex": round(gex, 2)}
        for strike, gex in sorted(buckets.items())
    ]
