"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SymbolBar } from "./SymbolBar";
import { useDashboardStore } from "@/lib/store/dashboardStore";
import { OptionsLightHistogram } from "./OptionsLightHistogram";

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
        label="Open Interest"
        mobileLabel="OI"
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
          <OptionsLightHistogram
            rows={data.map(r => ({
              strike: r.strike,
              value: r.callOI - r.putOI,
              color: (r.callOI + r.putOI) === 0 ? '#cbd5e1' : (r.callOI >= r.putOI ? bull : bear),
              meta: r,
            }))}
            valueFormat={(v) => `${(v / 1000).toFixed(1)}k`}
            statusRender={(r) => {
              const m = r.meta || {};
              return `Strike ${r.strike} | C ${Math.round(m.callOI || 0).toLocaleString()} / P ${Math.round(m.putOI || 0).toLocaleString()}`;
            }}
          />
        )}
      </div>
    </div>
  );
}
