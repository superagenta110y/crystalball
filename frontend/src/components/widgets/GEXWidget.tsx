"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ReferenceDot, ResponsiveContainer, Cell } from "recharts";
import { SymbolBar } from "./SymbolBar";
import { useDashboardStore } from "@/lib/store/dashboardStore";

interface GEXWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  config?: Record<string, string>;
  onConfigChange?: (patch: Record<string, string>) => void;
}

interface GEXBar { strike: number; gex: number }


const parseCsv = (v?: string) => (v ? v.split(",").map(s => s.trim()).filter(Boolean) : []);

export function GEXWidget({ symbol = "SPY", isGlobalOverride, config, onConfigChange }: GEXWidgetProps) {
  const [data, setData] = useState<GEXBar[]>([]);
  const [spot, setSpot] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expLoading, setExpLoading] = useState(true);
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [selectedExpirations, setSelectedExpirations] = useState<string[]>(parseCsv(config?.expDates));
  const [strikeRange, setStrikeRange] = useState<string>(config?.strikeRange || "5");
  const [hover, setHover] = useState<{ x:number; y:number; strike:number; gex:number } | null>(null);
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
    fetch(`${API}/api/analytics/gex/${symbol}?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setData(d.data || []); setSpot(d.spot || 0); setError(false); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol, selectedExpirations, expLoading]);

  const pct = strikeRange === "all" ? null : Number(strikeRange);
  const filtered = spot > 0
    ? data.filter(d => (pct == null ? true : (d.strike >= spot * (1 - pct / 100) && d.strike <= spot * (1 + pct / 100))))
    : data.slice(0, 60);
  const netGEX = filtered.reduce((sum, d) => sum + d.gex, 0);
  const flipStrike = filtered.find((d, i) => i > 0 && Math.sign(d.gex) !== Math.sign(filtered[i - 1].gex))?.strike;

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
                <span className="relative inline-flex items-center">📅{expBadge > 0 && <span className="absolute -top-2 -right-2 text-[9px] w-4 h-4 inline-flex items-center justify-center rounded-full bg-[#7c3aed] !text-white">{expBadge}</span>}</span>
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
            <div className="flex items-center gap-3 text-xs">
              <span className={netGEX >= 0 ? "text-bull font-mono" : "text-bear font-mono"}>{netGEX >= 0 ? "+" : ""}{(netGEX / 1e9).toFixed(1)}B</span>
              {flipStrike && <span className="text-neutral-600">Flip: <span className="text-white font-mono">${flipStrike}</span></span>}
            </div>
          </>
        }
      />
      <div className="flex-1 min-h-0 p-2 relative">
        {(loading || expLoading) && <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading…</div>}
        {error && !loading && !expLoading && <div className="flex items-center justify-center h-full text-xs text-neutral-600">Backend offline</div>}
        {!loading && !error && !expLoading && (
          <>
          {hover && (
            <>
              <div className="absolute left-2 top-2 z-20 text-xs font-mono">
                <span className="text-neutral-500">Strike </span><span className="text-white">{hover.strike}</span>
                <span className="mx-2 text-neutral-500">|</span>
                <span className={hover.gex >= 0 ? "text-bull" : "text-bear"}>GEX {hover.gex >= 0 ? "+" : ""}{(hover.gex/1e9).toFixed(2)}B</span>
              </div>
              <div className="absolute inset-y-2 z-10 border-l border-dashed border-neutral-400/60" style={{ left: hover.x }} />
              <div className="absolute inset-x-2 z-10 border-t border-dashed border-neutral-400/60" style={{ top: hover.y }} />
              <div className="absolute z-20 px-1.5 py-0.5 text-[10px] rounded bg-black text-white dark:bg-white dark:text-black" style={{ left: Math.max(8, hover.x - 18), bottom: 2 }}>{hover.strike}</div>
              <div className="absolute z-20 px-1.5 py-0.5 text-[10px] rounded bg-black text-white dark:bg-white dark:text-black" style={{ right: 2, top: Math.max(10, hover.y - 10) }}>{(hover.gex/1e9).toFixed(2)}B</div>
            </>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filtered}
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              onMouseMove={(s:any) => {
                if (!s?.isTooltipActive || !s?.activePayload?.length) { setHover(null); return; }
                const row = s.activePayload[0]?.payload;
                if (!row) return;
                setHover({ x: s.chartX, y: s.chartY, strike: Number(row.strike), gex: Number(row.gex) });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <XAxis dataKey="strike" tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1e9).toFixed(1)}B`} />
              <ReferenceLine y={0} stroke="#2a2a2a" />
              {flipStrike && <ReferenceLine x={flipStrike} stroke="#ffffff33" strokeDasharray="4 2" />}
              {flipStrike && (
                <ReferenceDot x={flipStrike} y={0} r={0} shape={(p:any) => (
                  <g transform={`translate(${p.cx - 7},${p.cy - 18})`}>
                    <rect x="0" y="0" width="14" height="14" rx="3" fill="#111827cc" />
                    <path d="M4 7h6M7 4l3 3-3 3" stroke="#fff" strokeWidth="1.5" fill="none" />
                  </g>
                )} />
              )}
              <Bar dataKey="gex" radius={[2, 2, 0, 0]}>
                {filtered.map((entry, i) => <Cell key={i} fill={entry.gex >= 0 ? bull : bear} fillOpacity={0.75} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}
