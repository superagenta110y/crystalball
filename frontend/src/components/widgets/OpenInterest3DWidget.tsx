"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SymbolBar } from "./SymbolBar";

interface OpenInterest3DWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  config?: Record<string, string>;
  onConfigChange?: (patch: Record<string, string>) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL || "";
const parseCsv = (v?: string) => (v ? v.split(",").map(s => s.trim()).filter(Boolean) : []);

export function OpenInterest3DWidget({ symbol = "SPY", isGlobalOverride, config, onConfigChange }: OpenInterest3DWidgetProps) {
  const [expLoading, setExpLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [selectedExpirations, setSelectedExpirations] = useState<string[]>(parseCsv(config?.expDates));
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [strikes, setStrikes] = useState<number[]>([]);

  useEffect(() => { setSelectedExpirations(parseCsv(config?.expDates)); }, [config?.expDates]);

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
          return exps.length ? [exps[0]] : [];
        });
        setExpLoading(false);
      })
      .catch(() => { setAvailableExpirations([]); setSelectedExpirations([]); setExpLoading(false); });
  }, [symbol]);

  useEffect(() => {
    if (expLoading) return;
    const exps = selectedExpirations.length ? selectedExpirations : availableExpirations.slice(0, 4);
    if (!exps.length) {
      setMatrix({}); setStrikes([]); return;
    }

    setLoading(true);
    Promise.all(exps.map(exp => fetch(`${API}/api/analytics/oi/${symbol}?expiration_date=${encodeURIComponent(exp)}`).then(r => r.json())))
      .then((all) => {
        const m: Record<string, Record<string, number>> = {};
        const strikeSet = new Set<number>();
        all.forEach((res, idx) => {
          const exp = exps[idx];
          m[exp] = {};
          (res?.data || []).forEach((row: any) => {
            const strike = Number(row.strike);
            const oi = Number(row.oi_total || 0);
            strikeSet.add(strike);
            m[exp][String(strike)] = oi;
          });
        });
        const sorted = Array.from(strikeSet).sort((a,b) => a-b);
        setStrikes(sorted);
        setMatrix(m);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [symbol, selectedExpirations, expLoading]);

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

  const exps = selectedExpirations.length ? selectedExpirations : availableExpirations.slice(0, 4);
  const maxOI = Math.max(1, ...Object.values(matrix).flatMap(v => Object.values(v)));

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
        extra={
          <details className="relative">
            <summary className="list-none cursor-pointer text-xs border border-surface-border bg-surface-overlay rounded px-2 py-1 text-neutral-200">
              Exp: <span className="font-mono">{expLabel}</span>
            </summary>
            <div className="absolute right-0 mt-1 z-20 w-52 max-h-64 overflow-auto rounded border border-surface-border bg-surface p-2 shadow-xl">
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
        }
      />

      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        {(loading || expLoading) && <div className="h-full flex items-center justify-center text-xs text-neutral-500 animate-pulse">Loading 3D OI…</div>}
        {error && !loading && <div className="h-full flex items-center justify-center text-xs text-neutral-500">Failed to load OI surface</div>}
        {!loading && !error && exps.length > 0 && strikes.length > 0 && (
          <div className="h-full w-full">
            <div className="text-[10px] text-neutral-500 mb-1">OI surface (Strike × Expiration)</div>
            <div
              className="grid h-[calc(100%-14px)] w-full gap-[2px]"
              style={{
                gridTemplateColumns: `52px repeat(${exps.length}, minmax(0, 1fr))`,
                gridTemplateRows: `18px repeat(${strikes.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="text-[9px] text-neutral-500 flex items-center">Strike</div>
              {exps.map(exp => (
                <div key={exp} className="text-[9px] text-neutral-500 font-mono truncate flex items-center justify-center px-1">{exp}</div>
              ))}

              {strikes.map((s) => (
                <React.Fragment key={s}>
                  <div className="text-[9px] text-neutral-500 font-mono flex items-center px-1 truncate">{s}</div>
                  {exps.map((exp) => {
                    const oi = matrix[exp]?.[String(s)] || 0;
                    const ratio = maxOI > 0 ? oi / maxOI : 0;
                    const alpha = Math.max(0.06, Math.min(0.95, ratio));
                    return (
                      <div
                        key={`${exp}-${s}`}
                        className="border border-surface-border/60 rounded-sm"
                        style={{ backgroundColor: `rgba(var(--bull-rgb), ${alpha})` }}
                        title={`${exp} | ${s} | OI ${oi.toLocaleString()}`}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
