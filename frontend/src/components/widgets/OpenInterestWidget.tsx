"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { SymbolBar } from "./SymbolBar";
import { useDashboardStore } from "@/lib/store/dashboardStore";

interface OpenInterestWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  config?: Record<string, string>;
  onConfigChange?: (patch: Record<string, string>) => void;
}

function parseCsv(v?: string): string[] {
  if (!v) return [];
  return v.split(",").map(s => s.trim()).filter(Boolean);
}

export function OpenInterestWidget({ symbol = "SPY", isGlobalOverride, config, onConfigChange }: OpenInterestWidgetProps) {
  const [rawData, setRawData] = useState<{ strike: number; callOI: number; putOI: number }[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expLoading, setExpLoading] = useState(true);
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [selectedExpirations, setSelectedExpirations] = useState<string[]>(parseCsv(config?.expDates));
  const [strikeRange, setStrikeRange] = useState<string>(config?.strikeRange || "5");
  const [spot, setSpot] = useState<number>(0);
  const { bull, bear } = useDashboardStore(s => s.theme);
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    setSelectedExpirations(parseCsv(config?.expDates));
    setStrikeRange(config?.strikeRange || "5");
  }, [config?.expDates, config?.strikeRange]);

  useEffect(() => {
    setExpLoading(true);
    fetch(`${API}/api/market/expirations/${symbol}`)
      .then(r => r.json())
      .then(d => {
        const exps = Array.isArray(d?.expirations) ? d.expirations : [];
        setAvailableExpirations(exps);

        // If current selection is empty or stale, default to nearest expiration
        setSelectedExpirations(prev => {
          const valid = prev.filter(x => exps.includes(x));
          if (valid.length > 0) return valid;
          return exps.slice(0, 4);
        });

        setExpLoading(false);
      })
      .catch(() => {
        setAvailableExpirations([]);
        setSelectedExpirations([]);
        setExpLoading(false);
      });
  }, [symbol]);

  useEffect(() => {
    if (expLoading) return;

    const params = new URLSearchParams();
    if (selectedExpirations.length) {
      params.set("expiration_dates", selectedExpirations.join(","));
    }

    setLoading(true);
    fetch(`${API}/api/analytics/oi/${symbol}?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setRawData((d.data || []).map((x: any) => ({ strike: x.strike, callOI: x.oi_call, putOI: x.oi_put })));
        setSpot(Number(d.spot || 0));
        setError(false);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol, selectedExpirations, expLoading]);

  const atm = rawData.length
    ? rawData.reduce((best, d) => (d.callOI + d.putOI > best.callOI + best.putOI ? d : best), rawData[0])?.strike
    : 0;
  const center = spot > 0 ? spot : atm;
  const pct = strikeRange === "all" ? null : Number(strikeRange);
  const data = center > 0
    ? rawData.filter(d => (pct == null ? true : (d.strike >= center * (1 - pct / 100) && d.strike <= center * (1 + pct / 100))))
    : rawData.slice(0, 60);

  const allSelected = availableExpirations.length > 0 && selectedExpirations.length === availableExpirations.length;

  const expLabel = useMemo(() => {
    if (!availableExpirations.length) return "No expirations";
    if (allSelected) return "All";
    if (selectedExpirations.length === 0) return "None";
    if (selectedExpirations.length === 1) return selectedExpirations[0];
    return `${selectedExpirations.length} selected`;
  }, [availableExpirations.length, allSelected, selectedExpirations]);

  const toggleExpiration = (exp: string, checked: boolean) => {
    setSelectedExpirations(prev => {
      const next = checked ? Array.from(new Set([...prev, exp])) : prev.filter(x => x !== exp);
      onConfigChange?.({ expDates: next.join(",") });
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    const next = checked ? [...availableExpirations] : [];
    setSelectedExpirations(next);
    onConfigChange?.({ expDates: next.join(",") });
  };

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
        extra={
          <>
            <details className="relative">
              <summary className="list-none cursor-pointer text-xs border border-surface-border bg-surface-overlay rounded px-2 py-1 text-neutral-200">
                Exp: <span className="font-mono">{expLabel}</span>
              </summary>
              <div className="absolute right-0 mt-1 z-20 w-52 max-h-64 overflow-auto rounded border border-surface-border bg-surface p-2 shadow-xl">
                <label className="flex items-center gap-2 text-xs py-1 border-b border-surface-border mb-1">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  <span>All</span>
                </label>
                {availableExpirations.map((exp) => (
                  <label key={exp} className="flex items-center gap-2 text-xs py-1">
                    <input
                      type="checkbox"
                      checked={selectedExpirations.includes(exp)}
                      onChange={(e) => toggleExpiration(exp, e.target.checked)}
                    />
                    <span className="font-mono">{exp}</span>
                  </label>
                ))}
                {!availableExpirations.length && (
                  <div className="text-xs text-neutral-500 py-1">No expirations available</div>
                )}
              </div>
            </details>
            <select
              value={strikeRange}
              onChange={(e) => { setStrikeRange(e.target.value); onConfigChange?.({ strikeRange: e.target.value }); }}
              className="text-xs border border-surface-border bg-surface-overlay rounded px-1.5 py-1"
              title="Strike filter"
            >
              <option value="all">All Strikes</option>
              <option value="1">± 1%</option>
              <option value="2">± 2%</option>
              <option value="5">± 5%</option>
              <option value="10">± 10%</option>
              <option value="20">± 20%</option>
              <option value="50">± 50%</option>
            </select>
          </>
        }
      />

      <div className="flex-1 min-h-0 p-2">
        {(loading || expLoading) && (
          <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading…</div>
        )}
        {error && !loading && !expLoading && (
          <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>
        )}
        {!loading && !expLoading && !error && data.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-neutral-600">
            No OI data for {allSelected ? "all expirations" : (selectedExpirations.join(", ") || "selection")}
          </div>
        )}
        {!loading && !expLoading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <XAxis
                dataKey="strike"
                tick={{ fontSize: 9, fill: "#8b8fa8" }}
                tickLine={false} axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#8b8fa8" }}
                tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
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
              <ReferenceLine x={center} stroke="#ffffff22" strokeDasharray="4 2"
                label={{ value: "ATM", fill: "#555", fontSize: 9 }} />
              <Bar dataKey="callOI" fill={bull} fillOpacity={0.7} radius={[2,2,0,0]} name="Calls" />
              <Bar dataKey="putOI"  fill={bear} fillOpacity={0.7} radius={[2,2,0,0]} name="Puts" />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                formatter={(v) => <span style={{ color: "#8b8fa8" }}>{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
