"use client";

import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { SymbolBar } from "./SymbolBar";

interface GEXWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

interface GEXBar { strike: number; gex: number }

export function GEXWidget({ symbol = "SPY", isGlobalOverride, onConfigChange }: GEXWidgetProps) {
  const [data, setData] = useState<GEXBar[]>([]);
  const [spot, setSpot] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/analytics/gex/${symbol}`)
      .then(r => r.json())
      .then(d => { setData(d.data || []); setSpot(d.spot || 0); setError(false); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  const filtered = spot > 0
    ? data.filter(d => d.strike >= spot * 0.95 && d.strike <= spot * 1.05)
    : data.slice(0, 40);

  const netGEX = filtered.reduce((sum, d) => sum + d.gex, 0);
  const flipStrike = filtered.find((d, i) =>
    i > 0 && Math.sign(d.gex) !== Math.sign(filtered[i - 1].gex)
  )?.strike;

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
        extra={
          <div className="flex items-center gap-3 text-xs">
            <span className={netGEX >= 0 ? "text-bull font-mono" : "text-bear font-mono"}>
              {netGEX >= 0 ? "+" : ""}{(netGEX / 1e9).toFixed(1)}B
            </span>
            {flipStrike && (
              <span className="text-neutral-600">Flip: <span className="text-white font-mono">${flipStrike}</span></span>
            )}
          </div>
        }
      />
      <div className="flex-1 min-h-0 p-2">
        {loading && <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading…</div>}
        {error && !loading && <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>}
        {!loading && !error && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filtered} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1e9).toFixed(1)}B`} />
              <ReferenceLine y={0} stroke="#2a2a2a" />
              {flipStrike && (
                <ReferenceLine x={flipStrike} stroke="#ffffff33" strokeDasharray="4 2"
                  label={{ value: "Flip", fill: "#666", fontSize: 9 }} />
              )}
              <Tooltip content={({ payload, label }) => {
                if (!payload?.length) return null;
                const gex = Number(payload[0]?.value);
                return (
                  <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                    <div className="text-neutral-400 font-mono">Strike ${label}</div>
                    <div className={gex >= 0 ? "text-bull" : "text-bear"}>GEX: {gex >= 0 ? "+" : ""}{(gex / 1e9).toFixed(2)}B</div>
                  </div>
                );
              }} />
              <Bar dataKey="gex" radius={[2, 2, 0, 0]}>
                {filtered.map((entry, i) => (
                  <Cell key={i} fill={entry.gex >= 0 ? "#00d4aa" : "#ff4d6d"} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
