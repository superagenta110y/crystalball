"use client";

import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { SymbolBar } from "./SymbolBar";

interface OpenInterestWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

export function OpenInterestWidget({ symbol = "SPY", isGlobalOverride, onConfigChange }: OpenInterestWidgetProps) {
  const [rawData, setRawData] = useState<{ strike: number; callOI: number; putOI: number }[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/analytics/oi/${symbol}`)
      .then(r => r.json())
      .then(d => {
        setRawData((d.data || []).map((x: any) => ({ strike: x.strike, callOI: x.oi_call, putOI: x.oi_put })));
        setError(false); setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  const atm = rawData.length
    ? rawData.reduce((best, d) => (d.callOI + d.putOI > best.callOI + best.putOI ? d : best), rawData[0])?.strike
    : 0;
  const data = atm > 0
    ? rawData.filter(d => d.strike >= atm * 0.95 && d.strike <= atm * 1.05)
    : rawData.slice(0, 40);

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
      />
      <div className="flex-1 min-h-0 p-2">
        {loading && <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading…</div>}
        {error && !loading && <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>}
        {!loading && !error && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={({ payload, label }) => {
                if (!payload?.length) return null;
                return (
                  <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs space-y-1">
                    <div className="text-neutral-400 font-mono">Strike ${label}</div>
                    <div className="text-bull">Calls: {Number(payload[0]?.value).toLocaleString()}</div>
                    <div className="text-bear">Puts: {Number(payload[1]?.value).toLocaleString()}</div>
                  </div>
                );
              }} />
              <ReferenceLine x={atm} stroke="#ffffff22" strokeDasharray="4 2" label={{ value: "ATM", fill: "#555", fontSize: 9 }} />
              <Bar dataKey="callOI" fill="#00d4aa" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Calls" />
              <Bar dataKey="putOI" fill="#ff4d6d" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Puts" />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} formatter={(v) => <span style={{ color: "#8b8fa8" }}>{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
