"use client";

import React, { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BubbleData { price: number; volume: number; side: "buy" | "sell" }

interface OrderFlowWidgetProps { symbol?: string }

export function OrderFlowWidget({ symbol = "SPY" }: OrderFlowWidgetProps) {
  const [data, setData] = useState<BubbleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`${API}/api/market/trades/${symbol}?limit=200`)
      .then(r => r.json())
      .then((trades: { price: number; size: number; conditions?: string[] }[]) => {
        if (!Array.isArray(trades)) { setError(true); return; }
        // Aggregate by price bucket ($0.10 buckets)
        const buckets: Record<string, BubbleData> = {};
        trades.forEach(t => {
          const bucket = (Math.round(t.price * 10) / 10).toFixed(2);
          if (!buckets[bucket]) buckets[bucket] = { price: parseFloat(bucket), volume: 0, side: "buy" };
          buckets[bucket].volume += t.size || 1;
        });
        setData(Object.values(buckets).sort((a, b) => a.price - b.price));
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  if (loading) return <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading trades…</div>;
  if (error || !data.length) return (
    <div className="flex flex-col items-center justify-center h-full text-xs text-neutral-600 gap-1">
      <span>No trade data</span>
      <span className="text-neutral-700">Requires market hours or subscription</span>
    </div>
  );

  const maxVol = Math.max(...data.map(d => d.volume));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
        <XAxis
          dataKey="price" type="number" name="Price"
          domain={["auto", "auto"]}
          tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
        />
        <YAxis
          dataKey="volume" type="number" name="Volume"
          tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0]?.payload as BubbleData;
            return (
              <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                <div className="font-mono text-neutral-400">${d.price.toFixed(2)}</div>
                <div className="text-white">{d.volume.toLocaleString()} contracts</div>
              </div>
            );
          }}
        />
        <Scatter data={data} shape={(props: any) => {
          const { cx, cy, payload } = props;
          const r = Math.max(3, Math.sqrt(payload.volume / maxVol) * 20);
          return <circle cx={cx} cy={cy} r={r} fill="#00d4aa" fillOpacity={0.5} stroke="#00d4aa" strokeWidth={0.5} />;
        }} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
