"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Palette, ChevronDown, Settings, MessageCircle, Moon, Sun, Monitor, X } from "lucide-react";
import Link from "next/link";

import { useDashboardStore, type WidgetType, type ThemeMode, DEFAULT_THEME } from "@/lib/store/dashboardStore";
import { AppColorPicker } from "@/components/ui/AppColorPicker";

const API = process.env.NEXT_PUBLIC_API_URL || "";

const WIDGET_LIST: { id: WidgetType; label: string }[] = [
  { id: "chart",          label: "Chart" },
  { id: "orderflow",      label: "Order Flow" },
  { id: "openinterest",   label: "Open Interest" },
  { id: "openinterest3d", label: "OI Grid" },
  { id: "gex",            label: "Gamma Exposure" },
  { id: "dex",            label: "Delta Exposure" },
  { id: "newsfeed",       label: "News Feed" },
  { id: "optionsladder",  label: "Options Ladder" },
  { id: "screener",       label: "Screener" },
];

const THEME_MODES: { id: ThemeMode; Icon: React.ElementType }[] = [
  { id: "dark",  Icon: Moon    },
  { id: "light", Icon: Sun     },
  { id: "auto",  Icon: Monitor },
];


export function Topbar() {
  const { theme, setTheme, activeTabId, addWidget, activeTab, setGlobalSymbols } = useDashboardStore();
  const tab = activeTab();

  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const COMMON_SYMBOLS = ["SPY","QQQ","IWM","AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL"];

  const addRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const overrideRef = useRef<HTMLDivElement>(null);

  const globalSymbols = tab?.globalSymbols ?? [];
  const hasOverride = globalSymbols.length > 0;

  useEffect(() => {
    setDraft("");
    setSuggestions([]);
    setShowSuggestions(false);
  }, [activeTabId, tab?.globalSymbols]);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("crystalball-recent-symbols") || "[]");
      if (Array.isArray(r)) setRecentSymbols(r.slice(0, 12));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAddWidget(false);
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) { setShowStyle(false); setShowThemeMenu(false); }
      if (overrideRef.current && !overrideRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const q = draft.trim().toUpperCase();
    if (!q) {
      const base = recentSymbols.length ? recentSymbols : COMMON_SYMBOLS;
      setSuggestions(base.filter(s => !globalSymbols.includes(s)).slice(0, 8));
      return;
    }
    const t = setTimeout(() => {
      fetch(`${API}/api/market/symbols?q=${encodeURIComponent(q)}&limit=12`)
        .then(r => r.json())
        .then(d => {
          const syms = (d?.symbols || []) as string[];
          setSuggestions(syms.filter(s => !globalSymbols.includes(s)));
        })
        .catch(() => setSuggestions([]));
    }, 120);
    return () => clearTimeout(t);
  }, [draft, activeTabId, globalSymbols.join(","), recentSymbols.join(",")]);

  const addSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    if (!globalSymbols.includes(s)) setGlobalSymbols(activeTabId, [...globalSymbols, s]);
    setDraft("");
    setShowSuggestions(false);
    const next = [s, ...recentSymbols.filter(x => x !== s)].slice(0, 12);
    setRecentSymbols(next);
    try { localStorage.setItem("crystalball-recent-symbols", JSON.stringify(next)); } catch {}
  };

  const removeSymbol = (sym: string) => {
    setGlobalSymbols(activeTabId, globalSymbols.filter(x => x !== sym));
  };


  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-surface-raised border-b border-surface-border shrink-0 h-12">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <img src="/logo.svg" alt="CrystalBall" className="logo-img w-6 h-6" />
        <span className="font-bold text-white text-sm tracking-wide hidden sm:block">CrystalBall</span>
      </Link>

      <div className="w-px h-5 bg-surface-border hidden sm:block" />

      {/* Global symbol override */}
      <div ref={overrideRef} className="relative w-auto">
        <div className={`cb-input min-h-8 inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-transparent transition ${hasOverride ? "border-accent/70" : "border-neutral-500/70"}`}>
          {globalSymbols.map(sym => (
            <span key={sym} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-neutral-700/35 text-neutral-200">
              {sym}
              <button onClick={() => removeSymbol(sym)} className="opacity-70 hover:opacity-100"><X size={10} /></button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value.toUpperCase()); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions.length) addSymbol(suggestions[0]);
                else if (draft.trim()) addSymbol(draft);
              }
              if (e.key === "Backspace" && !draft && globalSymbols.length) {
                removeSymbol(globalSymbols[globalSymbols.length - 1]);
              }
            }}
            placeholder={globalSymbols.length ? "Add" : "SPY"}
            className="w-12 sm:w-16 bg-transparent outline-none text-xs font-mono text-white placeholder-neutral-500 hover:bg-surface-overlay/40 rounded px-1"
          />
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-36 bg-surface-raised rounded-md shadow-xl max-h-56 overflow-y-auto pop-in">
            {suggestions.map(s => (
              <button key={s} onClick={() => addSymbol(s)} className="w-full text-left px-2.5 py-1.5 text-xs font-mono text-neutral-300 hover:text-white hover:bg-surface-overlay">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <MarketStatus />

        <div ref={addRef} className="relative">
          <button
            onClick={() => { setShowAddWidget((v) => !v); setShowStyle(false); }}
            className="topbar-btn flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs text-neutral-500 sm:text-neutral-300 hover:text-white hover:bg-surface-overlay transition"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add Widget</span>
            <ChevronDown size={11} className={`hidden sm:inline transition-transform ${showAddWidget ? "rotate-180" : ""}`} />
          </button>
          {showAddWidget && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-raised rounded-xl shadow-2xl z-50 overflow-hidden pop-in">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Add Widget</div>
              <div className="py-1 max-h-80 overflow-y-auto">
                {WIDGET_LIST.map(({ id, label }) => (
                  <button key={`${id}-add`} onClick={() => { addWidget(activeTabId, id); setShowAddWidget(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-surface-overlay transition">
                    <span>{label}</span><Plus size={13} className="text-neutral-600" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div ref={styleRef} className="relative">
          <button
            onClick={() => { setShowStyle((v) => !v); setShowAddWidget(false); }}
            className="topbar-btn flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs text-neutral-500 sm:text-neutral-300 hover:text-white hover:bg-surface-overlay transition"
          >
            <Palette size={13} />
            <span className="hidden sm:inline">Style</span>
          </button>
          {showStyle && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-surface-raised rounded-xl shadow-2xl z-50 overflow-visible pop-in">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Style</div>
              <div className="py-3 px-3 flex flex-col gap-4">
                <div className="relative flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Theme</span>
                  <button onClick={() => setShowThemeMenu(v=>!v)} className="inline-flex w-8 h-8 items-center justify-center rounded-full hover:bg-surface-overlay ml-auto">
                    {(() => { const cur = THEME_MODES.find(m => m.id === theme.mode) || THEME_MODES[0]; const Icon = cur.Icon; return <Icon size={15} />; })()}
                  </button>
                  {showThemeMenu && (
                    <div className="absolute right-0 top-[34px] z-20 w-8 rounded-full bg-surface-overlay shadow-xl p-0.5 pop-in">
                      {THEME_MODES.filter(m => m.id !== theme.mode).map(({ id, Icon }) => (
                        <button key={id} onClick={() => { setTheme({ mode: id }); setShowThemeMenu(false); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-border text-neutral-300 hover:text-white">
                          <Icon size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-neutral-400">Accent</span></div>
                  <AppColorPicker value={theme.accent} onChange={(v) => setTheme({ accent: v })} swatchClassName="w-8 h-8" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-neutral-400">Bull</span></div>
                  <AppColorPicker value={theme.bull} onChange={(v) => setTheme({ bull: v })} swatchClassName="w-8 h-8" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-neutral-400">Bear</span></div>
                  <AppColorPicker value={theme.bear} onChange={(v) => setTheme({ bear: v })} swatchClassName="w-8 h-8" />
                </div>

                <button onClick={() => setTheme(DEFAULT_THEME)} className="w-full py-1.5 text-xs text-neutral-500 hover:text-white hover:bg-surface-overlay rounded-lg transition">Reset</button>
              </div>
            </div>
          )}
        </div>

        <button onClick={() => window.dispatchEvent(new Event('settings:open'))} className="p-1.5 rounded-md hover:bg-surface-overlay [color:var(--text-primary)] transition inline-flex items-center gap-1.5" title="Settings">
          <Settings size={15} />
          <span className="hidden sm:inline text-xs">Settings</span>
        </button>
        <button id="topbar-chat-button" onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          window.dispatchEvent(new CustomEvent('assistant:open', { detail: { anchor: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } } }));
        }} className="p-1.5 rounded-md hover:bg-surface-overlay [color:var(--text-primary)] transition inline-flex items-center gap-1.5" title="Chat">
          <MessageCircle size={15} />
          <span className="hidden sm:inline text-xs">Chat</span>
        </button>
      </div>
    </header>
  );
}

type MarketSession = "premarket" | "open" | "postmarket" | "closed";
function getMarketSession(): MarketSession {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const min = et.getHours() * 60 + et.getMinutes();
  if (day < 1 || day > 5) return "closed";
  if (min >= 240 && min < 570) return "premarket";
  if (min >= 570 && min < 960) return "open";
  if (min >= 960 && min < 1200) return "postmarket";
  return "closed";
}

const SESSION_CONFIG: Record<MarketSession, { label: string; dot: string; ring: string; text: string }> = {
  open:       { label: "Open",       dot: "bg-bull animate-pulse", ring: "border-bull/30 bg-bull/10", text: "text-bull" },
  premarket:  { label: "Pre-market", dot: "bg-blue-400 animate-pulse", ring: "border-blue-400/30 bg-blue-400/10", text: "text-blue-400" },
  postmarket: { label: "Post-market",dot: "bg-blue-400 animate-pulse", ring: "border-blue-400/30 bg-blue-400/10", text: "text-blue-400" },
  closed:     { label: "Closed",     dot: "bg-neutral-600", ring: "border-surface-border", text: "text-neutral-500" },
};

function MarketStatus() {
  const session = getMarketSession();
  const cfg = SESSION_CONFIG[session];
  return <div className={`flex items-center gap-1.5 text-xs sm:px-2 sm:py-1 sm:rounded-full sm:border ${cfg.ring} ${cfg.text}`}><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} /><span className="hidden sm:inline">{cfg.label}</span></div>;
}
