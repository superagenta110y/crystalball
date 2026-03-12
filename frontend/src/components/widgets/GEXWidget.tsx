"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { SymbolBar } from "./SymbolBar";
import { useDashboardStore } from "@/lib/store/dashboardStore";
import { OptionsLightHistogram } from "./OptionsLightHistogram";
import { AppDropdown } from "@/components/ui/AppDropdown";

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
    return `${selectedExpirations.length}`;
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
        label="Gamma Exposure"
        mobileLabel="GEX"
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
        extra={
          <>
            <details className="relative">
              <summary className="list-none cursor-pointer text-xs text-neutral-300 relative">
                <span className="inline-flex items-center gap-1"><CalendarDays size={12} /><span className="text-[11px] font-mono text-neutral-300 leading-none self-center">{expLabel}</span></span>
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
            <AppDropdown
              value={strikeRange}
              onChange={(v) => { setStrikeRange(v); onConfigChange?.({ strikeRange: v }); }}
              options={[
                { value: "all", label: "All Strikes" },
                { value: "1", label: "± 1%" },
                { value: "2", label: "± 2%" },
                { value: "5", label: "± 5%" },
                { value: "10", label: "± 10%" },
                { value: "20", label: "± 20%" },
                { value: "50", label: "± 50%" },
              ]}
            />
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
          <OptionsLightHistogram
            rows={filtered.map(r => ({ strike: r.strike, value: r.gex, color: r.gex >= 0 ? bull : bear }))}
            valueFormat={(v) => `${(v / 1e9).toFixed(2)}B`}
            statusRender={(r) => `Strike ${r.strike} | ${r.value >= 0 ? '+' : ''}${(r.value / 1e9).toFixed(2)}B`}
          />
        )}
      </div>
    </div>
  );
}
