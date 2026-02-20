"use client";

import React, { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { SymbolBar } from "./SymbolBar";

interface BubbleData { price: number; volume: number }

interface OrderFlowWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

export function OrderFlowWidget({ symbol = "SPY", isGlobalOverride, onConfigChange }: OrderFlowWidgetProps) {
  const [data, setData] = useState<BubbleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`${API}/api/market/trades/${symbol}?limit=200`)
      .then(r => r.json())
      .then((trades: { price: number; size: number }[]) => {
        if (!Array.isArray(trades) || !trades.length) { setError(true); setLoading(false); return; }
        const buckets: Record<string, BubbleData> = {};
        trades.forEach(t => {
          const bucket = (Math.round(t.price * 10) / 10).toFixed(2);
          if (!buckets[bucket]) buckets[bucket] = { price: parseFloat(bucket), volume: 0 };
          buckets[bucket].volume += t.size || 1;
        });
        setData(Object.values(buckets).sort((a, b) => a.price - b.price));
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  const maxVol = data.length ? Math.max(...data.map(d => d.volume)) : 1;

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
      />
      <div className="flex-1 min-h-0">
        {loading && <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading trades…</div>}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-xs text-neutral-600 gap-1">
            <span>No trade data</span>
            <span className="text-neutral-700">Requires market hours or Alpaca subscription</span>
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <XAxis
                dataKey="price" type="number" name="Price" domain={["auto", "auto"]}
                tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <YAxis
                dataKey="volume" type="number" name="Volume"
                tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0]?.payload as BubbleData;
                return (
                  <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                    <div className="font-mono text-neutral-400">${d.price.toFixed(2)}</div>
                    <div className="text-white">{d.volume.toLocaleString()} shares</div>
                  </div>
                );
              }} />
              <Scatter data={data} shape={(props: any) => {
                const { cx, cy, payload } = props;
                const r = Math.max(3, Math.sqrt(payload.volume / maxVol) * 20);
                return <circle cx={cx} cy={cy} r={r} fill="#00d4aa" fillOpacity={0.5} stroke="#00d4aa" strokeWidth={0.5} />;
              }} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
