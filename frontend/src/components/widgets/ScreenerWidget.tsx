"use client";

import React, { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const TICKERS = ["SPY","QQQ","IWM","AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AMD","NFLX","JPM","BAC","GS","XOM","CVX","UNH","PFE","PLTR","COIN","MSTR"];

const META: Record<string, { sector: string; marketCapB: number }> = {
  SPY:{sector:"ETF",marketCapB:500},QQQ:{sector:"ETF",marketCapB:300},IWM:{sector:"ETF",marketCapB:80},
  AAPL:{sector:"Technology",marketCapB:3200},MSFT:{sector:"Technology",marketCapB:3100},NVDA:{sector:"Technology",marketCapB:2800},
  AMZN:{sector:"Consumer",marketCapB:1900},GOOGL:{sector:"Technology",marketCapB:2200},META:{sector:"Technology",marketCapB:1600},TSLA:{sector:"Consumer",marketCapB:900},
  AMD:{sector:"Technology",marketCapB:350},NFLX:{sector:"Communication",marketCapB:250},JPM:{sector:"Financials",marketCapB:600},BAC:{sector:"Financials",marketCapB:350},GS:{sector:"Financials",marketCapB:150},
  XOM:{sector:"Energy",marketCapB:450},CVX:{sector:"Energy",marketCapB:300},UNH:{sector:"Healthcare",marketCapB:450},PFE:{sector:"Healthcare",marketCapB:160},PLTR:{sector:"Technology",marketCapB:70},COIN:{sector:"Financials",marketCapB:60},MSTR:{sector:"Technology",marketCapB:40}
};

type Row = {
  symbol: string; price: number; sector: string; marketCapB: number; relVol: number;
  c1m:number;c1h:number;c1d:number;c1w:number;c1mth:number;c1y:number;cytd:number;
};

export function ScreenerWidget() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [capMin, setCapMin] = useState("5");
  const [sector, setSector] = useState("all");
  const [chg1dMin, setChg1dMin] = useState("1");
  const [relVolMin, setRelVolMin] = useState("1.2");

  const fetchAll = async () => {
    setLoading(true);
    const out: Row[] = [];
    await Promise.all(TICKERS.map(async (sym) => {
      try {
        const [q, h1, h2, h3] = await Promise.all([
          fetch(`${API}/api/market/quote/${sym}`).then(r=>r.json()),
          fetch(`${API}/api/market/history/${sym}?timeframe=1Min&limit=390`).then(r=>r.json()),
          fetch(`${API}/api/market/history/${sym}?timeframe=1Hour&limit=200`).then(r=>r.json()),
          fetch(`${API}/api/market/history/${sym}?timeframe=1Day&limit=260`).then(r=>r.json()),
        ]);
        const p = Number(q?.last_price || 0);
        const m1 = Array.isArray(h1) ? h1 : [];
        const hh = Array.isArray(h2) ? h2 : [];
        const dd = Array.isArray(h3) ? h3 : [];
        const pct = (a:number,b:number)=> (a && b) ? ((a-b)/b)*100 : 0;
        const close = (arr:any[], idxFromEnd:number)=> Number(arr[Math.max(0, arr.length-1-idxFromEnd)]?.close || 0);
        const volNow = m1.reduce((s:number,x:any)=>s+Number(x.volume||0),0);
        const volAvg = dd.slice(-30).reduce((s:number,x:any)=>s+Number(x.volume||0),0) / Math.max(1, dd.slice(-30).length);
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

  const sectors = useMemo(() => ["all", ...Array.from(new Set(rows.map(r=>r.sector))).sort()], [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    r.marketCapB >= Number(capMin || 0) &&
    (sector === "all" || r.sector === sector) &&
    r.c1d >= Number(chg1dMin || 0) &&
    r.relVol >= Number(relVolMin || 0)
  ).sort((a,b)=>b.c1d-a.c1d), [rows, capMin, sector, chg1dMin, relVolMin]);

  const pctCls = (v:number)=> v>=0 ? "text-bull" : "text-bear";

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-1.5 border-b border-surface-border flex items-center gap-2 text-xs flex-wrap">
        <span className="text-neutral-500">Filters:</span>
        <label className="flex items-center gap-1">MCap &gt; <input value={capMin} onChange={e=>setCapMin(e.target.value)} className="w-12 bg-surface-overlay border border-surface-border rounded px-1 py-0.5" />B</label>
        <label className="flex items-center gap-1">Sector
          <select value={sector} onChange={e=>setSector(e.target.value)} className="bg-surface-overlay border border-surface-border rounded px-1 py-0.5">
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">1D% &gt; <input value={chg1dMin} onChange={e=>setChg1dMin(e.target.value)} className="w-12 bg-surface-overlay border border-surface-border rounded px-1 py-0.5" /></label>
        <label className="flex items-center gap-1">RelVol &gt; <input value={relVolMin} onChange={e=>setRelVolMin(e.target.value)} className="w-12 bg-surface-overlay border border-surface-border rounded px-1 py-0.5" /></label>
      </div>
      <div className="flex-1 overflow-auto text-xs">
        {loading && <div className="p-4 text-neutral-500 animate-pulse">Loading screener…</div>}
        {!loading && (
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 bg-surface-raised border-b border-surface-border">
              <tr className="text-neutral-500">
                {['Ticker','Price','MCap','Sector','RelVol','1m','1H','1D','1W','1M','1Y','YTD'].map(h => <th key={h} className="text-left px-2 py-1.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.symbol} className="border-b border-surface-border/60 hover:bg-surface-overlay/60">
                  <td className="px-2 py-1.5 font-mono text-white">{r.symbol}</td>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
