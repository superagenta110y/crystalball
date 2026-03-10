"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter as FilterIcon, Plus, X } from "lucide-react";
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
const FIELD_LABEL: Record<Field, string> = {
  symbol: "Ticker",
  sector: "Sector",
  marketCapB: "Market Cap",
  price: "Price",
  relVol: "Relative Volume",
  c1m: "%1M Change",
  c1h: "%1H Change",
  c1d: "%1D Change",
  c1w: "%1W Change",
  c1mth: "%1Mo Change",
  c1y: "%1Y Change",
  cytd: "%YTD Change",
  logo: "Logo",
};
const MC_BUCKETS = [
  { value: "bucket:lt10m", label: "<10M" },
  { value: "bucket:10m_99m", label: "10M-99M" },
  { value: "bucket:100m_999m", label: "100M-999M" },
  { value: "bucket:1b_99b", label: "1B-99B" },
  { value: "bucket:100b_999b", label: "100B-999B" },
  { value: "bucket:1t_plus", label: "1T+" },
];
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

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<Field | "">("");
  const [sortDir, setSortDir] = useState<0 | 1 | -1>(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const [conds, setConds] = useState<Cond[]>([
    { id: crypto.randomUUID(), field: "c1d", op: ">", value: "1" },
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

      setRows(prev => page === 1 ? mapped : [...prev, ...mapped]);
      const t = Number(d?.t || 0);
      setTotal(t);
      setHasMore((page * pageSize) < t && mapped.length > 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
    const t = setInterval(() => { setPage(1); }, 30000);
    return () => clearInterval(t);
  }, [page, pageSize, sortKey, sortDir, conds]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!hasMore || loading) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
        setPage(p => p + 1);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, loading]);

  useEffect(() => {
    if (!rows.length || typeof window === "undefined") return;
    const wsBase = (API && API.trim()) ? API.replace(/^http/, "ws") : window.location.origin.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/ws/screener`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ symbols: rows.map(r => r.symbol) }));
    };
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d?.type !== "screener" || !Array.isArray(d?.items)) return;
        const map = new Map<string, any>((d.items || []).map((x: any) => [String(x.s), x]));
        setRows(prev => prev.map(r => {
          const x = map.get(r.symbol);
          if (!x) return r;
          return { ...r, price: Number(x.p || r.price), relVol: Number(x.rv || r.relVol), c1d: Number(x.c1d || r.c1d) };
        }));
      } catch {}
    };
    return () => ws.close();
  }, [rows.map(r => r.symbol).join(",")]);

  const sectors = useMemo(() => Array.from(new Set(rows.map((r) => r.sector))).sort(), [rows]);

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


  return (
    <div className="h-full w-full flex flex-col relative" ref={popRef}>
      <div className="absolute top-1 left-1 z-30 inline-flex items-center gap-1 text-[11px] text-neutral-500">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="p-1.5 rounded hover:bg-surface-overlay text-neutral-500 hover:text-white opacity-100 sm:opacity-0 sm:group-hover/widget:opacity-100 transition"
          title="Filters"
        >
          <FilterIcon size={13} />
        </button>
      </div>

      {showFilters && (
          <div className="absolute right-2 top-8 z-40 w-[420px] max-w-[90vw] rounded-lg bg-surface-raised p-2 shadow-2xl space-y-2 pop-in">
            {conds.map((c) => {
              const enumField = ENUM_FIELDS.includes(c.field);
              return (
                <div key={c.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
                  <select
                    value={c.field}
                    onChange={(e) => setConds((prev) => prev.map((x) => x.id === c.id ? { ...x, field: e.target.value as Field, op: (ENUM_FIELDS.includes(e.target.value as Field) || e.target.value === "marketCapB") ? "=" : ">", value: e.target.value === "marketCapB" ? "bucket:1b_99b" : x.value } : x))}
                    className="bg-surface-overlay border border-surface-border rounded px-1 py-1"
                  >
                    {(["symbol", "sector", "marketCapB", "price", "relVol", "c1m", "c1h", "c1d", "c1w", "c1mth", "c1y", "cytd"] as Field[]).map((f) => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}
                  </select>
                  <select
                    value={c.op}
                    onChange={(e) => setConds((prev) => prev.map((x) => x.id === c.id ? { ...x, op: e.target.value as Op } : x))}
                    className="bg-surface-overlay border border-surface-border rounded px-1 py-1"
                    disabled={c.field === "marketCapB"}
                  >
                    {enumField ? (
                      <>
                        <option value="=">=</option>
                        <option value="in">is one of</option>
                        <option value="not-in">is none of</option>
                      </>
                    ) : c.field === "marketCapB" ? (
                      <>
                        <option value="=">is</option>
                      </>
                    ) : (
                      <>
                        <option value="=">=</option><option value=">">&gt;</option><option value="<">&lt;</option><option value="!=">!=</option><option value=">=">&gt;=</option><option value="<=">&lt;=</option>
                      </>
                    )}
                  </select>
                  {c.field === "marketCapB" ? (
                    <select value={c.value} onChange={(e) => setConds((prev) => prev.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} className="bg-surface-overlay border border-surface-border rounded px-2 py-1">
                      {MC_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  ) : (
                    <input value={c.value} onChange={(e) => setConds((prev) => prev.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} placeholder={enumField ? "A,B,C" : "value"} className="bg-surface-overlay border border-surface-border rounded px-2 py-1" />
                  )}
                  <button onClick={() => { setPage(1); setConds((prev) => prev.filter((x) => x.id !== c.id)); }} className="px-1.5 py-1 rounded hover:bg-surface-overlay text-neutral-400 hover:text-white" title="Remove condition">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => { setPage(1); setConds((prev) => [...prev, { id: crypto.randomUUID(), field: "c1d", op: ">", value: "1" }]); }} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-surface-border hover:bg-surface-overlay"><Plus size={12} /> Add condition</button>
            <div className="text-[10px] text-neutral-500">Sectors on page: {sectors.join(", ") || "-"}</div>
          </div>
        )}

      <div ref={listRef} className="flex-1 overflow-auto text-xs relative">
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
                  <tr key={r.symbol} className={`hover:bg-surface-overlay/60 ${selected ? "bg-accent/10" : ""}`}>
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
        {!loading && (
          <div className="absolute right-2 bottom-1 text-[10px] text-neutral-500/70 pointer-events-none">
            {total} tickers
          </div>
        )}
      </div>
    </div>
  );
}
