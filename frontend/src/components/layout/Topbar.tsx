"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Palette, ChevronDown, Settings, Moon, Sun, Monitor } from "lucide-react";
import Link from "next/link";
import { useDashboardStore, type WidgetType, type ThemeMode, DEFAULT_THEME } from "@/lib/store/dashboardStore";

const WIDGET_LIST: { id: WidgetType; label: string }[] = [
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

const THEME_MODES: { id: ThemeMode; label: string; Icon: React.ElementType }[] = [
  { id: "dark",  label: "Dark",  Icon: Moon    },
  { id: "light", label: "Light", Icon: Sun     },
  { id: "auto",  label: "Auto",  Icon: Monitor },
];

export function Topbar() {
  const { theme, setTheme, activeTabId, addWidget, activeTab, setGlobalSymbols } = useDashboardStore();
  const tab = activeTab();

  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [symbolInput, setSymbolInput] = useState("");
  const addRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  // Sync local input with tab's globalSymbols when switching tabs
  useEffect(() => {
    setSymbolInput((tab?.globalSymbols ?? []).join(", "));
  }, [activeTabId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAddWidget(false);
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setShowStyle(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSymbolChange = (raw: string) => {
    setSymbolInput(raw);
    const symbols = raw
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    setGlobalSymbols(activeTabId, symbols);
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-surface-raised border-b border-surface-border shrink-0 h-12">
      {/* Logo + Name */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="CrystalBall" className="w-6 h-6" />
        <span className="font-bold text-white text-sm tracking-wide hidden sm:block">CrystalBall</span>
      </Link>

      <div className="w-px h-5 bg-surface-border hidden sm:block" />

      {/* Global symbol override input */}
      <div className="flex items-center gap-1.5">
        <input
          value={symbolInput}
          onChange={(e) => handleSymbolChange(e.target.value)}
          placeholder="SPY, QQQ…"
          title="Global symbol override — comma-separated. Widgets use position order."
          className="bg-surface-overlay border border-surface-border rounded-md px-2.5 py-1 text-xs font-mono w-36 focus:outline-none focus:border-accent/60 text-white placeholder-neutral-700 transition"
        />
        {(tab?.globalSymbols?.length ?? 0) > 0 && (
          <button
            onClick={() => { setSymbolInput(""); setGlobalSymbols(activeTabId, []); }}
            className="text-neutral-600 hover:text-white text-xs transition"
            title="Clear global override"
          >✕</button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <MarketStatus />

        {/* Add Widget */}
        <div ref={addRef} className="relative">
          <button
            onClick={() => { setShowAddWidget((v) => !v); setShowStyle(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-overlay hover:bg-surface-border border border-surface-border rounded-md text-xs text-neutral-300 hover:text-white transition"
          >
            <Plus size={13} /> Add Widget
            <ChevronDown size={11} className={`transition-transform ${showAddWidget ? "rotate-180" : ""}`} />
          </button>
          {showAddWidget && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Add Widget</div>
              <div className="py-1 max-h-80 overflow-y-auto">
                {WIDGET_LIST.map(({ id, label }) => (
                  <button
                    key={`${id}-add`}
                    onClick={() => { addWidget(activeTabId, id); setShowAddWidget(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-surface-overlay transition"
                  >
                    <span>{label}</span>
                    <Plus size={13} className="text-neutral-600" />
                  </button>
                ))}
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
            <div className="absolute right-0 top-full mt-1 w-56 bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Style</div>
              <div className="py-3 px-3 flex flex-col gap-4">

                {/* Theme mode */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-neutral-500">Theme</span>
                  <div className="flex gap-1.5">
                    {THEME_MODES.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        onClick={() => setTheme({ mode: id })}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs transition ${
                          theme.mode === id
                            ? "border-accent/60 bg-accent/10 text-accent"
                            : "border-surface-border text-neutral-500 hover:text-white hover:border-neutral-500"
                        }`}
                      >
                        <Icon size={14} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bull color */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-neutral-400">Bull / Calls</span>
                    <span className="text-xs font-mono text-neutral-600">{theme.bull}</span>
                  </div>
                  <label className="relative cursor-pointer">
                    <span
                      className="block w-8 h-8 rounded-full border-2 border-surface-border shadow-inner cursor-pointer"
                      style={{ background: theme.bull }}
                    />
                    <input
                      type="color"
                      value={theme.bull}
                      onChange={e => setTheme({ bull: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>

                {/* Bear color */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-neutral-400">Bear / Puts</span>
                    <span className="text-xs font-mono text-neutral-600">{theme.bear}</span>
                  </div>
                  <label className="relative cursor-pointer">
                    <span
                      className="block w-8 h-8 rounded-full border-2 border-surface-border shadow-inner cursor-pointer"
                      style={{ background: theme.bear }}
                    />
                    <input
                      type="color"
                      value={theme.bear}
                      onChange={e => setTheme({ bear: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>

                <button
                  onClick={() => setTheme(DEFAULT_THEME)}
                  className="w-full py-1.5 text-xs text-neutral-500 hover:text-white border border-surface-border rounded-lg transition"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <Link href="/settings" className="p-1.5 rounded-md hover:bg-surface-overlay text-neutral-500 hover:text-white transition" title="Settings">
          <Settings size={15} />
        </Link>
      </div>
    </header>
  );
}

function MarketStatus() {
  const isOpen = isMarketOpen();
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
      isOpen ? "border-bull/30 bg-bull/10" : "text-neutral-500 border-surface-border"
    }`} style={{ color: isOpen ? "var(--bull)" : undefined }}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "animate-pulse" : "bg-neutral-600"}`}
        style={{ background: isOpen ? "var(--bull)" : undefined }} />
      {isOpen ? "Market Open" : "Market Closed"}
    </div>
  );
}

function isMarketOpen(): boolean {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const d = et.getDay(), m = et.getHours() * 60 + et.getMinutes();
  return d >= 1 && d <= 5 && m >= 570 && m < 960;
}
