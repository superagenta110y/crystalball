const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchGEX(symbol: string) {
  const r = await fetch(`${BASE}/api/analytics/gex/${symbol}`);
  if (!r.ok) throw new Error("GEX fetch failed");
  return r.json();
}

export async function fetchDEX(symbol: string) {
  const r = await fetch(`${BASE}/api/analytics/dex/${symbol}`);
  if (!r.ok) throw new Error("DEX fetch failed");
  return r.json();
}

export async function fetchOI(symbol: string) {
  const r = await fetch(`${BASE}/api/analytics/oi/${symbol}`);
  if (!r.ok) throw new Error("OI fetch failed");
  return r.json();
}

export async function fetchQuote(symbol: string) {
  const r = await fetch(`${BASE}/api/market/quote/${symbol}`);
  if (!r.ok) throw new Error("Quote fetch failed");
  return r.json();
}

export async function fetchHistory(symbol: string, timeframe = "1Day", limit = 252) {
  const r = await fetch(`${BASE}/api/market/history/${symbol}?timeframe=${timeframe}&limit=${limit}`);
  if (!r.ok) throw new Error("History fetch failed");
  return r.json();
}
