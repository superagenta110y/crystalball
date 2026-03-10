"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter as FilterIcon, Plus, X } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const TICKERS = ["SPY","QQQ","IWM","AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AMD","NFLX","JPM","BAC","GS","XOM","CVX","UNH","PFE","PLTR","COIN","MSTR"];

const META: Record<string, { sector: string; marketCapB: number; domain?: string }> = {
  SPY:{sector:"ETF",marketCapB:500,domain:"spdrs.com"},QQQ:{sector:"ETF",marketCapB:300,domain:"invesco.com"},IWM:{sector:"ETF",marketCapB:80,domain:"ishares.com"},
  AAPL:{sector:"Technology",marketCapB:3200,domain:"apple.com"},MSFT:{sector:"Technology",marketCapB:3100,domain:"microsoft.com"},NVDA:{sector:"Technology",marketCapB:2800,domain:"nvidia.com"},
  AMZN:{sector:"Consumer",marketCapB:1900,domain:"amazon.com"},GOOGL:{sector:"Technology",marketCapB:2200,domain:"abc.xyz"},META:{sector:"Technology",marketCapB:1600,domain:"meta.com"},TSLA:{sector:"Consumer",marketCapB:900,domain:"tesla.com"},
  AMD:{sector:"Technology",marketCapB:350,domain:"amd.com"},NFLX:{sector:"Communication",marketCapB:250,domain:"netflix.com"},JPM:{sector:"Financials",marketCapB:600,domain:"jpmorganchase.com"},BAC:{sector:"Financials",marketCapB:350,domain:"bankofamerica.com"},GS:{sector:"Financials",marketCapB:150,domain:"goldmansachs.com"},
  XOM:{sector:"Energy",marketCapB:450,domain:"exxonmobil.com"},CVX:{sector:"Energy",marketCapB:300,domain:"chevron.com"},UNH:{sector:"Healthcare",marketCapB:450,domain:"unitedhealthgroup.com"},PFE:{sector:"Healthcare",marketCapB:160,domain:"pfizer.com"},PLTR:{sector:"Technology",marketCapB:70,domain:"palantir.com"},COIN:{sector:"Financials",marketCapB:60,domain:"coinbase.com"},MSTR:{sector:"Technology",marketCapB:40,domain:"microstrategy.com"}
};

type Row = {
  symbol: string; price: number; sector: string; marketCapB: number; relVol: number;
  c1m:number;c1h:number;c1d:number;c1w:number;c1mth:number;c1y:number;cytd:number;
};

type Field = keyof Row;
type Op = "=" | ">" | "<" | "!=" | ">=" | "<=" | "in" | "not-in";
type Cond = { id: string; field: Field; op: Op; value: string };

const NUM_FIELDS: Field[] = ["price","marketCapB","relVol","c1m","c1h","c1d","c1w","c1mth","c1y","cytd"];
const ENUM_FIELDS: Field[] = ["sector","symbol"];

export function ScreenerWidget() {
  const { activeTabId, activeTab, setGlobalSymbols } = useDashboardStore();
  const globalSymbols = activeTab()?.globalSymbols || [];
  const themeMode = useDashboardStore(s => s.theme.mode);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<Field | "">("");
  const [sortDir, setSortDir] = useState<0 | 1 | -1>(0);
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

  const fetchAll = async () => {
    setLoading(true);
    const out: Row[] = [];
    await Promise.all(TICKERS.map(async (sym) => {
      try {
        const [q, h1, h2, h3] = await Promise.all([
          fetch(`${API}/api/market/quote/${sym}`).then(r=>r.json()),
          fetch(`${API}/api/market/history/${sym}?timeframe=1Min&limit=390&latest=now`).then(r=>r.json()),
          fetch(`${API}/api/market/history/${sym}?timeframe=1Hour&limit=200&latest=now`).then(r=>r.json()),
          fetch(`${API}/api/market/history/${sym}?timeframe=1Day&limit=260&latest=now`).then(r=>r.json()),
        ]);
        const p = Number(q?.last_price || 0);
        const m1 = Array.isArray(h1?.b) ? h1.b : (Array.isArray(h1) ? h1 : []);
        const hh = Array.isArray(h2?.b) ? h2.b : (Array.isArray(h2) ? h2 : []);
        const dd = Array.isArray(h3?.b) ? h3.b : (Array.isArray(h3) ? h3 : []);
        const pct = (a:number,b:number)=> (a && b) ? ((a-b)/b)*100 : 0;
        const close = (arr:any[], idx:number)=> Number(arr[Math.max(0, arr.length-1-idx)]?.c ?? arr[Math.max(0, arr.length-1-idx)]?.close ?? 0);
        const volNow = m1.reduce((s:number,x:any)=>s+Number(x.v ?? x.volume ?? 0),0);
        const volAvg = dd.slice(-30).reduce((s:number,x:any)=>s+Number(x.v ?? x.volume ?? 0),0) / Math.max(1, dd.slice(-30).length);
        out.push({
          symbol: sym,
          price: p,
          sector: META[sym]?.sector || "Unknown",
          marketCapB: META[sym]?.marketCapB || 0,
          relVol: volAvg ? volNow / volAvg : 0,
          c1m: pct(p, close(m1, 1)),
          c1h: pct(p, close(hh, 1)),
          c1d: pct(p, close(dd, 1)),
          c1w: pct(p, close(dd, 5)),
          c1mth: pct(p, close(dd, 21)),
          c1y: pct(p, close(dd, 252)),
          cytd: pct(p, close(dd, Math.min(dd.length-1, new Date().getMonth()*21 + new Date().getDate()))),
        });
      } catch {}
    }));
    setRows(out);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, []);

  const sectors = useMemo(() => Array.from(new Set(rows.map(r=>r.sector))).sort(), [rows]);

  const matches = (r: Row, c: Cond) => {
    const raw = r[c.field] as any;
    if (ENUM_FIELDS.includes(c.field)) {
      const opts = c.value.split(",").map(x=>x.trim()).filter(Boolean);
      if (c.op === "in") return opts.includes(String(raw));
      if (c.op === "not-in") return !opts.includes(String(raw));
      if (c.op === "=") return String(raw) === c.value;
      if (c.op === "!=") return String(raw) !== c.value;
      return true;
    }
    const a = Number(raw);
    const b = Number(c.value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
    if (c.op === "=") return a === b;
    if (c.op === "!=") return a !== b;
    if (c.op === ">") return a > b;
    if (c.op === "<") return a < b;
    if (c.op === ">=") return a >= b;
    if (c.op === "<=") return a <= b;
    return true;
  };

  const filtered = useMemo(() => {
    let out = rows.filter(r => conds.every(c => matches(r, c)));
    if (!sortKey || sortDir === 0) {
      out = out.sort((a,b)=>b.c1d-a.c1d);
    } else {
      out = out.sort((a:any,b:any) => {
        if (a[sortKey] === b[sortKey]) return 0;
        return (a[sortKey] > b[sortKey] ? 1 : -1) * sortDir;
      });
    }
    return out;
  }, [rows, conds, sortKey, sortDir]);

  const pctCls = (v:number)=> v>=0 ? "text-bull" : "text-bear";

  const cycleSort = (k: Field) => {
    if (sortKey !== k) { setSortKey(k); setSortDir(1); return; }
    if (sortDir === 1) { setSortDir(-1); return; }
    if (sortDir === -1) { setSortKey(""); setSortDir(0); return; }
    setSortDir(1);
  };

  const toggleGlobalSymbol = (sym: string) => {
    if (globalSymbols.includes(sym)) {
      setGlobalSymbols(activeTabId, globalSymbols.filter(s => s !== sym));
    } else {
      setGlobalSymbols(activeTabId, [...globalSymbols, sym]);
    }
  };

  const rowBorder = themeMode === "dark" ? "border-neutral-800/80" : "border-surface-border/60";

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-1.5 border-b border-surface-border flex items-center gap-2 text-xs relative" ref={popRef}>
        <button onClick={() => setShowFilters(v=>!v)} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-surface-border hover:bg-surface-overlay">
          <FilterIcon size={12} /> Filters ({conds.length})
        </button>
        {showFilters && (
          <div className="absolute left-2 top-8 z-40 w-[420px] max-w-[90vw] rounded-lg border border-surface-border bg-surface-raised p-2 shadow-2xl space-y-2">
            {conds.map((c) => {
              const enumField = ENUM_FIELDS.includes(c.field);
              return (
                <div key={c.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
                  <select value={c.field} onChange={e=>setConds(prev=>prev.map(x=>x.id===c.id?{...x,field:e.target.value as Field,op:ENUM_FIELDS.includes(e.target.value as Field)?"=":x.op}:x))} className="bg-surface-overlay border border-surface-border rounded px-1 py-1">
                    {(["symbol","sector","marketCapB","price","relVol","c1m","c1h","c1d","c1w","c1mth","c1y","cytd"] as Field[]).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={c.op} onChange={e=>setConds(prev=>prev.map(x=>x.id===c.id?{...x,op:e.target.value as Op}:x))} className="bg-surface-overlay border border-surface-border rounded px-1 py-1">
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
                  <input value={c.value} onChange={e=>setConds(prev=>prev.map(x=>x.id===c.id?{...x,value:e.target.value}:x))} placeholder={enumField?"A,B,C":"value"} className="bg-surface-overlay border border-surface-border rounded px-2 py-1" />
                  <button onClick={()=>setConds(prev=>prev.filter(x=>x.id!==c.id))} className="p-1 rounded hover:bg-surface-overlay"><X size={12} /></button>
                </div>
              );
            })}
            <button onClick={()=>setConds(prev=>[...prev,{id:crypto.randomUUID(),field:"marketCapB",op:">",value:"0"}])} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-surface-border hover:bg-surface-overlay"><Plus size={12} /> Add condition</button>
            <div className="text-[10px] text-neutral-500">Sectors: {sectors.join(", ")}</div>
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
                  ["symbol","Ticker"],["price","Price"],["marketCapB","MCap"],["sector","Sector"],["relVol","RelVol"],
                  ["c1m","1m"],["c1h","1H"],["c1d","1D"],["c1w","1W"],["c1mth","1M"],["c1y","1Y"],["cytd","YTD"],
                ].map(([k,h]) => (
                  <th key={k} className="text-left px-2 py-1.5 cursor-pointer select-none" onClick={() => cycleSort(k as Field)}>
                    {h}{sortKey===k && (sortDir===1?" ↑":sortDir===-1?" ↓":"")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const selected = globalSymbols.includes(r.symbol);
                return (
                  <tr key={r.symbol} className={`border-b ${rowBorder} hover:bg-surface-overlay/60 ${selected ? "bg-accent/10" : ""}`}>
                    <td className="px-2 py-1.5 font-mono text-white">
                      <button onClick={() => toggleGlobalSymbol(r.symbol)} className="inline-flex items-center gap-2 hover:underline">
                        {META[r.symbol]?.domain && <img src={`https://logo.clearbit.com/${META[r.symbol].domain}`} alt="" className="w-4 h-4 rounded-full" onError={(e:any)=>{e.currentTarget.style.display='none';}} />}
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
