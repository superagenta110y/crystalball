"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  symbols: string[];
  createdAt: string;
  url: string;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

interface NewsFeedWidgetProps {
  globalSymbol?: string; // from global override (first entry); no per-widget input
}

export function NewsFeedWidget({ globalSymbol }: NewsFeedWidgetProps) {
  const symbol = globalSymbol || "SPY";
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch(`${API}/api/news?symbols=${symbol}&limit=20`);
      const data = await r.json();
      setNews(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-xs text-neutral-600 animate-pulse">Loading news…</div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-neutral-600">
      <span>Failed to load news</span>
      <button onClick={fetch_} className="flex items-center gap-1 text-neutral-500 hover:text-white transition"><RefreshCw size={11}/> Retry</button>
    </div>
  );

  if (!news.length) return (
    <div className="flex items-center justify-center h-full text-xs text-neutral-600">No news available</div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col divide-y divide-surface-border">
        {news.map((item) => (
          <article key={item.id} className="px-3 py-3 hover:bg-surface-overlay transition group">
            <div className="flex items-start justify-between gap-2">
              <a
                href={item.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-neutral-200 group-hover:text-white leading-snug line-clamp-2 flex-1"
              >
                {item.headline}
              </a>
              {item.url && <ExternalLink size={11} className="shrink-0 text-neutral-600 group-hover:text-neutral-400 mt-0.5" />}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-neutral-600 text-xs">{item.source}</span>
              {item.createdAt && <>
                <span className="text-neutral-700 text-xs">·</span>
                <span className="text-neutral-600 text-xs">{timeAgo(item.createdAt)}</span>
              </>}
              <div className="flex gap-1 ml-auto flex-wrap">
                {(item.symbols || []).slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      s === symbol ? "bg-accent/15 text-accent" : "bg-surface-border text-neutral-500"
                    }`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
