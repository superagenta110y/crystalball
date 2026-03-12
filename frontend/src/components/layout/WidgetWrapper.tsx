"use client";
import React from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "";
import { X, GripHorizontal, Maximize2, Minimize2, Filter } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";
import type { WidgetInstance } from "@/lib/store/dashboardStore";

const WIDGET_LABELS: Record<string, { full: string; mobile: string }> = {
  chart:          { full: "Chart", mobile: "Chart" },
  orderflow:      { full: "Order Flow", mobile: "Flow" },
  openinterest:   { full: "Open Interest", mobile: "OI" },
  openinterest3d: { full: "OI Grid", mobile: "Grid" },
  gex:            { full: "GEX", mobile: "GEX" },
  dex:            { full: "DEX", mobile: "DEX" },
  newsfeed:       { full: "News Feed", mobile: "News" },
  optionsladder:  { full: "Options Ladder", mobile: "Ladder" },
  ai:             { full: "AI Assistant", mobile: "AI" },
  screener:       { full: "Screener", mobile: "Scan" },
};

interface WidgetWrapperProps {
  instance: WidgetInstance;
  onRemove: () => void;
  onToggleZoom?: () => void;
  onRetileProminent?: () => void;
  isZoomed?: boolean;
  children: React.ReactNode;
}

export function WidgetWrapper({ instance, onRemove, onToggleZoom, onRetileProminent, isZoomed, children }: WidgetWrapperProps) {
  const label = WIDGET_LABELS[instance.type] ?? { full: instance.type, mobile: instance.type.slice(0, 5) };
  const { activeTabId, updateWidgetConfig } = useDashboardStore();
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [newsDraft, setNewsDraft] = React.useState("");
  const [newsOpen, setNewsOpen] = React.useState(false);
  const [newsItems, setNewsItems] = React.useState<Array<{ symbol: string; name?: string }>>([]);
  const newsRef = React.useRef<HTMLDivElement>(null);
  const newsSymbols = React.useMemo(() => (instance.config.symbol || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean), [instance.config.symbol]);
  const inlineHeaderTypes = new Set(["chart", "gex", "dex", "openinterest", "openinterest3d", "orderflow"]);
  const isChart = instance.type === "chart";
  const useInlineHeader = inlineHeaderTypes.has(instance.type);
  const canZoom = true;

  React.useEffect(() => {
    if (instance.type !== "newsfeed") return;
    const q = newsDraft.trim();
    if (!q) { setNewsItems([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/market/symbols?q=${encodeURIComponent(q)}&limit=8`)
        .then(r => r.json())
        .then(d => setNewsItems(Array.isArray(d?.items) ? d.items : []))
        .catch(() => setNewsItems([]));
    }, 120);
    return () => clearTimeout(t);
  }, [instance.type, newsDraft]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (newsRef.current && !newsRef.current.contains(e.target as Node)) setNewsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div
      className="flex flex-col h-full group/widget"
      onDoubleClickCapture={(e) => {
        const t = e.target as HTMLElement;
        if (t?.closest?.('.widget-drag-handle')) onRetileProminent?.();
      }}
    >
      {!useInlineHeader && (
        <div className="widget-header widget-drag-handle cursor-grab active:cursor-grabbing select-none" onDoubleClick={() => onRetileProminent?.()}>
          <div className="flex items-center gap-1.5 text-xs leading-none">
            <GripHorizontal size={11} className="opacity-30" />
            <span className="hidden sm:inline">{label.full}</span><span className="sm:hidden">{label.mobile}</span>
            {instance.type === "newsfeed" && (
              <div ref={newsRef} className="relative inline-flex items-center gap-1" onMouseDown={(e)=>e.stopPropagation()}>
                {newsSymbols.map(sym => (
                  <span key={sym} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-neutral-700/35 text-neutral-200">
                    {sym}
                    <button onClick={() => updateWidgetConfig(activeTabId, instance.id, { symbol: newsSymbols.filter(s => s !== sym).join(",") })} className="opacity-70 hover:opacity-100"><X size={9} /></button>
                  </span>
                ))}
                <input
                  value={newsDraft}
                  onChange={(e) => { setNewsDraft(e.target.value.toUpperCase()); setNewsOpen(true); }}
                  onFocus={() => setNewsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const s = (newsItems[0]?.symbol || newsDraft).trim().toUpperCase();
                      if (!s) return;
                      const next = Array.from(new Set([...newsSymbols, s]));
                      updateWidgetConfig(activeTabId, instance.id, { symbol: next.join(",") });
                      setNewsDraft("");
                      setNewsOpen(false);
                    }
                  }}
                  placeholder={newsSymbols.length ? "Add" : "All"}
                  className="cb-input bg-transparent border border-neutral-500/70 rounded px-2 py-0.5 text-[11px] font-mono w-14 hover:bg-surface-overlay/40"
                />
                {newsOpen && newsItems.length > 0 && (
                  <div className="absolute left-0 top-6 z-50 w-48 rounded bg-surface-raised shadow-xl p-1 pop-in">
                    {newsItems.map(it => (
                      <button key={it.symbol} onClick={() => {
                        const next = Array.from(new Set([...newsSymbols, it.symbol]));
                        updateWidgetConfig(activeTabId, instance.id, { symbol: next.join(",") });
                        setNewsDraft("");
                        setNewsOpen(false);
                      }} className="w-full text-left px-2 py-1 rounded text-xs hover:bg-surface-overlay">
                        <div className="font-mono">{it.symbol}</div>
                        <div className="text-[10px] text-neutral-500 truncate">{it.name || ""}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {instance.type === "screener" && (
              <button onMouseDown={(e) => e.stopPropagation()} onClick={() => window.dispatchEvent(new Event("screener:toggle-filters"))} className="opacity-100 md:opacity-0 md:group-hover/widget:opacity-100 transition p-1 rounded hover:bg-surface-overlay" title="Filters"><Filter size={12} /></button>
            )}
            {instance.config.symbol && (
              <span className="text-neutral-600 font-mono">{instance.config.symbol}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canZoom && <button onMouseDown={(e) => e.stopPropagation()} onClick={onToggleZoom} className="opacity-100 md:opacity-0 md:group-hover/widget:opacity-100 transition inline-flex items-center justify-center h-6 w-6 rounded hover:bg-surface-overlay" aria-label={isZoomed ? "Zoom out" : "Zoom in"} title={isZoomed ? "Zoom out" : "Zoom in"}>{isZoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>}
            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setConfirmRemove(true)} className="opacity-100 md:opacity-0 md:group-hover/widget:opacity-100 transition inline-flex items-center justify-center h-6 w-6 rounded hover:bg-surface-overlay hover:text-red-400" aria-label="Remove widget"><X size={13} /></button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {useInlineHeader && (
          <div className="absolute top-1 right-1 z-30 flex items-center gap-1">
            {canZoom && <button onMouseDown={(e) => e.stopPropagation()} onClick={onToggleZoom} className="opacity-100 md:opacity-0 md:group-hover/widget:opacity-100 transition inline-flex items-center justify-center h-6 w-6 rounded hover:bg-surface-overlay" aria-label={isZoomed ? "Zoom out" : "Zoom in"}>{isZoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>}
            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setConfirmRemove(true)} className="opacity-100 md:opacity-0 md:group-hover/widget:opacity-100 transition inline-flex items-center justify-center h-6 w-6 rounded hover:bg-surface-overlay hover:text-red-400" aria-label="Remove widget"><X size={13} /></button>
          </div>
        )}
        {children}
      </div>

      {confirmRemove && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-raised p-4 shadow-2xl">
            <div className="text-sm text-white mb-3">Are you sure you want to remove this widget from the page?</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRemove(false)} className="px-3 py-1.5 text-xs rounded border border-surface-border hover:bg-surface-overlay">Cancel</button>
              <button onClick={() => { setConfirmRemove(false); onRemove(); }} className="px-3 py-1.5 text-xs rounded border border-red-500/40 text-red-300 hover:bg-red-500/10">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
