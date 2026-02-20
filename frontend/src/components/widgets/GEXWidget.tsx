"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";

interface GEXWidgetProps {
  symbol?: string;
}

interface GEXBar {
  strike: number;
  gex: number;
}

function generateMockGEX(base: number): GEXBar[] {
  return Array.from({ length: 21 }, (_, i) => {
    const strike = base - 50 + i * 5;
    const dist = i - 10;
    // Positive near ATM for calls, negative below for puts
    const gex = Math.round((dist > 0 ? 1 : -1) * Math.random() * 5e9 * (1 - Math.abs(dist) / 15));
    return { strike, gex };
  });
}

export function GEXWidget({ symbol = "SPY" }: GEXWidgetProps) {
  const [data, setData] = React.useState<GEXBar[]>([]);
  const [spot, setSpot] = React.useState<number>(0);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API}/api/analytics/gex/${symbol}`)
      .then(r => r.json())
      .then(d => { setData(d.data || []); setSpot(d.spot || 0); setError(false); })
      .catch(() => { setError(true); });
  }, [symbol]);

  // Filter to ±5% of spot for a clean readable chart
  const filtered = spot > 0
    ? data.filter(d => d.strike >= spot * 0.95 && d.strike <= spot * 1.05)
    : data.slice(0, 40);

  const netGEX = filtered.reduce((sum, d) => sum + d.gex, 0);
  const flipStrike = filtered.find((d, i) =>
    i > 0 && Math.sign(d.gex) !== Math.sign(filtered[i - 1].gex)
  )?.strike;
  if (error) return <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>;

  return (
    <div className="h-full w-full p-2 flex flex-col gap-1">
      {/* Summary */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-neutral-500">Net GEX</span>
        <span className={netGEX >= 0 ? "text-bull font-mono" : "text-bear font-mono"}>
          {netGEX >= 0 ? "+" : ""}{(netGEX / 1e9).toFixed(1)}B
        </span>
        {flipStrike && (
          <span className="text-neutral-600">
            Flip: <span className="text-white font-mono">${flipStrike}</span>
          </span>
        )}
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
            tickFormatter={(v: number) => `${(v / 1e9).toFixed(1)}B`}
          />
          <ReferenceLine y={0} stroke="#2a2a2a" />
          {flipStrike && (
            <ReferenceLine
              x={flipStrike}
              stroke="#ffffff33"
              strokeDasharray="4 2"
              label={{ value: "Flip", fill: "#666", fontSize: 9 }}
            />
          )}
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              const gex = Number(payload[0]?.value);
              return (
                <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                  <div className="text-neutral-400 font-mono">Strike ${label}</div>
                  <div className={gex >= 0 ? "text-bull" : "text-bear"}>
                    GEX: {gex >= 0 ? "+" : ""}{(gex / 1e9).toFixed(2)}B
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="gex" radius={[2, 2, 0, 0]}>
            {filtered.map((entry, i) => (
              <Cell key={i} fill={entry.gex >= 0 ? "#00d4aa" : "#ff4d6d"} fillOpacity={0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
