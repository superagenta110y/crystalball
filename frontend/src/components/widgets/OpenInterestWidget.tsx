/**
 * OpenInterestWidget — Bar chart of open interest by strike.
 * Shows calls (green) and puts (red) side by side.
 *
 * TODO:
 *   - Connect to /api/options/chain?symbol=SPY&expiry=next
 *   - Highlight ATM strike
 *   - Add expiry selector dropdown
 */
"use client";

import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface OpenInterestWidgetProps {
  symbol?: string;
}

function generateMockOI(base: number) {
  return Array.from({ length: 21 }, (_, i) => {
    const strike = base - 50 + i * 5;
    const dist = Math.abs(i - 10); // distance from ATM
    const callOI = Math.max(0, Math.round((10000 - dist * 700 + Math.random() * 2000)));
    const putOI = Math.max(0, Math.round((9000 - dist * 600 + Math.random() * 2000)));
    return { strike, callOI, putOI };
  });
}

export function OpenInterestWidget({ symbol = "SPY" }: OpenInterestWidgetProps) {
  const base = symbol === "QQQ" ? 420 : 520;
  const data = useMemo(() => generateMockOI(base), [base]);
  const atm = base;

  return (
    <div className="h-full w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
          <XAxis
            dataKey="strike"
            tick={{ fontSize: 9, fill: "#8b8fa8" }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#8b8fa8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            content={({ payload, label }) => {
              if (!payload?.length) return null;
              return (
                <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs space-y-1">
                  <div className="text-neutral-400 font-mono">Strike ${label}</div>
                  <div className="text-bull">Calls: {Number(payload[0]?.value).toLocaleString()}</div>
                  <div className="text-bear">Puts: {Number(payload[1]?.value).toLocaleString()}</div>
                </div>
              );
            }}
          />
          <ReferenceLine x={atm} stroke="#ffffff22" strokeDasharray="4 2" label={{ value: "ATM", fill: "#555", fontSize: 9 }} />
          <Bar dataKey="callOI" fill="#00d4aa" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Calls" />
          <Bar dataKey="putOI" fill="#ff4d6d" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Puts" />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            formatter={(value) => <span style={{ color: "#8b8fa8" }}>{value}</span>}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
