"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter as FilterIcon, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type Row = {
  symbol: string;
  price: number;
  sector: string;
  marketCapB: number;
  relVol: number;
  c1m: number;
  c1h: number;
  c1d: number;
  c1w: number;
  c1mth: number;
  c1y: number;
  cytd: number;
  logo?: string;
};

type Field = keyof Row;
type Op = "=" | ">" | "<" | "!=" | ">=" | "<=" | "in" | "not-in";
type Cond = { id: string; field: Field; op: Op; value: string };

const ENUM_FIELDS: Field[] = ["sector", "symbol"];
const SORT_FIELD_TO_API: Record<Field, string> = {
  symbol: "s",
  price: "p",
  sector: "sec",
  marketCapB: "mc",
  relVol: "rv",
  c1m: "c1m",
  c1h: "c1h",
  c1d: "c1d",
  c1w: "c1w",
  c1mth: "c1mo",
  c1y: "c1y",
  cytd: "ytd",
  logo: "lg",
};

const FILTER_FIELD_TO_API: Record<Field, string> = {
  symbol: "s",
  price: "p",
  sector: "sec",
  marketCapB: "mc",
  relVol: "rv",
  c1m: "c1m",
  c1h: "c1h",
  c1d: "c1d",
  c1w: "c1w",
  c1mth: "c1mo",
  c1y: "c1y",
  cytd: "ytd",
  logo: "lg",
};

export function ScreenerWidget() {
  const { activeTabId, activeTab, setGlobalSymbols } = useDashboardStore();
  const globalSymbols = activeTab()?.globalSymbols || [];
  const themeMode = useDashboardStore((s) => s.theme.mode);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<Field | "">("");
  const [sortDir, setSortDir] = useState<0 | 1 | -1>(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [conds, setConds] = useState<Cond[]>([
    { id: crypto.randomUUID(), field: "marketCapB", op: ">", value: "5" },
    { id: crypto.randomUUID(), field: "c1d", op: ">", value: "1" },
    { id: crypto.randomUUID(), field: "relVol", op: ">", value: "1.2" },
  ]);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setShowFilters(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const sort = sortKey ? SORT_FIELD_TO_API[sortKey] : "c1d";
      const dir = sortDir === 1 ? "asc" : "desc";
      const compactConds = conds.map((c) => ({ f: FILTER_FIELD_TO_API[c.field], op: c.op, v: c.value }));
      const qs = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort,
        dir,
        filters: JSON.stringify(compactConds),
      });

      const r = await fetch(`${API}/api/screener?${qs.toString()}`);
      if (!r.ok) throw new Error("screener request failed");
      const d = await r.json();

      const mapped: Row[] = (d?.i || []).map((x: any) => ({
        symbol: String(x.s || ""),
        price: Number(x.p || 0),
        sector: String(x.sec || "Unknown"),
        marketCapB: Number(x.mc || 0),
        relVol: Number(x.rv || 0),
        c1m: Number(x.c1m || 0),
        c1h: Number(x.c1h || 0),
        c1d: Number(x.c1d || 0),
        c1w: Number(x.c1w || 0),
        c1mth: Number(x.c1mo || 0),
        c1y: Number(x.c1y || 0),
        cytd: Number(x.ytd || 0),
        logo: String(x.lg || ""),
      }));

      setRows(mapped);
      setTotal(Number(d?.t || 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
    const t = setInterval(fetchPage, 30000);
    return () => clearInterval(t);
  }, [page, pageSize, sortKey, sortDir, conds]);

  const sectors = useMemo(() => Array.from(new Set(rows.map((r) => r.sector))).sort(), [rows]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const pctCls = (v: number) => (v >= 0 ? "text-bull" : "text-bear");

  const cycleSort = (k: Field) => {
    setPage(1);
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir(1);
      return;
    }
    if (sortDir === 1) {
      setSortDir(-1);
      return;
    }
    if (sortDir === -1) {
      setSortKey("");
      setSortDir(0);
      return;
    }
    setSortDir(1);
  };

  const toggleGlobalSymbol = (sym: string) => {
    if (globalSymbols.includes(sym)) setGlobalSymbols(activeTabId, globalSymbols.filter((s) => s !== sym));
    else setGlobalSymbols(activeTabId, [...globalSymbols, sym]);
  };

  const rowBorder = themeMode === "dark" ? "border-neutral-800/80" : "border-surface-border/60";

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-1.5 border-b border-surface-border flex items-center gap-2 text-xs relative" ref={popRef}>
        <button onClick={() => setShowFilters((v) => !v)} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-surface-border hover:bg-surface-overlay">
          <FilterIcon size={12} /> Filters ({conds.length})
        </button>

        <div className="ml-auto inline-flex items-center gap-1 text-[11px] text-neutral-500">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1 rounded border border-surface-border disabled:opacity-40 hover:bg-surface-overlay"><ChevronLeft size={12} /></button>
          <span>{page}/{pageCount}</span>
          <button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="p-1 rounded border border-surface-border disabled:opacity-40 hover:bg-surface-overlay"><ChevronRight size={12} /></button>
          <span className="ml-2">{total} rows</span>
        </div>

        {showFilters && (
          <div className="absolute left-2 top-8 z-40 w-[420px] max-w-[90vw] rounded-lg border border-surface-border bg-surface-raised p-2 shadow-2xl space-y-2">
            {conds.map((c) => {
              const enumField = ENUM_FIELDS.includes(c.field);
              return (
                <div key={c.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
                  <select
                    value={c.field}
                    onChange={(e) => setConds((prev) => prev.map((x) => x.id === c.id ? { ...x, field: e.target.value as Field, op: ENUM_FIELDS.includes(e.target.value as Field) ? "=" : ">" } : x))}
                    className="bg-surface-overlay border border-surface-border rounded px-1 py-1"
                  >
                    {(["symbol", "sector", "marketCapB", "price", "relVol", "c1m", "c1h", "c1d", "c1w", "c1mth", "c1y", "cytd"] as Field[]).map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select
                    value={c.op}
                    onChange={(e) => setConds((prev) => prev.map((x) => x.id === c.id ? { ...x, op: e.target.value as Op } : x))}
                    className="bg-surface-overlay border border-surface-border rounded px-1 py-1"
                  >
                    {enumField ? (
                      <>
                        <option value="=">=</option>
                        <option value="in">is one of</option>
                        <option value="not-in">is none of</option>
                      </>
                    ) : (
                      <>
                        <option value="=">=</option><option value=">">&gt;</option><option value="<">&lt;</option><option value="!=">!=</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option>
                      </>
                    )}
                  </select>
                  <input value={c.value} onChange={(e) => setConds((prev) => prev.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} placeholder={enumField ? "A,B,C" : "value"} className="bg-surface-overlay border border-surface-border rounded px-2 py-1" />
                  <button onClick={() => { setPage(1); setConds((prev) => prev.filter((x) => x.id !== c.id)); }} className="p-1 rounded hover:bg-surface-overlay"><X size={12} /></button>
                </div>
              );
            })}
            <button onClick={() => { setPage(1); setConds((prev) => [...prev, { id: crypto.randomUUID(), field: "marketCapB", op: ">", value: "0" }]); }} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-surface-border hover:bg-surface-overlay"><Plus size={12} /> Add condition</button>
            <div className="text-[10px] text-neutral-500">Sectors on page: {sectors.join(", ") || "-"}</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto text-xs">
        {loading && <div className="p-4 text-neutral-500 animate-pulse">Loading screener…</div>}
        {!loading && (
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 bg-surface-raised border-b border-surface-border">
              <tr className="text-neutral-500">
                {[
                  ["symbol", "Ticker"], ["price", "Price"], ["marketCapB", "MCap"], ["sector", "Sector"], ["relVol", "RelVol"],
                  ["c1m", "1m"], ["c1h", "1H"], ["c1d", "1D"], ["c1w", "1W"], ["c1mth", "1M"], ["c1y", "1Y"], ["cytd", "YTD"],
                ].map(([k, h]) => (
                  <th key={k} className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => cycleSort(k as Field)}>
                    {h}{sortKey === k && (sortDir === 1 ? " ↑" : sortDir === -1 ? " ↓" : "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const selected = globalSymbols.includes(r.symbol);
                return (
                  <tr key={r.symbol} className={`border-b ${rowBorder} hover:bg-surface-overlay/60 ${selected ? "bg-accent/10" : ""}`}>
                    <td className="px-2 py-1.5 font-mono text-white">
                      <button onClick={() => toggleGlobalSymbol(r.symbol)} className="inline-flex items-center gap-2 hover:underline">
                        {r.logo && <img src={`https://logo.clearbit.com/${r.logo}`} alt="" className="w-4 h-4 rounded-full" onError={(e: any) => { e.currentTarget.style.display = "none"; }} />}
                        <span>{r.symbol}</span>
                      </button>
                    </td>
                    <td className="px-2 py-1.5 font-mono">${r.price.toFixed(2)}</td>
                    <td className="px-2 py-1.5">{r.marketCapB.toFixed(0)}B</td>
                    <td className="px-2 py-1.5">{r.sector}</td>
                    <td className="px-2 py-1.5">{r.relVol.toFixed(2)}</td>
                    <td className={`px-2 py-1.5 ${pctCls(r.c1m)}`}>{r.c1m.toFixed(2)}%</td>
                    <td className={`px-2 py-1.5 ${pctCls(r.c1h)}`}>{r.c1h.toFixed(2)}%</td>
                    <td className={`px-2 py-1.5 ${pctCls(r.c1d)}`}>{r.c1d.toFixed(2)}%</td>
                    <td className={`px-2 py-1.5 ${pctCls(r.c1w)}`}>{r.c1w.toFixed(2)}%</td>
                    <td className={`px-2 py-1.5 ${pctCls(r.c1mth)}`}>{r.c1mth.toFixed(2)}%</td>
                    <td className={`px-2 py-1.5 ${pctCls(r.c1y)}`}>{r.c1y.toFixed(2)}%</td>
                    <td className={`px-2 py-1.5 ${pctCls(r.cytd)}`}>{r.cytd.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
