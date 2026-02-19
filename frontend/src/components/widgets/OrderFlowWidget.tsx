/**
 * OrderFlowWidget — Bubble chart showing buy/sell pressure at each price level.
 * Bubble size = volume, color = direction (bull/bear).
 *
 * TODO:
 *   - Connect to /api/ws/trades WebSocket for live tick stream
 *   - Aggregate trades by price level (configurable bucket size)
 *   - Animate new bubbles as trades arrive
 */
"use client";

import React, { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

interface OrderFlowWidgetProps {
  symbol?: string;
}

interface BubbleData {
  price: number;
  volume: number;
  side: "buy" | "sell";
}

function generateMockData(symbol: string): BubbleData[] {
  const base = symbol === "QQQ" ? 420 : 520;
  return Array.from({ length: 60 }, () => {
    const price = base + Math.floor(Math.random() * 20 - 10);
    const volume = Math.floor(Math.random() * 5000) + 100;
    const side = Math.random() > 0.45 ? "buy" : "sell";
    return { price, volume, side };
  });
}

export function OrderFlowWidget({ symbol = "SPY" }: OrderFlowWidgetProps) {
  const data = useMemo(() => generateMockData(symbol), [symbol]);

  return (
    <div className="h-full w-full p-2 flex flex-col gap-1">
      <div className="flex gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-bull inline-block" /> Buy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-bear inline-block" /> Sell
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="price"
            type="number"
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: "#8b8fa8" }}
            tickLine={false}
            axisLine={false}
            label={{ value: "Price", position: "insideBottom", fill: "#555", fontSize: 10 }}
          />
          <YAxis
            dataKey="volume"
            type="number"
            tick={{ fontSize: 10, fill: "#8b8fa8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            cursor={false}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload as BubbleData;
              return (
                <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                  <div className="font-mono text-white">$ {d.price.toFixed(2)}</div>
                  <div className={d.side === "buy" ? "text-bull" : "text-bear"}>
                    {d.side.toUpperCase()} · {d.volume.toLocaleString()} shares
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={data} r={4}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.side === "buy" ? "#00d4aa" : "#ff4d6d"}
                fillOpacity={0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
