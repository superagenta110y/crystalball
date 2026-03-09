"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Palette, ChevronDown, Settings, Moon, Sun, Monitor, X } from "lucide-react";
import Link from "next/link";
import { useDashboardStore, type WidgetType, type ThemeMode, DEFAULT_THEME } from "@/lib/store/dashboardStore";

const API = process.env.NEXT_PUBLIC_API_URL || "";

const WIDGET_LIST: { id: WidgetType; label: string }[] = [
  { id: "chart",          label: "Chart" },
  { id: "orderflow",      label: "Order Flow" },
  { id: "openinterest",   label: "Open Interest" },
  { id: "openinterest3d", label: "3D OI" },
  { id: "gex",            label: "GEX" },
  { id: "dex",            label: "DEX" },
  { id: "newsfeed",       label: "News Feed" },
  { id: "bloomberg",      label: "Bloomberg TV" },
  { id: "report",         label: "Market Report" },
  { id: "screener",       label: "Screener" },
];

const THEME_MODES: { id: ThemeMode; label: string; Icon: React.ElementType }[] = [
  { id: "dark",  label: "Dark",  Icon: Moon    },
  { id: "light", label: "Light", Icon: Sun     },
  { id: "auto",  label: "Auto",  Icon: Monitor },
];

const PRESET_COLORS = ["#60a5fa","#f59e0b","#22d3ee","#a78bfa","#e879f9","#ef4444","#10b981","#3b82f6","#f97316","#14b8a6","#84cc16","#f43f5e","#8b5cf6","#64748b","#ffffff"];

function hslToHex(h: number, s = 100, l = 50) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ColorRingPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ringRef = useRef<HTMLDivElement>(null);
  const setFromMouse = (e: MouseEvent) => {
    if (!ringRef.current) return;
    const r = ringRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    const x = e.clientX - cx; const y = e.clientY - cy;
    const ang = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    onChange(hslToHex(ang));
  };
  return (
    <div
      ref={ringRef}
      onMouseDown={(e) => {
        setFromMouse(e.nativeEvent);
        const mv = (ev: MouseEvent) => setFromMouse(ev);
        const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", mv);
        window.addEventListener("mouseup", up);
      }}
      className="relative w-28 h-28 rounded-full cursor-crosshair"
      style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
    >
      <div className="absolute inset-[18px] rounded-full bg-surface-raised border border-surface-border flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border border-surface-border" style={{ background: value }} />
      </div>
    </div>
  );
}

function AppColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCustomOpen(false); }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" onClick={() => setOpen(v => !v)} className="block w-8 h-8 rounded-full border-2 border-surface-border shadow-inner" style={{ background: value }} />
      {open && !customOpen && (
        <div className="absolute right-0 top-9 z-50 rounded-lg border border-surface-border bg-surface-raised/95 backdrop-blur px-2.5 py-2.5 shadow-2xl">
          <div className="grid grid-cols-4 gap-2 min-w-[96px]">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); }} className={`w-5 h-5 rounded-full border-2 ${value.toLowerCase() === c.toLowerCase() ? "border-white ring-1 ring-white/40" : "border-surface-border"}`} style={{ background: c }} />
            ))}
            <button type="button" onClick={() => setCustomOpen(true)} className="w-5 h-5 rounded-full border-2 border-surface-border bg-gradient-to-br from-red-400 via-emerald-400 to-blue-500" title="Custom" />
          </div>
        </div>
      )}
      {open && customOpen && (
        <div className="absolute right-0 top-9 z-50 rounded-lg border border-surface-border bg-surface-raised/95 backdrop-blur px-3 py-3 shadow-2xl">
          <ColorRingPicker value={value} onChange={(v) => { onChange(v); setOpen(false); setCustomOpen(false); }} />
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { theme, setTheme, activeTabId, addWidget, activeTab, setGlobalSymbols } = useDashboardStore();
  const tab = activeTab();

  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showStyle, setShowStyle] = useState(false);

  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const overrideRef = useRef<HTMLDivElement>(null);

  const globalSymbols = tab?.globalSymbols ?? [];
  const hasOverride = globalSymbols.length > 0;

  useEffect(() => {
    setDraft("");
    setSuggestions([]);
    setShowSuggestions(false);
  }, [activeTabId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAddWidget(false);
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setShowStyle(false);
      if (overrideRef.current && !overrideRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const q = draft.trim().toUpperCase();
    if (!q) {
      setSuggestions([]);
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
  }, [draft, activeTabId, globalSymbols.join(",")]);

  const addSymbol = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    if (globalSymbols.includes(s)) return;
    setGlobalSymbols(activeTabId, [...globalSymbols, s]);
    setDraft("");
    setShowSuggestions(false);
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

      {/* Global symbol override chips + autocomplete */}
      <div ref={overrideRef} className="relative min-w-[230px] max-w-[420px] w-[34vw]">
        <div
          className={`min-h-[28px] flex items-center gap-1 flex-wrap px-2 py-1 rounded-md border bg-surface-overlay transition ${
            hasOverride
              ? "border-accent/70 shadow-[0_0_0_1px_rgba(0,212,170,0.25)]"
              : "border-surface-border"
          }`}
        >
          {globalSymbols.map(sym => (
            <span key={sym} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono ${hasOverride ? "bg-accent/15 text-accent border border-accent/30" : "bg-surface-border text-neutral-300"}`}>
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
            placeholder={globalSymbols.length ? "Add symbol…" : "SPY, QQQ…"}
            className="flex-1 min-w-[90px] bg-transparent outline-none text-xs font-mono text-white placeholder-neutral-700"
          />
          {hasOverride && (
            <button onClick={() => setGlobalSymbols(activeTabId, [])} className="text-neutral-500 hover:text-white text-xs" title="Clear all overrides">✕</button>
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-surface-raised border border-surface-border rounded-md shadow-xl max-h-56 overflow-y-auto">
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
            className="topbar-btn flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 sm:bg-surface-overlay sm:hover:bg-surface-border sm:border sm:border-surface-border rounded-md text-xs text-neutral-500 sm:text-neutral-300 hover:text-white transition"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add Widget</span>
            <ChevronDown size={11} className={`hidden sm:inline transition-transform ${showAddWidget ? "rotate-180" : ""}`} />
          </button>
          {showAddWidget && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
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
            className="topbar-btn flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 sm:bg-surface-overlay sm:hover:bg-surface-border sm:border sm:border-surface-border rounded-md text-xs text-neutral-500 sm:text-neutral-300 hover:text-white transition"
          >
            <Palette size={13} />
            <span className="hidden sm:inline">Style</span>
          </button>
          {showStyle && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Style</div>
              <div className="py-3 px-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-neutral-500">Theme</span>
                  <div className="flex gap-1.5">
                    {THEME_MODES.map(({ id, label, Icon }) => (
                      <button key={id} onClick={() => setTheme({ mode: id })} className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs transition ${theme.mode === id ? "border-accent/60 bg-accent/10 text-accent" : "border-surface-border text-neutral-500 hover:text-white hover:border-neutral-500"}`}>
                        <Icon size={14} /><span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-neutral-400">Accent</span><span className="text-xs font-mono text-neutral-600">{theme.accent}</span></div>
                  <AppColorPicker value={theme.accent} onChange={(v) => setTheme({ accent: v })} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-neutral-400">Bull / Calls</span><span className="text-xs font-mono text-neutral-600">{theme.bull}</span></div>
                  <AppColorPicker value={theme.bull} onChange={(v) => setTheme({ bull: v })} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-xs text-neutral-400">Bear / Puts</span><span className="text-xs font-mono text-neutral-600">{theme.bear}</span></div>
                  <AppColorPicker value={theme.bear} onChange={(v) => setTheme({ bear: v })} />
                </div>

                <button onClick={() => setTheme(DEFAULT_THEME)} className="w-full py-1.5 text-xs text-neutral-500 hover:text-white border border-surface-border rounded-lg transition">Reset</button>
              </div>
            </div>
          )}
        </div>

        <Link href="/settings" className="p-1.5 rounded-md hover:bg-surface-overlay text-neutral-500 hover:text-white transition" title="Settings">
          <Settings size={15} />
        </Link>
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
