/**
 * NewsFeedWidget — Real-time market news via Alpaca News API.
 * Connects to /api/ws/news WebSocket for live headlines.
 *
 * TODO:
 *   - Wire up WebSocket connection via useAlpacaNews hook
 *   - Add symbol filter (news for active symbol only)
 *   - Sentiment tag (positive/negative/neutral) via AI
 *   - Clickable headlines → open in new tab
 */
"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  symbols: string[];
  createdAt: string;
  url: string;
}

// Placeholder data
const MOCK_NEWS: NewsItem[] = [
  {
    id: "1",
    headline: "Fed signals patience on rate cuts as inflation persists",
    summary: "Federal Reserve officials reiterated a cautious stance on monetary policy easing.",
    source: "Reuters",
    symbols: ["SPY", "QQQ", "TLT"],
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    url: "#",
  },
  {
    id: "2",
    headline: "SPY options volume surges ahead of CPI report",
    summary: "Unusual options activity detected in SPY with large put sweeps on 520 strike.",
    source: "Market Wire",
    symbols: ["SPY"],
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    url: "#",
  },
  {
    id: "3",
    headline: "NVDA breaks above key resistance at $900",
    summary: "NVIDIA shares extended gains following analyst upgrades and strong AI demand outlook.",
    source: "Bloomberg",
    symbols: ["NVDA", "QQQ"],
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    url: "#",
  },
  {
    id: "4",
    headline: "Treasury yields ease as bond market reprices rate path",
    summary: "10-year Treasury yield fell 5bps to 4.35% as traders reassessed the FOMC outlook.",
    source: "WSJ",
    symbols: ["TLT", "SPY"],
    createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    url: "#",
  },
];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

interface NewsFeedWidgetProps {
  symbol?: string;
}

export function NewsFeedWidget({ symbol = "SPY" }: NewsFeedWidgetProps) {
  const [news] = useState<NewsItem[]>(MOCK_NEWS);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col divide-y divide-surface-border">
        {news.map((item) => (
          <article key={item.id} className="px-3 py-3 hover:bg-surface-overlay transition group">
            <div className="flex items-start justify-between gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-neutral-200 group-hover:text-white leading-snug line-clamp-2 flex-1"
              >
                {item.headline}
              </a>
              <ExternalLink size={11} className="shrink-0 text-neutral-600 group-hover:text-neutral-400 mt-0.5" />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-neutral-600 text-xs">{item.source}</span>
              <span className="text-neutral-700 text-xs">·</span>
              <span className="text-neutral-600 text-xs">{timeAgo(item.createdAt)}</span>
              <div className="flex gap-1 ml-auto">
                {item.symbols.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      s === symbol
                        ? "bg-accent/15 text-accent"
                        : "bg-surface-border text-neutral-500"
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
