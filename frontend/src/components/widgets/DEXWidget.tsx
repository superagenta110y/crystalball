"use client";

import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { SymbolBar } from "./SymbolBar";
import { useDashboardStore } from "@/lib/store/dashboardStore";

interface DEXWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

interface DEXBar { strike: number; dex: number }

export function DEXWidget({ symbol = "SPY", isGlobalOverride, onConfigChange }: DEXWidgetProps) {
  const [data, setData] = useState<DEXBar[]>([]);
  const [spot, setSpot] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const { bull, bear } = useDashboardStore(s => s.theme);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/analytics/dex/${symbol}`)
      .then(r => r.json())
      .then(d => { setData(d.data || []); setSpot(d.spot || 0); setError(false); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  const filtered = spot > 0
    ? data.filter(d => d.strike >= spot * 0.95 && d.strike <= spot * 1.05)
    : data.slice(0, 40);
  const totalDex = filtered.reduce((sum, d) => sum + d.dex, 0);

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
        extra={
          <span className={`text-xs font-mono ${totalDex >= 0 ? "text-bull" : "text-bear"}`}>
            {totalDex >= 0 ? "+" : ""}{(totalDex / 1e6).toFixed(1)}M Δ
          </span>
        }
      />
      <div className="flex-1 min-h-0 p-2">
        {loading && <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading…</div>}
        {error && !loading && <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>}
        {!loading && !error && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filtered} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`} />
              <ReferenceLine y={0} stroke="#2a2a2a" />
              <Tooltip content={({ payload, label }) => {
                if (!payload?.length) return null;
                const dex = Number(payload[0]?.value);
                return (
                  <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                    <div className="text-neutral-400 font-mono">Strike ${label}</div>
                    <div className={dex >= 0 ? "text-bull" : "text-bear"}>DEX: {dex >= 0 ? "+" : ""}{(dex / 1e6).toFixed(2)}M Δ</div>
                  </div>
                );
              }} />
              <Bar dataKey="dex" radius={[2, 2, 0, 0]}>
                {filtered.map((entry, i) => (
                  <Cell key={i} fill={entry.dex >= 0 ? bull : bear} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
