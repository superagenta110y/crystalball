"use client";

import React, { useEffect, useRef, useState } from "react";

interface NewsItem {
  id: string;
  headline: string;
  summary?: string;
  source?: string;
  url?: string;
  created_at?: string;
  symbols?: string[];
}

type SymbolItem = { symbol: string; name?: string };

interface NewsFeedWidgetProps {
  globalSymbol?: string;
  config?: Record<string, string>;
  onConfigChange?: (patch: Record<string, string>) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL || "";

export function NewsFeedWidget({ globalSymbol = "SPY", config, onConfigChange }: NewsFeedWidgetProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterSymbol, setFilterSymbol] = useState((config?.newsSymbol || "").toUpperCase());
  const [draft, setDraft] = useState((config?.newsSymbol || "").toUpperCase());
  const [symItems, setSymItems] = useState<SymbolItem[]>([]);
  const [symOpen, setSymOpen] = useState(false);
  const symRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = (config?.newsSymbol || "").toUpperCase();
    setFilterSymbol(s);
    setDraft(s);
  }, [config?.newsSymbol]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (symRef.current && !symRef.current.contains(e.target as Node)) setSymOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = draft.trim();
    if (!q) { setSymItems([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/market/symbols?q=${encodeURIComponent(q)}&limit=10`)
        .then(r => r.json())
        .then(d => setSymItems(d?.items || []))
        .catch(() => setSymItems([]));
    }, 100);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // If filter is empty, return all news (existing backend behavior).
        const symbol = filterSymbol.trim();
        const qs = symbol ? `?symbols=${encodeURIComponent(symbol)}&limit=20` : `?limit=20`;
        const res = await fetch(`${API}/api/news${qs}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as NewsItem[];
        if (!cancel) setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancel) {
          setItems([]);
          setError(e?.message || "Failed to load news");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();

    const t = setInterval(load, 30_000);
    return () => { cancel = true; clearInterval(t); };
  }, [filterSymbol, globalSymbol]);

  const selectSymbol = (s: string) => {
    const v = s.toUpperCase();
    setDraft(v);
    setFilterSymbol(v);
    onConfigChange?.({ newsSymbol: v });
    setSymOpen(false);
  };

  const clearFilter = () => {
    setDraft("");
    setFilterSymbol("");
    onConfigChange?.({ newsSymbol: "" });
  };

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <div className="px-2 py-1.5 border-b border-surface-border text-xs flex items-center gap-2">
        <span className="text-neutral-500 uppercase tracking-wide">News</span>
        <div ref={symRef} className="relative">
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value.toUpperCase()); setSymOpen(true); }}
            onFocus={() => setSymOpen(true)}
            placeholder="All symbols"
            className="bg-surface-overlay border border-surface-border rounded px-2 py-0.5 text-xs font-mono w-24"
          />
          {symOpen && symItems.length > 0 && (
            <div className="absolute left-0 top-6 z-50 w-56 rounded-md border border-surface-border bg-surface-raised shadow-xl max-h-64 overflow-auto">
              {symItems.map((it) => (
                <button key={it.symbol} onClick={() => selectSymbol(it.symbol)} className="w-full text-left px-2 py-1.5 hover:bg-surface-overlay">
                  <div className="text-xs font-mono text-white">{it.symbol}</div>
                  <div className="text-[10px] text-neutral-500 truncate">{it.name || ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        {filterSymbol && <button onClick={clearFilter} className="text-neutral-500 hover:text-white">✕</button>}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-2">
        {loading && (
          <div className="text-xs text-neutral-600 animate-pulse">Loading news…</div>
        )}

        {!loading && error && (
          <div className="text-xs text-bear">{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-xs text-neutral-600">No news found.</div>
        )}

        {!loading && !error && items.map((n) => (
          <article key={n.id} className="rounded-md border border-surface-border bg-surface-overlay/40 p-2">
            <a href={n.url} target="_blank" rel="noreferrer" className="text-sm text-white hover:underline">
              {n.headline}
            </a>
            {n.summary && <p className="text-xs text-neutral-400 mt-1 line-clamp-3">{n.summary}</p>}
            <div className="text-[10px] text-neutral-500 mt-1 flex items-center gap-2">
              {n.source && <span>{n.source}</span>}
              {n.created_at && <span>{new Date(n.created_at).toLocaleString()}</span>}
              {n.symbols?.length ? <span className="font-mono">{n.symbols.join(",")}</span> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
