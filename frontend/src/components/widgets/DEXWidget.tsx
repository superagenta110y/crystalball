/**
 * DEXWidget — Net Delta Exposure across the options chain.
 * Shows directional bias baked into dealer hedging flows.
 *
 * Formula: DEX = Σ (delta × OI × 100) × direction
 *   Calls contribute positive delta, puts contribute negative delta.
 *   A large negative DEX → dealers must buy to hedge = supportive.
 *
 * TODO:
 *   - Fetch /api/options/dex?symbol=SPY
 *   - Add "total DEX" and "call DEX / put DEX" breakdown
 *   - Add historical DEX line chart (DEX over time)
 */
"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";

interface DEXWidgetProps {
  symbol?: string;
}

interface DEXBar {
  strike: number;
  dex: number;
}

function generateMockDEX(base: number): DEXBar[] {
  return Array.from({ length: 21 }, (_, i) => {
    const strike = base - 50 + i * 5;
    const dist = i - 10;
    const dex = Math.round(dist * Math.random() * 2e7);
    return { strike, dex };
  });
}

export function DEXWidget({ symbol = "SPY" }: DEXWidgetProps) {
  const [data, setData] = React.useState<DEXBar[]>([]);
  const [spot, setSpot] = React.useState(0);
  const [error, setError] = React.useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  React.useEffect(() => {
    fetch(`${API}/api/analytics/dex/${symbol}`)
      .then(r => r.json()).then(d => { setData(d.data || []); setSpot(d.spot || 0); setError(false); })
      .catch(() => setError(true));
  }, [symbol]);
  if (error) return <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>;
  const filtered = spot > 0 ? data.filter(d => d.strike >= spot * 0.95 && d.strike <= spot * 1.05) : data.slice(0, 40);
  const totalDex = filtered.reduce((sum, d) => sum + d.dex, 0);

  return (
    <div className="h-full w-full p-2 flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-neutral-500">Net DEX</span>
        <span className={totalDex >= 0 ? "text-bull font-mono" : "text-bear font-mono"}>
          {totalDex >= 0 ? "+" : ""}{(totalDex / 1e6).toFixed(1)}M Δ
        </span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filtered} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="strike"
            tick={{ fontSize: 9, fill: "#8b8fa8" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#8b8fa8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`}
          />
          <ReferenceLine y={0} stroke="#2a2a2a" />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              const dex = Number(payload[0]?.value);
              return (
                <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                  <div className="text-neutral-400 font-mono">Strike ${label}</div>
                  <div className={dex >= 0 ? "text-bull" : "text-bear"}>
                    DEX: {dex >= 0 ? "+" : ""}{(dex / 1e6).toFixed(2)}M Δ
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="dex" radius={[2, 2, 0, 0]}>
            {filtered.map((entry, i) => (
              <Cell key={i} fill={entry.dex >= 0 ? "#00d4aa" : "#ff4d6d"} fillOpacity={0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
