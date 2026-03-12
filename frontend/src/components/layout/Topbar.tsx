"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { Plus, Palette, Settings, MessageCircle, Moon, Sun, Monitor, X } from "lucide-react";

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

type Sparkle = { id: string; x: number; y: number; r: number; delay: number; dur: number; rot: number };

const LOGO_PATH_1 = "M0,0 L13,0 L45,3 L71,8 L93,14 L116,22 L122,24 L124,25 L143,35 L162,46 L178,57 L192,68 L207,81 L220,94 L229,105 L238,116 L249,132 L256,144 L258,146 L267,165 L277,190 L285,218 L289,237 L292,262 L293,289 L291,316 L287,342 L281,366 L274,387 L264,410 L253,431 L239,452 L230,464 L221,475 L214,482 L207,490 L192,504 L185,509 L181,510 L142,511 L142,512 L135,512 L135,511 L94,511 L91,512 L91,510 L42,511 L42,512 L31,512 L31,511 L-57,510 L-58,512 L-65,512 L-65,511 L-164,510 L-172,508 L-182,500 L-195,488 L-203,480 L-203,478 L-205,478 L-214,467 L-227,450 L-239,431 L-251,408 L-254,407 L-255,399 L-263,379 L-270,356 L-271,348 L-273,347 L-274,338 L-277,319 L-279,288 L-280,282 L-279,279 L-278,258 L-274,230 L-268,205 L-265,193 L-263,192 L-262,186 L-256,171 L-254,164 L-252,164 L-250,158 L-239,138 L-227,120 L-217,107 L-206,94 L-186,74 L-183,71 L-169,60 L-151,47 L-134,37 L-129,34 L-129,32 L-123,31 L-101,21 L-71,11 L-45,5 L-39,5 L-38,1 L-38,4 L-14,1 Z M62,66 L55,68 L48,76 L48,84 L51,89 L59,95 L75,103 L90,111 L95,114 L97,114 L101,118 L113,126 L127,137 L135,144 L147,155 L154,162 L165,176 L174,188 L185,206 L194,223 L202,243 L207,255 L212,260 L214,261 L222,261 L228,256 L230,252 L230,236 L225,211 L220,197 L219,194 L208,171 L206,168 L203,168 L204,165 L197,154 L186,140 L183,136 L181,136 L179,132 L160,113 L143,100 L125,88 L119,85 L104,77 L86,70 L82,69 L71,66 L64,66 L63,66 Z M-113,116 L-116,118 L-123,142 L-129,154 L-135,161 L-145,167 L-156,171 L-169,175 L-172,177 L-171,180 L-172,183 L-165,186 L-149,190 L-139,196 L-131,204 L-125,214 L-119,232 L-116,241 L-112,242 L-108,234 L-101,213 L-94,202 L-85,194 L-73,188 L-55,184 L-52,181 L-53,177 L-58,174 L-75,169 L-85,164 L-94,156 L-100,146 L-104,139 L-107,128 L-111,117 Z M204,166 Z M109,263 L106,268 L101,285 L94,298 L85,308 L73,315 L46,323 L44,325 L45,330 L68,338 L78,343 L88,352 L95,362 L100,374 L106,393 L109,397 L112,396 L117,381 L122,365 L127,355 L127,352 L131,350 L136,344 L150,336 L170,331 L172,329 L171,324 L160,320 L145,315 L135,308 L128,300 L122,290 L116,275 L113,265 L111,265 L111,263 Z M-141,317 L-144,321 L-149,335 L-155,344 L-161,351 L-167,353 L-177,356 L-186,359 L-187,362 L-186,365 L-175,369 L-165,373 L-155,382 L-149,394 L-145,407 L-143,410 L-138,409 L-136,405 L-135,400 L-130,386 L-124,378 L-124,376 L-120,374 L-112,370 L-100,366 L-97,362 L-98,359 L-101,358 L-102,358 L-105,356 L-111,354 L-120,349 L-127,342 L-132,333 L-134,329 L-136,320 L-138,317 Z M-253,404 L-252,406 Z";
const LOGO_PATH_2 = "M0,0 L8,1 L12,0 L13,2 L19,1 L25,1 L29,0 L29,2 L40,1 L43,0 L45,1 L60,2 L61,0 L61,2 L81,1 L83,0 L83,2 L98,2 L99,0 L101,0 L101,2 L121,1 L123,0 L123,2 L126,0 L131,0 L132,0 L133,2 L140,2 L141,0 L141,2 L146,2 L147,0 L149,1 L176,1 L180,0 L181,2 L183,0 L187,0 L187,2 L196,2 L197,0 L197,2 L208,1 L211,0 L211,2 L220,2 L221,0 L221,2 L227,1 L234,2 L235,0 L235,2 L248,1 L251,0 L251,2 L257,1 L259,0 L259,2 L272,1 L276,0 L277,2 L283,0 L285,0 L285,2 L288,0 L291,0 L291,2 L304,2 L311,6 L324,24 L336,41 L349,59 L362,77 L367,86 L369,100 L368,109 L361,115 L358,116 L-82,116 L-87,114 L-92,109 L-93,106 L-93,94 L-90,82 L-77,63 L-67,50 L-55,33 L-53,29 L-48,24 L-37,8 L-31,3 L-28,2 L-13,1 L0,1 Z M27,1 Z";

function CrystalBallLogo({ onReadyBurst }: { onReadyBurst?: (fn: () => void) => void }) {
  const maskId = useId().replace(/:/g, "-");
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [popping, setPopping] = useState(false);

  const burst = () => {
    const next: Sparkle[] = Array.from({ length: 8 }).map((_, i) => ({
      id: `${Date.now()}-${i}`,
      x: 120 + Math.random() * 780,
      y: 80 + Math.random() * 620,
      r: 14 + Math.random() * 22,
      delay: Math.random() * 0.28,
      dur: 0.6 + Math.random() * 0.5,
      rot: Math.random() * 180,
    }));
    setSparkles(next);
    setPopping(true);
    window.setTimeout(() => setSparkles([]), 1300);
    window.setTimeout(() => setPopping(false), 340);
  };

  useEffect(() => { onReadyBurst?.(burst); }, [onReadyBurst]);

  return (
    <svg
      viewBox="0 0 1024 1024"
      className={`logo-img w-6 h-6 ${popping ? "logo-pop" : ""}`}
      aria-label="CrystalBall"
      onClick={burst}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect x="0" y="0" width="1024" height="1024" fill="black" />
          <path d={LOGO_PATH_1} fill="white" transform="translate(515.3145751953125, 143.99996948242188)" />
          <path d={LOGO_PATH_2} fill="white" transform="translate(384.31451416015625, 672.6072998046875)" />
          {sparkles.map((s) => (
            <g key={s.id} transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}>
              <path d={`M 0 ${-s.r} L ${s.r * 0.34} ${-s.r * 0.34} L ${s.r} 0 L ${s.r * 0.34} ${s.r * 0.34} L 0 ${s.r} L ${-s.r * 0.34} ${s.r * 0.34} L ${-s.r} 0 L ${-s.r * 0.34} ${-s.r * 0.34} Z`} fill="black" style={{ animation: `logoSpark ${s.dur}s ease-out ${s.delay}s both` }} />
            </g>
          ))}
        </mask>
      </defs>
      <rect x="0" y="0" width="1024" height="1024" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

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
  const logoBurstRef = useRef<(() => void) | null>(null);

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
    const onOpenAdd = () => setShowAddWidget(true);
    window.addEventListener("topbar:add-widget", onOpenAdd as EventListener);
    return () => window.removeEventListener("topbar:add-widget", onOpenAdd as EventListener);
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
      <div className="flex items-center gap-2 shrink-0 select-none" role="button" aria-label="CrystalBall logo" onClick={() => logoBurstRef.current?.()}>
        <CrystalBallLogo onReadyBurst={(fn) => { logoBurstRef.current = fn; }} />
        <span className="font-bold text-white text-sm tracking-wide hidden sm:block">CrystalBall</span>
      </div>

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

          </button>
          {showAddWidget && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-surface-raised rounded-xl shadow-2xl z-50 overflow-hidden pop-in">
              <div className="block sm:hidden px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Add Widget</div>
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
              <div className="block sm:hidden px-3 py-2 text-xs text-neutral-500 uppercase tracking-widest border-b border-surface-border">Style</div>
              <div className="py-3 px-3 flex flex-col gap-4">
                <div className="relative flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Theme</span>
                  <button onClick={() => setShowThemeMenu(v=>!v)} className="inline-flex w-8 h-8 items-center justify-center rounded-full hover:bg-surface-overlay ml-auto">
                    {(() => { const cur = THEME_MODES.find(m => m.id === theme.mode) || THEME_MODES[0]; const Icon = cur.Icon; return <Icon size={15} />; })()}
                  </button>
                  {showThemeMenu && (
                    <div className="absolute right-[36px] top-0 z-20 h-8 rounded-full bg-surface-overlay shadow-xl p-0.5 pop-in flex items-center gap-0.5">
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

        <button id="topbar-settings-button" onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          window.dispatchEvent(new CustomEvent('settings:open', { detail: { anchor: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } } }));
        }} className="topbar-btn flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs text-neutral-500 sm:text-neutral-300 hover:text-white hover:bg-surface-overlay transition" title="Settings">
          <Settings size={13} />
          <span className="hidden sm:inline text-xs">Settings</span>
        </button>
        <button id="topbar-chat-button" onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          window.dispatchEvent(new CustomEvent('assistant:open', { detail: { anchor: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } } }));
        }} className="topbar-btn flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs text-neutral-500 sm:text-neutral-300 hover:text-white hover:bg-surface-overlay transition" title="Chat">
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
