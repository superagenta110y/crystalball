"use client";

import React, { useEffect, useState } from "react";
import { SkeletonCards } from "./WidgetSkeletons";

interface NewsItem {
  id: string;
  headline: string;
  summary?: string;
  source?: string;
  url?: string;
  created_at?: string;
  symbols?: string[];
}

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

  const filterSymbol = (config?.symbol || config?.newsSymbol || "").toUpperCase();

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

  return (
    <div className="h-full w-full overflow-hidden flex flex-col relative">
      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-2">
        {loading && <SkeletonCards />}

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
