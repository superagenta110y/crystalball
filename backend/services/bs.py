"""
Black-Scholes Greeks calculator.
Used when the broker/data provider doesn't return live Greeks.
"""
from __future__ import annotations
import math


def _norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2)))


def bs_greeks(
    S: float,          # spot price
    K: float,          # strike price
    T: float,          # time to expiry in years
    r: float = 0.053,  # risk-free rate (approx)
    sigma: float = 0.2, # implied volatility (default 20% if unknown)
    option_type: str = "call",
) -> dict:
    if T <= 0 or S <= 0 or K <= 0 or sigma <= 0:
        return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    try:
        d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        pdf_d1 = _norm_pdf(d1)
        gamma = pdf_d1 / (S * sigma * math.sqrt(T))
        vega = S * pdf_d1 * math.sqrt(T) / 100  # per 1% move in IV
        if option_type == "call":
            delta = _norm_cdf(d1)
            theta = (-(S * pdf_d1 * sigma) / (2 * math.sqrt(T))
                     - r * K * math.exp(-r * T) * _norm_cdf(d2)) / 365
        else:
            delta = _norm_cdf(d1) - 1.0
            theta = (-(S * pdf_d1 * sigma) / (2 * math.sqrt(T))
                     + r * K * math.exp(-r * T) * _norm_cdf(-d2)) / 365
        return {
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta, 4),
            "vega": round(vega, 4),
        }
    except (ValueError, ZeroDivisionError):
        return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}


def iv_from_price(
    option_price: float, S: float, K: float, T: float,
    r: float = 0.053, option_type: str = "call",
    tol: float = 1e-5, max_iter: int = 100,
) -> float:
    """Newton-Raphson IV solver. Returns 0.20 (20%) on failure."""
    if T <= 0 or option_price <= 0:
        return 0.20
    sigma = 0.20
    for _ in range(max_iter):
        g = bs_greeks(S, K, T, r, sigma, option_type)
        vega = g["vega"] * 100  # undo /100 scaling
        if abs(vega) < 1e-10:
            break
        # BS price
        d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        if option_type == "call":
            price = S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
        else:
            price = K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)
        diff = price - option_price
        if abs(diff) < tol:
            break
        sigma -= diff / vega
        sigma = max(0.001, min(sigma, 5.0))
    return round(sigma, 4)
