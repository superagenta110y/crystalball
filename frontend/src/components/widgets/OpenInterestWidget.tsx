"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from "recharts";
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
  const [hover, setHover] = useState<{ x:number; y:number; strike:number; call:number; put:number } | null>(null);
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

      <div className="flex-1 min-h-0 p-2 relative">
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
          <>
          {hover && (
            <>
              <div className="absolute left-2 top-2 z-20 text-xs font-mono">
                <span className="text-neutral-500">Strike </span><span className="text-white">{hover.strike}</span>
                <span className="mx-2 text-neutral-500">|</span>
                <span className="text-bull">C {Math.round(hover.call).toLocaleString()}</span>
                <span className="mx-1 text-neutral-500">/</span>
                <span className="text-bear">P {Math.round(hover.put).toLocaleString()}</span>
              </div>
              <div className="absolute inset-y-2 z-10 border-l border-dashed border-neutral-400/60" style={{ left: hover.x }} />
              <div className="absolute inset-x-2 z-10 border-t border-dashed border-neutral-400/60" style={{ top: hover.y }} />
              <div className="absolute z-20 px-1.5 py-0.5 text-[10px] rounded bg-black text-white dark:bg-white dark:text-black" style={{ left: Math.max(8, hover.x - 18), bottom: 2 }}>{hover.strike}</div>
              <div className="absolute z-20 px-1.5 py-0.5 text-[10px] rounded bg-black text-white dark:bg-white dark:text-black" style={{ right: 2, top: Math.max(10, hover.y - 10) }}>{Math.round(Math.max(hover.call, hover.put)/1000)}k</div>
            </>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
              onMouseMove={(s:any) => {
                if (!s?.isTooltipActive || !s?.activePayload?.length) { setHover(null); return; }
                const row = s.activePayload[0]?.payload;
                if (!row) return;
                setHover({ x: s.chartX, y: s.chartY, strike: Number(row.strike), call: Number(row.callOI), put: Number(row.putOI) });
              }}
              onMouseLeave={() => setHover(null)}
            >
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
              <ReferenceLine x={center} stroke="#ffffff22" strokeDasharray="4 2" />
              <ReferenceDot x={center} y={0} r={0} shape={(p:any) => (
                <g transform={`translate(${p.cx - 7},${p.cy + 4})`}>
                  <rect x="0" y="0" width="14" height="14" rx="3" fill="#111827cc" />
                  <path d="M7 2l2 4h4l-3 2.5 1 4-4-2-4 2 1-4L1 6h4z" fill="#fff" />
                </g>
              )} />
              <Bar dataKey="callOI" fill={bull} fillOpacity={0.7} radius={[2,2,0,0]} name="Calls" />
              <Bar dataKey="putOI"  fill={bear} fillOpacity={0.7} radius={[2,2,0,0]} name="Puts" />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                formatter={(v) => <span style={{ color: "#8b8fa8" }}>{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}
