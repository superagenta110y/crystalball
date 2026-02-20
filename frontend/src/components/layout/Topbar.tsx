"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Palette, ChevronDown, X, Settings } from "lucide-react";
import Link from "next/link";
import { useDashboardStore, type WidgetType, DEFAULT_THEME } from "@/lib/store/dashboardStore";

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

const COLOR_FIELDS: { key: keyof typeof DEFAULT_THEME; label: string }[] = [
  { key: "bull",       label: "Bull / Calls" },
  { key: "bear",       label: "Bear / Puts" },
  { key: "accent",     label: "Accent" },
  { key: "background", label: "Background" },
  { key: "surface",    label: "Surface" },
  { key: "border",     label: "Border" },
];

export function Topbar() {
  const { theme, setTheme, activeTabId, addWidget } = useDashboardStore();
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAddWidget(false);
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setShowStyle(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-surface-raised border-b border-surface-border shrink-0 h-12">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="CrystalBall" className="w-6 h-6" />
        <span className="font-bold text-white text-sm tracking-wide hidden sm:block">CrystalBall</span>
      </Link>

      <div className="w-px h-5 bg-surface-border mx-1 hidden sm:block" />

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
                    key={id}
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
            <div className="absolute right-0 top-full mt-1 w-60 bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Theme Colors</div>
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

        {/* Settings */}
        <Link
          href="/settings"
          className="p-1.5 rounded-md hover:bg-surface-overlay text-neutral-500 hover:text-white transition"
          title="Settings"
        >
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
