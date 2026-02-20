"use client";

/**
 * Volume Profile (Order Flow proxy)
 * Distributes each bar's volume across its price range to show
 * where most trading activity occurred — no trade-tick data needed.
 * Bullish bars (close > open) → buy vol; bearish → sell vol.
 */

import React, { useEffect, useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SymbolBar } from "./SymbolBar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface VPRow { price: number; buyVol: number; sellVol: number; total: number }

interface OrderFlowWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

// Number of price buckets in the profile
const BUCKETS = 40;

function buildVolumeProfile(bars: any[]): VPRow[] {
  if (!bars?.length) return [];

  const lo = Math.min(...bars.map(b => b.low));
  const hi = Math.max(...bars.map(b => b.high));
  if (hi === lo) return [];

  const step = (hi - lo) / BUCKETS;
  const buyArr  = new Array(BUCKETS).fill(0);
  const sellArr = new Array(BUCKETS).fill(0);

  for (const b of bars) {
    const vol  = b.volume || 0;
    const span = b.high - b.low || 0.001;
    const isBull = b.close >= b.open;
    // Distribute vol proportionally across buckets the bar's range covers
    const bucketLo = Math.max(0, Math.floor((b.low - lo) / step));
    const bucketHi = Math.min(BUCKETS - 1, Math.floor((b.high - lo) / step));
    const numBuckets = bucketHi - bucketLo + 1;
    const volPerBucket = vol / numBuckets;
    for (let i = bucketLo; i <= bucketHi; i++) {
      if (isBull) buyArr[i]  += volPerBucket;
      else        sellArr[i] += volPerBucket;
    }
  }

  return Array.from({ length: BUCKETS }, (_, i) => ({
    price:   parseFloat((lo + (i + 0.5) * step).toFixed(2)),
    buyVol:  Math.round(buyArr[i]),
    sellVol: Math.round(sellArr[i]),
    total:   Math.round(buyArr[i] + sellArr[i]),
  })).reverse(); // highest price at top
}

export function OrderFlowWidget({ symbol = "SPY", isGlobalOverride, onConfigChange }: OrderFlowWidgetProps) {
  const [rows, setRows]       = useState<VPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [spot, setSpot]       = useState<number | null>(null);
  const pollRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (sym: string) => {
    try {
      const [histRes, quoteRes] = await Promise.all([
        fetch(`${API}/api/market/history/${sym}?timeframe=5Min&limit=78`), // ~6.5h of 5m bars
        fetch(`${API}/api/market/quote/${sym}`),
      ]);
      const bars  = histRes.ok  ? await histRes.json()  : [];
      const quote = quoteRes.ok ? await quoteRes.json() : {};
      if (!Array.isArray(bars) || !bars.length) { setError(true); setLoading(false); return; }
      setRows(buildVolumeProfile(bars));
      setSpot(parseFloat(quote.last_price) || null);
      setError(false);
      setLoading(false);
    } catch { setError(true); setLoading(false); }
  };

  useEffect(() => {
    setLoading(true);
    setError(false);
    if (pollRef.current) clearInterval(pollRef.current);

    load(symbol);
    pollRef.current = setInterval(() => load(symbol), 30_000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [symbol]);

  const maxVol = rows.reduce((m, r) => Math.max(m, r.total), 1);
  // POC = price of control = bucket with highest volume
  const poc = rows.reduce((best, r) => (r.total > best.total ? r : best), rows[0]);

  const formatVol = (v: number) =>
    v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` :
    v >= 1_000     ? `${(v/1_000).toFixed(0)}K`     : String(v);

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={s => onConfigChange?.({ symbol: s })}
        extra={
          poc ? (
            <span className="text-xs text-neutral-500">
              POC <span className="font-mono text-white">${poc.price.toFixed(2)}</span>
            </span>
          ) : undefined
        }
      />

      <div className="flex-1 min-h-0 px-2 pt-1 pb-2">
        {loading && (
          <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">
            Building volume profile…
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center h-full text-xs text-neutral-600">
            Could not load bar data
          </div>
        )}
        {!loading && !error && rows.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="2%"
            >
              <XAxis
                type="number"
                hide
                domain={[0, maxVol * 1.05]}
              />
              <YAxis
                type="category"
                dataKey="price"
                width={52}
                tick={{ fontSize: 8, fill: "#555" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${v}`}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const r = payload[0]?.payload as VPRow;
                  const isPoc = poc && r.price === poc.price;
                  return (
                    <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs space-y-0.5">
                      <div className="font-mono text-white">${r.price.toFixed(2)}{isPoc ? " 📍 POC" : ""}</div>
                      <div className="text-bull">Buy:  {formatVol(r.buyVol)}</div>
                      <div className="text-bear">Sell: {formatVol(r.sellVol)}</div>
                      <div className="text-neutral-400">Total: {formatVol(r.total)}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="buyVol"  stackId="a" radius={[0,0,0,0]}>
                {rows.map((r, i) => {
                  const isPoc = poc && r.price === poc.price;
                  const isAtm = spot && Math.abs(r.price - spot) < 0.5;
                  return (
                    <Cell
                      key={i}
                      fill={isPoc ? "#facc15" : "#00d4aa"}
                      fillOpacity={isPoc ? 0.9 : isAtm ? 0.8 : 0.55}
                    />
                  );
                })}
              </Bar>
              <Bar dataKey="sellVol" stackId="a" radius={[0,2,2,0]}>
                {rows.map((r, i) => {
                  const isPoc = poc && r.price === poc.price;
                  const isAtm = spot && Math.abs(r.price - spot) < 0.5;
                  return (
                    <Cell
                      key={i}
                      fill={isPoc ? "#fb923c" : "#ff4d6d"}
                      fillOpacity={isPoc ? 0.9 : isAtm ? 0.8 : 0.55}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
