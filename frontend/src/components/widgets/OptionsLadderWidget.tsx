"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { SymbolBar } from "./SymbolBar";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type Row = { strike: number; call_bid: number; call_ask: number; put_bid: number; put_ask: number };

export function OptionsLadderWidget({ symbol = "SPY", isGlobalOverride, config, onConfigChange }: { symbol?: string; isGlobalOverride?: boolean; config?: Record<string, string>; onConfigChange?: (patch: Record<string, string>) => void }) {
  const [expirations, setExpirations] = useState<string[]>([]);
  const [exp, setExp] = useState(config?.expDate || "");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/market/expirations/${symbol}`)
      .then(r => r.json())
      .then(d => {
        const ex = Array.isArray(d?.expirations) ? d.expirations : [];
        setExpirations(ex);
        const next = config?.expDate && ex.includes(config.expDate) ? config.expDate : (ex[0] || "");
        setExp(next);
        if (next) onConfigChange?.({ expDate: next });
      });
  }, [symbol]);

  useEffect(() => {
    if (!exp) return;
    setLoading(true);
    fetch(`${API}/api/market/options/${symbol}?expiration_date=${encodeURIComponent(exp)}`)
      .then(r => r.json())
      .then((d) => {
        const chain = Array.isArray(d) ? d : [];
        const m = new Map<number, Row>();
        for (const o of chain) {
          const strike = Number(o?.strike || 0);
          if (!strike) continue;
          const row = m.get(strike) || { strike, call_bid: 0, call_ask: 0, put_bid: 0, put_ask: 0 };
          const t = String(o?.option_type || "").toLowerCase();
          if (t === "call") { row.call_bid = Number(o?.bid || 0); row.call_ask = Number(o?.ask || 0); }
          if (t === "put") { row.put_bid = Number(o?.bid || 0); row.put_ask = Number(o?.ask || 0); }
          m.set(strike, row);
        }
        setRows(Array.from(m.values()).sort((a, b) => a.strike - b.strike));
        setLoading(false);
      })
      .catch(() => { setRows([]); setLoading(false); });
  }, [symbol, exp]);

  const around = useMemo(() => {
    if (!rows.length) return rows;
    const mid = Math.floor(rows.length / 2);
    return rows.slice(Math.max(0, mid - 20), Math.min(rows.length, mid + 20));
  }, [rows]);

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        label="Options Ladder"
        mobileLabel="Ladder"
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
        extra={
          <details className="relative">
            <summary className="list-none cursor-pointer text-xs text-neutral-300 relative">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-overlay">
                <CalendarDays size={12} /> {exp || "Select expiration"}
              </span>
            </summary>
            <div className="absolute z-30 mt-1 w-44 max-h-56 overflow-auto rounded bg-surface-raised shadow-xl p-1 pop-in">
              {expirations.map(e => (
                <label key={e} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-overlay cursor-pointer text-xs">
                  <input type="radio" checked={exp === e} onChange={() => { setExp(e); onConfigChange?.({ expDate: e }); }} />
                  <span className="font-mono">{e}</span>
                </label>
              ))}
            </div>
          </details>
        }
      />

      <div className="flex-1 min-h-0 overflow-auto p-2">
        {loading ? <div className="text-xs text-neutral-500 animate-pulse">Loading ladder…</div> : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-raised">
              <tr className="text-neutral-500">
                <th className="text-left px-2 py-1">Call Bid</th>
                <th className="text-left px-2 py-1">Call Ask</th>
                <th className="text-left px-2 py-1">Strike</th>
                <th className="text-left px-2 py-1">Put Bid</th>
                <th className="text-left px-2 py-1">Put Ask</th>
              </tr>
            </thead>
            <tbody>
              {around.map(r => (
                <tr key={r.strike} className="hover:bg-surface-overlay/50">
                  <td className="px-2 py-1 text-bull">{r.call_bid.toFixed(2)}</td>
                  <td className="px-2 py-1 text-bull">{r.call_ask.toFixed(2)}</td>
                  <td className="px-2 py-1 font-mono text-white">{r.strike}</td>
                  <td className="px-2 py-1 text-bear">{r.put_bid.toFixed(2)}</td>
                  <td className="px-2 py-1 text-bear">{r.put_ask.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
