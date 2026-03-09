"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { SymbolBar } from "./SymbolBar";
import { useDashboardStore } from "@/lib/store/dashboardStore";

interface DEXWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  config?: Record<string, string>;
  onConfigChange?: (patch: Record<string, string>) => void;
}

interface DEXBar { strike: number; dex: number }

function CrosshairCursor(props: any) {
  const { points, width, height } = props || {};
  const p = points?.[0];
  if (!p) return null;
  return (
    <g>
      <line x1={p.x} y1={0} x2={p.x} y2={height} stroke="#9ca3af66" strokeDasharray="3 3" />
      <line x1={0} y1={p.y} x2={width} y2={p.y} stroke="#9ca3af66" strokeDasharray="3 3" />
    </g>
  );
}

const parseCsv = (v?: string) => (v ? v.split(",").map(s => s.trim()).filter(Boolean) : []);

export function DEXWidget({ symbol = "SPY", isGlobalOverride, config, onConfigChange }: DEXWidgetProps) {
  const [data, setData] = useState<DEXBar[]>([]);
  const [spot, setSpot] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expLoading, setExpLoading] = useState(true);
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [selectedExpirations, setSelectedExpirations] = useState<string[]>(parseCsv(config?.expDates));
  const [strikeRange, setStrikeRange] = useState<string>(config?.strikeRange || "5");
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
        setSelectedExpirations(prev => {
          const valid = prev.filter(x => exps.includes(x));
          if (valid.length > 0) return valid;
          return exps.slice(0, 4);
        });
        setExpLoading(false);
      })
      .catch(() => { setAvailableExpirations([]); setSelectedExpirations([]); setExpLoading(false); });
  }, [symbol]);

  useEffect(() => {
    if (expLoading) return;
    const params = new URLSearchParams();
    if (selectedExpirations.length) params.set("expiration_dates", selectedExpirations.join(","));
    setLoading(true);
    fetch(`${API}/api/analytics/dex/${symbol}?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d.data || []); setSpot(d.spot || 0); setError(false); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol, selectedExpirations, expLoading]);

  const pct = strikeRange === "all" ? null : Number(strikeRange);
  const filtered = spot > 0
    ? data.filter(d => (pct == null ? true : (d.strike >= spot * (1 - pct / 100) && d.strike <= spot * (1 + pct / 100))))
    : data.slice(0, 60);
  const totalDex = filtered.reduce((sum, d) => sum + d.dex, 0);

  const allSelected = availableExpirations.length > 0 && selectedExpirations.length === availableExpirations.length;
  const expLabel = useMemo(() => {
    if (!availableExpirations.length) return "No expirations";
    if (allSelected) return "All";
    if (selectedExpirations.length === 0) return "None";
    if (selectedExpirations.length === 1) return selectedExpirations[0];
    return `${selectedExpirations.length} selected`;
  }, [availableExpirations.length, allSelected, selectedExpirations]);
  const expBadge = allSelected ? 0 : selectedExpirations.length;

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
              <summary className="list-none cursor-pointer text-xs text-neutral-300 relative">
                <span className="relative inline-flex items-center">📅{expBadge > 0 && <span className="absolute -top-2 -right-2 text-[9px] w-4 h-4 inline-flex items-center justify-center rounded-full bg-[#7c3aed] text-white">{expBadge}</span>}</span>
              </summary>
              <div className="absolute left-0 mt-1 z-20 w-52 max-h-64 overflow-auto rounded border border-surface-border bg-surface p-2 shadow-xl text-neutral-200">
                <label className="flex items-center gap-2 text-xs py-1 border-b border-surface-border mb-1">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
                  <span>All</span>
                </label>
                {availableExpirations.map((exp) => (
                  <label key={exp} className="flex items-center gap-2 text-xs py-1">
                    <input type="checkbox" checked={selectedExpirations.includes(exp)} onChange={(e) => toggleExpiration(exp, e.target.checked)} />
                    <span className="font-mono">{exp}</span>
                  </label>
                ))}
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
            <span className={`text-xs font-mono ${totalDex >= 0 ? "text-bull" : "text-bear"}`}>
              {totalDex >= 0 ? "+" : ""}{(totalDex / 1e6).toFixed(1)}M Δ
            </span>
          </>
        }
      />
      <div className="flex-1 min-h-0 p-2">
        {(loading || expLoading) && <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading…</div>}
        {error && !loading && !expLoading && <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>}
        {!loading && !error && !expLoading && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filtered} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`} />
              <ReferenceLine y={0} stroke="#2a2a2a" />
              <Tooltip cursor={<CrosshairCursor />} content={({ payload, label }) => {
                if (!payload?.length) return null;
                const dex = Number(payload[0]?.value);
                return <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs"><div className="text-neutral-400 font-mono">Strike ${label}</div><div className={dex >= 0 ? "text-bull" : "text-bear"}>DEX: {dex >= 0 ? "+" : ""}{(dex / 1e6).toFixed(2)}M Δ</div></div>;
              }} />
              <Bar dataKey="dex" radius={[2, 2, 0, 0]}>
                {filtered.map((entry, i) => <Cell key={i} fill={entry.dex >= 0 ? bull : bear} fillOpacity={0.75} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
