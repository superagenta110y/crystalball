"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Palette, ChevronDown, X } from "lucide-react";
import { useDashboardStore, type Timeframe, DEFAULT_THEME } from "@/lib/store/dashboardStore";

const TIMEFRAMES: Timeframe[] = ["1s","5s","1m","5m","15m","30m","1h","4h","1d","1w"];

const WIDGET_LIST = [
  { id: "chart",          label: "Chart" },
  { id: "orderflow",      label: "Order Flow" },
  { id: "openinterest",   label: "Open Interest" },
  { id: "openinterest3d", label: "3D OI" },
  { id: "gex",            label: "GEX" },
  { id: "dex",            label: "DEX" },
  { id: "newsfeed",       label: "News Feed" },
  { id: "bloomberg",      label: "Bloomberg TV" },
  { id: "ai",             label: "AI Assistant" },
  { id: "report",         label: "Market Report" },
];

const COLOR_FIELDS: { key: keyof typeof DEFAULT_THEME; label: string }[] = [
  { key: "bull",       label: "Bull / Calls" },
  { key: "bear",       label: "Bear / Puts" },
  { key: "accent",     label: "Accent" },
  { key: "background", label: "Background" },
  { key: "surface",    label: "Surface" },
  { key: "border",     label: "Border" },
];

export function Topbar() {
  const {
    symbol, setSymbol,
    timeframe, setTimeframe,
    theme, setTheme,
    activeTabId, activeTab, addWidget, removeWidget,
  } = useDashboardStore();

  const [input, setInput] = useState(symbol);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  // sync external symbol changes
  useEffect(() => setInput(symbol), [symbol]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAddWidget(false);
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setShowStyle(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) setSymbol(input.trim());
  };

  const tab = activeTab();
  const activeWidgets = tab?.activeWidgets ?? [];

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-surface-raised border-b border-surface-border shrink-0 h-12">

      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="CrystalBall" className="w-6 h-6" />
        <span className="font-bold text-white text-sm tracking-wide hidden sm:block">CrystalBall</span>
      </div>

      <div className="w-px h-5 bg-surface-border mx-1 hidden sm:block" />

      {/* Symbol */}
      <form onSubmit={handleSymbol} className="flex items-center gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="SPY"
          className="bg-surface-overlay border border-surface-border rounded-md px-2.5 py-1 text-sm font-mono w-20 focus:outline-none focus:border-accent/60 transition text-white"
        />
        <button
          type="submit"
          className="px-2.5 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-md text-xs font-semibold transition"
        >
          GO
        </button>
      </form>

      {/* Timeframe */}
      <div className="flex items-center gap-0.5 bg-surface-overlay border border-surface-border rounded-md px-1 py-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-2 py-0.5 rounded text-xs font-mono transition ${
              tf === timeframe
                ? "bg-accent/20 text-accent font-semibold"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <MarketStatus />

        {/* Add Widget */}
        <div ref={addRef} className="relative">
          <button
            onClick={() => { setShowAddWidget((v) => !v); setShowStyle(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-overlay hover:bg-surface-border border border-surface-border rounded-md text-xs text-neutral-300 hover:text-white transition"
          >
            <Plus size={13} /> Add Widget <ChevronDown size={11} className={`transition-transform ${showAddWidget ? "rotate-180" : ""}`} />
          </button>
          {showAddWidget && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Widgets</div>
              <div className="py-1 max-h-80 overflow-y-auto">
                {WIDGET_LIST.map(({ id, label }) => {
                  const active = activeWidgets.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (active) removeWidget(activeTabId, id);
                        else addWidget(activeTabId, id);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition hover:bg-surface-overlay ${active ? "text-accent" : "text-neutral-300"}`}
                    >
                      <span>{label}</span>
                      {active && (
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <X size={11} /> Remove
                        </span>
                      )}
                      {!active && <Plus size={13} className="text-neutral-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Style */}
        <div ref={styleRef} className="relative">
          <button
            onClick={() => { setShowStyle((v) => !v); setShowAddWidget(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-overlay hover:bg-surface-border border border-surface-border rounded-md text-xs text-neutral-300 hover:text-white transition"
          >
            <Palette size={13} /> Style
          </button>
          {showStyle && (
            <div className="absolute right-0 top-full mt-1 w-60 bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">
                Theme Colors
              </div>
              <div className="py-2 px-3 flex flex-col gap-2">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-600">{theme[key]}</span>
                      <input
                        type="color"
                        value={theme[key]}
                        onChange={(e) => setTheme({ [key]: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer border border-surface-border bg-transparent"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setTheme(DEFAULT_THEME)}
                  className="mt-1 w-full py-1.5 text-xs text-neutral-500 hover:text-white border border-surface-border rounded-lg transition"
                >
                  Reset to defaults
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MarketStatus() {
  const isOpen = isMarketOpen();
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
      isOpen ? "text-bull border-bull/30 bg-bull/10" : "text-neutral-500 border-surface-border"
    }`} style={{ color: isOpen ? "var(--bull)" : undefined }}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-bull animate-pulse" : "bg-neutral-600"}`} />
      {isOpen ? "Market Open" : "Market Closed"}
    </div>
  );
}

function isMarketOpen(): boolean {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = et.getDay(), m = et.getHours() * 60 + et.getMinutes();
  return d >= 1 && d <= 5 && m >= 570 && m < 960;
}
