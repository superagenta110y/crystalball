"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SymbolBar } from "./SymbolBar";

interface OpenInterest3DWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  config?: Record<string, string>;
  onConfigChange?: (patch: Record<string, string>) => void;
}

type CellData = { call: number; put: number; total: number; vol: number; net: number; skew: number };

const API = process.env.NEXT_PUBLIC_API_URL || "";
const parseCsv = (v?: string) => (v ? v.split(",").map(s => s.trim()).filter(Boolean) : []);
const fmtCompact = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${Math.round(n)}`;

export function OpenInterest3DWidget({ symbol = "SPY", isGlobalOverride, config, onConfigChange }: OpenInterest3DWidgetProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 700, h: 380 });

  const [expLoading, setExpLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [selectedExpirations, setSelectedExpirations] = useState<string[]>(parseCsv(config?.expDates));
  const [strikeRange, setStrikeRange] = useState<string>(config?.strikeRange || "5");
  const [spot, setSpot] = useState<number>(0);
  const [matrix, setMatrix] = useState<Record<string, Record<string, CellData>>>({});
  const [strikes, setStrikes] = useState<number[]>([]);
  const [hoverCell, setHoverCell] = useState<{ exp: string; strike: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ exp: string; strike: number; data: CellData } | null>(null);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: Math.max(320, r.width), h: Math.max(220, r.height) });
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

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
    const exps = selectedExpirations.length ? selectedExpirations : availableExpirations.slice(0, 4);
    if (!exps.length) { setMatrix({}); setStrikes([]); return; }

    setLoading(true);
    Promise.all(exps.map(exp => fetch(`${API}/api/analytics/oi/${symbol}?expiration_date=${encodeURIComponent(exp)}`).then(r => r.json())))
      .then((all) => {
        const m: Record<string, Record<string, CellData>> = {};
        const strikeSet = new Set<number>();
        setSpot(Number(all?.[0]?.spot || 0));
        all.forEach((res, idx) => {
          const exp = exps[idx];
          m[exp] = {};
          (res?.data || []).forEach((row: any) => {
            const strike = Number(row.strike);
            const call = Number(row.oi_call || 0);
            const put = Number(row.oi_put || 0);
            const total = Number(row.oi_total || 0);
            const vol = Number(row.volume_total || 0);
            const net = call - put;
            const skew = total > 0 ? net / total : 0;
            strikeSet.add(strike);
            m[exp][String(strike)] = { call, put, total, vol, net, skew };
          });
        });
        const sorted = Array.from(strikeSet).sort((a, b) => a - b);
        setStrikes(sorted);
        setMatrix(m);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [symbol, selectedExpirations, expLoading]);

  const allSelected = availableExpirations.length > 0 && selectedExpirations.length === availableExpirations.length;
  const expBadge = allSelected ? 0 : selectedExpirations.length;
  const exps = selectedExpirations.length ? selectedExpirations : availableExpirations.slice(0, 4);
  const pct = strikeRange === "all" ? null : Number(strikeRange);
  const filteredStrikes = spot > 0 ? strikes.filter(s => (pct == null ? true : (s >= spot * (1 - pct / 100) && s <= spot * (1 + pct / 100)))) : strikes;

  const xLabelEvery = Math.max(1, Math.ceil(exps.length / Math.max(2, Math.floor((size.w - 52) / 70))));
  const yLabelEvery = Math.max(1, Math.ceil(filteredStrikes.length / Math.max(2, Math.floor((size.h - 42) / 18))));

  const cellBg = (d: CellData) => {
    const abs = Math.min(1, Math.abs(d.skew));
    if (abs < 0.04) return `rgba(255,255,255,${0.2 + abs * 2})`;
    if (d.skew > 0) return `rgba(var(--bull-rgb),${0.2 + abs * 0.75})`;
    return `rgba(var(--bear-rgb),${0.2 + abs * 0.75})`;
  };

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
    <div ref={wrapRef} className="h-full w-full flex flex-col">
      <SymbolBar
        label="OI Grid"
        mobileLabel="Grid"
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
                <label className="flex items-center gap-2 text-xs py-1 border-b border-surface-border mb-1"><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /><span>All</span></label>
                {availableExpirations.map((exp) => (
                  <label key={exp} className="flex items-center gap-2 text-xs py-1"><input type="checkbox" checked={selectedExpirations.includes(exp)} onChange={(e) => toggleExpiration(exp, e.target.checked)} /><span className="font-mono">{exp}</span></label>
                ))}
              </div>
            </details>
            <select value={strikeRange} onChange={(e) => { setStrikeRange(e.target.value); onConfigChange?.({ strikeRange: e.target.value }); }} className="text-xs border border-surface-border bg-surface-overlay rounded px-1.5 py-1" title="Strike filter">
              <option value="all">All Strikes</option><option value="1">± 1%</option><option value="2">± 2%</option><option value="5">± 5%</option><option value="10">± 10%</option><option value="20">± 20%</option><option value="50">± 50%</option>
            </select>
          </>
        }
      />

      <div className="flex-1 min-h-0 p-2 overflow-hidden relative">
        {(loading || expLoading) && <div className="h-full flex items-center justify-center text-xs text-neutral-500 animate-pulse">Loading OI Grid…</div>}
        {error && !loading && <div className="h-full flex items-center justify-center text-xs text-neutral-500">Failed to load OI grid</div>}

        {!loading && !error && exps.length > 0 && filteredStrikes.length > 0 && (
          <div className="h-full w-full">
            <div className="text-[10px] text-neutral-500 mb-1">OI Grid (net skew = calls - puts)</div>
            <div className="grid h-[calc(100%-14px)] w-full gap-[2px]" style={{ gridTemplateColumns: `56px repeat(${exps.length}, minmax(0, 1fr))`, gridTemplateRows: `18px repeat(${filteredStrikes.length}, minmax(0, 1fr))` }}>
              <div className="text-[9px] text-neutral-500 flex items-center">Strike</div>
              {exps.map((exp, i) => <div key={exp} className="text-[9px] text-neutral-500 font-mono truncate flex items-center justify-center px-1">{i % xLabelEvery === 0 ? exp : ""}</div>)}

              {filteredStrikes.map((s, yi) => (
                <React.Fragment key={s}>
                  <div className="text-[9px] text-neutral-500 font-mono flex items-center px-1 truncate">{yi % yLabelEvery === 0 ? s : ""}</div>
                  {exps.map((exp) => {
                    const d = matrix[exp]?.[String(s)] || { call: 0, put: 0, total: 0, vol: 0, net: 0, skew: 0 };
                    const isHover = hoverCell?.exp === exp && hoverCell?.strike === s;
                    return (
                      <button
                        key={`${exp}-${s}`}
                        className="border border-surface-border/60 rounded-sm relative"
                        style={{ backgroundColor: cellBg(d) }}
                        onMouseEnter={() => setHoverCell({ exp, strike: s })}
                        onMouseLeave={() => setHoverCell(null)}
                        onClick={() => setSelectedCell({ exp, strike: s, data: d })}
                        title={`${exp} | ${s}`}
                      >
                        {isHover && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-black/80 dark:text-white/85">{fmtCompact(d.total)}</span>}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {selectedCell && (
          <div className="absolute right-3 top-3 z-30 w-48 rounded-lg border border-surface-border bg-surface-raised shadow-xl p-2 text-xs">
            <div className="flex items-center justify-between mb-1"><span className="font-mono text-white">{selectedCell.exp} · {selectedCell.strike}</span><button onClick={() => setSelectedCell(null)} className="text-neutral-500">✕</button></div>
            <div className="text-bull">Calls OI: {fmtCompact(selectedCell.data.call)}</div>
            <div className="text-bear">Puts OI: {fmtCompact(selectedCell.data.put)}</div>
            <div className="text-neutral-400">Total OI: {fmtCompact(selectedCell.data.total)}</div>
            <div className="text-neutral-400">Today's Vol: {fmtCompact(selectedCell.data.vol)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
