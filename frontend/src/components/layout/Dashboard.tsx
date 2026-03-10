"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Topbar } from "./Topbar";
import { WidgetWrapper } from "./WidgetWrapper";
import { TabBar } from "./TabBar";
import { AssistantFab } from "./AssistantFab";

import { OrderFlowWidget }     from "@/components/widgets/OrderFlowWidget";
import { OpenInterestWidget }  from "@/components/widgets/OpenInterestWidget";
import { OpenInterest3DWidget }from "@/components/widgets/OpenInterest3DWidget";
import { GEXWidget }           from "@/components/widgets/GEXWidget";
import { DEXWidget }           from "@/components/widgets/DEXWidget";
import { ChartWidget }         from "@/components/widgets/ChartWidget";
import { NewsFeedWidget }      from "@/components/widgets/NewsFeedWidget";
import { BloombergTVWidget }   from "@/components/widgets/BloombergTVWidget";

import { MarketReportWidget }  from "@/components/widgets/MarketReportWidget";
import { ScreenerWidget }      from "@/components/widgets/ScreenerWidget";

import { useDashboardStore, type WidgetInstance, type WidgetType } from "@/lib/store/dashboardStore";
import useWindowSize from "@/lib/hooks/useWindowSize";

const API = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Hex → "r, g, b" for CSS rgba() ──────────────────────────
function hexToRgbTriple(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function applyTheme(mode: string, accent: string, bull: string, bear: string) {
  const html = document.documentElement;
  const effective = mode === "auto"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : mode;
  html.setAttribute("data-theme", effective);
  html.style.setProperty("--accent", accent);
  html.style.setProperty("--accent-muted", `rgba(${hexToRgbTriple(accent)}, 0.2)`);
  // Dynamic bull/bear + RGB triples for opacity variants
  html.style.setProperty("--bull",      bull);
  html.style.setProperty("--bull-rgb",  hexToRgbTriple(bull));
  html.style.setProperty("--bear",      bear);
  html.style.setProperty("--bear-rgb",  hexToRgbTriple(bear));
  // Remove chart grid lines in both themes
  html.style.setProperty("--grid-line", "transparent");
  // Text colours for charts
  html.style.setProperty("--chart-text", effective === "light" ? "#6b7280" : "#8b8fa8");
}

// ─── Widget renderer ─────────────────────────────────────────────────────────

type WRP = { instance: WidgetInstance; resolvedSymbol: string; isGlobalOverride: boolean; onConfigChange: (p: Record<string,string>) => void };

function renderWidget({ instance, resolvedSymbol, isGlobalOverride, onConfigChange }: WRP) {
  const { type, config } = instance;
  switch (type) {
    case "chart":        return <ChartWidget symbol={resolvedSymbol} timeframe={config.timeframe} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "orderflow":    return <OrderFlowWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "openinterest": return <OpenInterestWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "openinterest3d":return <OpenInterest3DWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "gex":          return <GEXWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "dex":          return <DEXWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "newsfeed":     return <NewsFeedWidget globalSymbol={resolvedSymbol} config={config} onConfigChange={onConfigChange} />;
    case "bloomberg":    return <BloombergTVWidget />;
    case "ai":           return <div className="p-3 text-xs text-neutral-500">AI Assistant moved to the bottom-right assistant button.</div>;
    case "report":       return <MarketReportWidget symbol={resolvedSymbol} />;
    case "screener":     return <ScreenerWidget />;
    default:             return <div className="p-4 text-xs text-neutral-600">Unknown: {type}</div>;
  }
}

// Mobile widget type groups
const MAIN_TYPES: WidgetType[] = ["chart"];
const SUB_TYPES:  WidgetType[] = ["gex","dex","openinterest","openinterest3d","orderflow","newsfeed","bloomberg","report","screener"];

// ─── Mobile swipe layout ─────────────────────────────────────────────────────

function MobileLayout({ widgets, resolvedSymbols, isGlobalOverride, activeTabId }: {
  widgets: WidgetInstance[];
  resolvedSymbols: Record<string,string>;
  isGlobalOverride: boolean;
  activeTabId: string;
}) {
  const { removeWidget, updateWidgetConfig } = useDashboardStore();

  const mains = widgets.filter(w => MAIN_TYPES.includes(w.type));
  const subs  = widgets.filter(w => SUB_TYPES.includes(w.type));

  const renderRow = (group: WidgetInstance[], heightClass: string) => (
    <div
      className={`flex overflow-x-auto snap-x snap-mandatory ${heightClass}`}
      style={{ scrollbarWidth: "none" }}
    >
      {group.map(instance => (
        <div
          key={instance.id}
          className="snap-start shrink-0 w-full h-full p-1"
        >
          <div className="h-full rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            {renderWidget({
              instance,
              resolvedSymbol: resolvedSymbols[instance.id] ?? "SPY",
              isGlobalOverride,
              onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
            })}
          </div>
        </div>
      ))}
      {group.length === 0 && (
        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-700">
          No widgets
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Swipe indicator dots */}
      {renderRow(mains, "h-1/2")}
      <div className="shrink-0 h-px bg-surface-border" />
      {renderRow(subs, "h-1/2")}
    </div>
  );
}

// ─── Desktop viewport-fit grid ───────────────────────────────────────────────

const TOPBAR_H  = 48; // h-12
const TABBAR_H  = 34;
const MARGIN    = 6;  // gap between cells
const PADDING   = 6;  // container padding

type SnapZone = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;

function computeRowHeight(windowH: number, layout: Layout[]): number {
  if (!layout.length) return 30;
  const maxRow = layout.reduce((m, l) => Math.max(m, l.y + l.h), 1);
  const available = windowH - TOPBAR_H - TABBAR_H - PADDING * 2 - MARGIN * (maxRow + 1);
  return Math.max(6, Math.floor(available / maxRow));
}

// ─── Main dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { activeTabId, setActiveTab, activeTab, updateLayout, removeWidget, updateWidgetConfig, resolveSymbol, theme, setTheme } = useDashboardStore();
  const { width, height } = useWindowSize();
  const tab      = activeTab();
  const layout   = tab?.layout ?? [];
  const widgets  = tab?.widgets ?? [];
  const isMobile = (width ?? 0) < 768;
  const [zoomedWidgetId, setZoomedWidgetId] = useState<string | null>(null);

  // Hydrate tab/zoom from URL
  useEffect(() => {
    const u = new URL(window.location.href);
    const tabQ = u.searchParams.get("tab");
    const zoomQ = u.searchParams.get("zoomed");
    if (tabQ) setActiveTab(tabQ);
    if (zoomQ) setZoomedWidgetId(zoomQ);
  }, [setActiveTab]);

  // Apply theme to <html> element whenever it changes
  useEffect(() => {
    applyTheme(theme.mode, theme.accent, theme.bull, theme.bear);
    // Also listen for system preference changes when in auto mode
    if (theme.mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("auto", theme.accent, theme.bull, theme.bear);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme.mode, theme.accent, theme.bull, theme.bear]);

  // Load persisted UI theme from backend once
  const themeHydratedRef = useRef(false);
  useEffect(() => {
    fetch(`${API}/api/settings/ui-theme`)
      .then(r => r.json())
      .then((t) => {
        if (t && typeof t === "object") {
          setTheme({ mode: t.mode, accent: t.accent, bull: t.bull, bear: t.bear });
        }
      })
      .finally(() => { themeHydratedRef.current = true; });
  }, [setTheme]);

  // Persist theme to backend (debounced)
  useEffect(() => {
    if (!themeHydratedRef.current) return;
    const t = setTimeout(() => {
      fetch(`${API}/api/settings/ui-theme`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [theme]);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!height) return updateLayout(activeTabId, newLayout);
      const availablePx = Math.max(120, height - TOPBAR_H - TABBAR_H - PADDING * 2);
      const minRowPx = 6;
      const maxRowsAllowed = Math.max(4, Math.floor((availablePx - MARGIN) / (minRowPx + MARGIN)));
      const fixed = newLayout.map(it => ({ ...it }));
      for (const it of fixed) {
        if (it.h > maxRowsAllowed) it.h = maxRowsAllowed;
        if (it.y + it.h > maxRowsAllowed) it.y = Math.max(0, maxRowsAllowed - it.h);
      }
      updateLayout(activeTabId, fixed);
    },
    [activeTabId, updateLayout, height]
  );

  const [snapZone, setSnapZone] = useState<SnapZone>(null);
  const lastZoneRef = useRef<SnapZone>(null);

  const detectSnapZone = useCallback((x: number, y: number, w: number, h: number, prev: SnapZone): SnapZone => {
    const edge = 70;
    const corner = 110;
    const grace = prev ? 24 : 0; // hysteresis/leeway before dropping zone
    const nearLeft = x <= (edge + grace);
    const nearRight = x >= (w - edge - grace);
    const nearTop = y <= (edge + grace);
    const nearBottom = y >= (h - edge - grace);
    if (x <= (corner + grace) && y <= (corner + grace)) return "top-left";
    if (x >= (w - corner - grace) && y <= (corner + grace)) return "top-right";
    if (x <= (corner + grace) && y >= (h - corner - grace)) return "bottom-left";
    if (x >= (w - corner - grace) && y >= (h - corner - grace)) return "bottom-right";
    if (nearLeft) return "left";
    if (nearRight) return "right";
    if (nearTop) return "top";
    if (nearBottom) return "bottom";
    return null;
  }, []);

  const handleDrag = useCallback((_layout: Layout[], _oldItem: Layout, _newItem: Layout, _placeholder: Layout, e: MouseEvent) => {
    if (!width || !height) return;
    const zone = detectSnapZone(
      e.clientX,
      e.clientY - (TOPBAR_H + TABBAR_H),
      width,
      Math.max(200, height - TOPBAR_H - TABBAR_H),
      lastZoneRef.current
    );
    lastZoneRef.current = zone;
    setSnapZone(zone);
  }, [width, height, detectSnapZone]);

  const handleDragStop = useCallback((newLayout: Layout[], _oldItem: Layout, newItem: Layout) => {
    const l = newLayout.map(it => ({ ...it }));
    const idx = l.findIndex(it => it.i === newItem.i);
    if (idx < 0) return updateLayout(activeTabId, newLayout);

    const availablePx = Math.max(120, (height ?? 900) - TOPBAR_H - TABBAR_H - PADDING * 2);
    const minRowPx = 6;
    const maxRowsAllowed = Math.max(6, Math.floor((availablePx - MARGIN) / (minRowPx + MARGIN)));
    const halfH = Math.max(3, Math.floor(maxRowsAllowed / 2));

    if (snapZone) {
      if (snapZone === "left")      { l[idx].x = 0; l[idx].y = 0; l[idx].w = 6; l[idx].h = maxRowsAllowed; }
      if (snapZone === "right")     { l[idx].x = 6; l[idx].y = 0; l[idx].w = 6; l[idx].h = maxRowsAllowed; }
      if (snapZone === "top")       { l[idx].x = 0; l[idx].y = 0; l[idx].w = 12; l[idx].h = halfH; }
      if (snapZone === "bottom")    { l[idx].x = 0; l[idx].y = maxRowsAllowed - halfH; l[idx].w = 12; l[idx].h = halfH; }
      if (snapZone === "top-left")  { l[idx].x = 0; l[idx].y = 0; l[idx].w = 6; l[idx].h = halfH; }
      if (snapZone === "top-right") { l[idx].x = 6; l[idx].y = 0; l[idx].w = 6; l[idx].h = halfH; }
      if (snapZone === "bottom-left")  { l[idx].x = 0; l[idx].y = maxRowsAllowed - halfH; l[idx].w = 6; l[idx].h = halfH; }
      if (snapZone === "bottom-right") { l[idx].x = 6; l[idx].y = maxRowsAllowed - halfH; l[idx].w = 6; l[idx].h = halfH; }

      const freeRects: Array<{x:number;y:number;w:number;h:number}> = [];
      if (snapZone === "left") freeRects.push({ x: 6, y: 0, w: 6, h: maxRowsAllowed });
      if (snapZone === "right") freeRects.push({ x: 0, y: 0, w: 6, h: maxRowsAllowed });
      if (snapZone === "top") freeRects.push({ x: 0, y: halfH, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      if (snapZone === "bottom") freeRects.push({ x: 0, y: 0, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      if (snapZone === "top-left") {
        freeRects.push({ x: 6, y: 0, w: 6, h: halfH });
        freeRects.push({ x: 0, y: halfH, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }
      if (snapZone === "top-right") {
        freeRects.push({ x: 0, y: 0, w: 6, h: halfH });
        freeRects.push({ x: 0, y: halfH, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }
      if (snapZone === "bottom-left") {
        freeRects.push({ x: 6, y: maxRowsAllowed - halfH, w: 6, h: halfH });
        freeRects.push({ x: 0, y: 0, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }
      if (snapZone === "bottom-right") {
        freeRects.push({ x: 0, y: maxRowsAllowed - halfH, w: 6, h: halfH });
        freeRects.push({ x: 0, y: 0, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }

      const others = l.filter((_, i) => i !== idx);
      const totalArea = freeRects.reduce((s, r) => s + (r.w * r.h), 0) || 1;
      let start = 0;
      for (let ri = 0; ri < freeRects.length; ri++) {
        const fr = freeRects[ri];
        const remaining = others.length - start;
        if (remaining <= 0) break;
        const rawTake = Math.round((fr.w * fr.h / totalArea) * others.length);
        const take = Math.max(ri === freeRects.length - 1 ? remaining : 1, Math.min(remaining, rawTake || 1));
        const chunk = others.slice(start, start + take);
        start += take;

        const n = chunk.length;
        const aspect = fr.w / Math.max(1, fr.h);
        const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * aspect))));
        const rows = Math.max(1, Math.ceil(n / cols));
        const cellW = Math.max(2, Math.floor(fr.w / cols));
        const cellH = Math.max(3, Math.floor(fr.h / rows));

        chunk.forEach((it, i2) => {
          const c = i2 % cols;
          const r = Math.floor(i2 / cols);
          it.x = fr.x + c * cellW;
          it.y = fr.y + r * cellH;
          it.w = (c === cols - 1) ? Math.max(2, fr.x + fr.w - it.x) : cellW;
          it.h = (r === rows - 1) ? Math.max(3, fr.y + fr.h - it.y) : cellH;
        });
      }
    } else {
      // no anchor zone: keep dragged widget size/position from drop, only clamp to viewport rows
      const t = l[idx];
      if (t.y + t.h > maxRowsAllowed) t.y = Math.max(0, maxRowsAllowed - t.h);
    }

    // final safety clamp (nothing offscreen)
    for (const it of l) {
      if (it.h > maxRowsAllowed) it.h = maxRowsAllowed;
      if (it.y < 0) it.y = 0;
      if (it.y + it.h > maxRowsAllowed) it.y = Math.max(0, maxRowsAllowed - it.h);
      if (it.x < 0) it.x = 0;
      if (it.x + it.w > 12) it.x = Math.max(0, 12 - it.w);
    }

    lastZoneRef.current = null;
    setSnapZone(null);
    updateLayout(activeTabId, l);
  }, [activeTabId, updateLayout, snapZone, height]);

  const handleResizeStop = useCallback((newLayout: Layout[], oldItem: Layout, newItem: Layout) => {
    const l = newLayout.map(it => ({ ...it }));
    const idx = l.findIndex(it => it.i === newItem.i);
    if (idx < 0) return updateLayout(activeTabId, newLayout);

    const item = l[idx];
    const oldRight = oldItem.x + oldItem.w;
    const newRight = item.x + item.w;
    const dx = newRight - oldRight;
    const oldBottom = oldItem.y + oldItem.h;
    const newBottom = item.y + item.h;
    const dy = newBottom - oldBottom;

    const overlapY = (a: Layout, b: Layout) => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const overlapX = (a: Layout, b: Layout) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));

    // Propagate right-edge connection: any widget connected to resized right edge moves with it.
    if (dx !== 0) {
      const moved = new Set<string>();
      const queue: string[] = [];

      // seed: directly connected to resized widget right edge
      for (const it of l) {
        if (it.i === item.i) continue;
        if (it.x === oldRight && overlapY(it, oldItem) > 0) {
          queue.push(it.i);
          moved.add(it.i);
        }
      }

      while (queue.length) {
        const id = queue.shift()!;
        const cur = l.find(x => x.i === id);
        if (!cur) continue;
        const curRight = cur.x + cur.w;
        for (const nxt of l) {
          if (nxt.i === item.i || moved.has(nxt.i)) continue;
          if (nxt.x === curRight && overlapY(nxt, cur) > 0) {
            moved.add(nxt.i);
            queue.push(nxt.i);
          }
        }
      }

      for (const it of l) {
        if (moved.has(it.i)) it.x += dx;
      }
    }

    // Propagate bottom-edge connection similarly for vertical resize.
    if (dy !== 0) {
      const moved = new Set<string>();
      const queue: string[] = [];
      for (const it of l) {
        if (it.i === item.i) continue;
        if (it.y === oldBottom && overlapX(it, oldItem) > 0) {
          queue.push(it.i);
          moved.add(it.i);
        }
      }
      while (queue.length) {
        const id = queue.shift()!;
        const cur = l.find(x => x.i === id);
        if (!cur) continue;
        const curBottom = cur.y + cur.h;
        for (const nxt of l) {
          if (nxt.i === item.i || moved.has(nxt.i)) continue;
          if (nxt.y === curBottom && overlapX(nxt, cur) > 0) {
            moved.add(nxt.i);
            queue.push(nxt.i);
          }
        }
      }
      for (const it of l) {
        if (moved.has(it.i)) it.y += dy;
      }
    }

    // Clamp to dashboard bounds to avoid off-screen placement.
    for (const it of l) {
      if (it.x < 0) it.x = 0;
      if (it.w < 2) it.w = 2;
      if (it.x + it.w > 12) it.x = Math.max(0, 12 - it.w);
      if (it.y < 0) it.y = 0;
      if (it.h < 3) it.h = 3;
    }

    updateLayout(activeTabId, l);
  }, [activeTabId, updateLayout]);

  const isGlobalOverride = (tab?.globalSymbols?.length ?? 0) > 0;

  const resolvedSymbols = useMemo(
    () => Object.fromEntries(widgets.map(w => [w.id, resolveSymbol(activeTabId, w.id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTabId, widgets, tab?.globalSymbols]
  );

  // Dynamic row height so grid always fits viewport (no scroll)
  const rowHeight = useMemo(
    () => computeRowHeight(height ?? 900, layout),
    [height, layout]
  );

  useEffect(() => {
    if (zoomedWidgetId && !widgets.some(w => w.id === zoomedWidgetId)) {
      setZoomedWidgetId(null);
    }
  }, [zoomedWidgetId, widgets]);

  // Sync URL with active tab + zoomed widget
  useEffect(() => {
    const u = new URL(window.location.href);
    if (activeTabId) u.searchParams.set("tab", activeTabId);
    else u.searchParams.delete("tab");
    if (zoomedWidgetId) u.searchParams.set("zoomed", zoomedWidgetId);
    else u.searchParams.delete("zoomed");
    const q = u.searchParams.toString();
    window.history.replaceState({}, "", q ? `${u.pathname}?${q}` : u.pathname);
  }, [activeTabId, zoomedWidgetId]);

  const gridWidth = Math.max(width ?? 1200, 400);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <Topbar />
      <TabBar />

      {widgets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-500">
          <svg width="96" height="96" viewBox="0 0 96 96" className="opacity-90">
            <defs>
              <radialGradient id="cbGlow" cx="50%" cy="42%" r="58%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
              </radialGradient>
            </defs>
            <circle cx="48" cy="48" r="28" fill="url(#cbGlow)" stroke="var(--accent)" strokeOpacity="0.45"/>
            <path d="M24 72h48" stroke="currentColor" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round"/>
            <path d="M32 76h32" stroke="currentColor" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round"/>
          </svg>
          <p className="text-sm">Click <strong className="text-neutral-300">[+Add Widget]</strong> or <button className="text-accent underline" onClick={() => window.dispatchEvent(new Event('assistant:open'))}>[Use AI]</button> to build your dashboard.</p>
        </div>
      ) : isMobile ? (
        <MobileLayout
          widgets={widgets}
          resolvedSymbols={resolvedSymbols}
          isGlobalOverride={isGlobalOverride}
          activeTabId={activeTabId}
        />
      ) : (
        <main className="flex-1 overflow-hidden">
          {zoomedWidgetId ? (
            <div className="h-full p-2">
              {widgets.filter(w => w.id === zoomedWidgetId).map(instance => (
                <div key={instance.id} className="h-full rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                  <WidgetWrapper
                    instance={instance}
                    onRemove={() => removeWidget(activeTabId, instance.id)}
                    onToggleZoom={() => setZoomedWidgetId(null)}
                    isZoomed
                  >
                    {renderWidget({
                      instance,
                      resolvedSymbol: resolvedSymbols[instance.id] ?? "SPY",
                      isGlobalOverride,
                      onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
                    })}
                  </WidgetWrapper>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative h-full">
              {snapZone && (
                <div className={`absolute z-40 pointer-events-none border-2 border-accent bg-accent/35 rounded-xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)] backdrop-blur-[1px] transition-all duration-150
                  ${snapZone === "left" ? "left-0 top-0 h-full w-1/2" : ""}
                  ${snapZone === "right" ? "right-0 top-0 h-full w-1/2" : ""}
                  ${snapZone === "top" ? "left-0 top-0 w-full h-1/2" : ""}
                  ${snapZone === "bottom" ? "left-0 bottom-0 w-full h-1/2" : ""}
                  ${snapZone === "top-left" ? "left-0 top-0 w-1/2 h-1/2" : ""}
                  ${snapZone === "top-right" ? "right-0 top-0 w-1/2 h-1/2" : ""}
                  ${snapZone === "bottom-left" ? "left-0 bottom-0 w-1/2 h-1/2" : ""}
                  ${snapZone === "bottom-right" ? "right-0 bottom-0 w-1/2 h-1/2" : ""}
                `} />
              )}
              <GridLayout
                className="layout"
                layout={layout}
                cols={12}
                rowHeight={rowHeight}
                width={gridWidth}
                onLayoutChange={handleLayoutChange}
                onDrag={handleDrag as any}
                onDragStop={handleDragStop}
                onResizeStop={handleResizeStop as any}
                draggableHandle=".widget-drag-handle"
                margin={[MARGIN, MARGIN]}
                containerPadding={[PADDING, PADDING]}
                compactType="vertical"
                preventCollision={false}
                isDraggable
                isResizable
              >
                {widgets.map(instance => (
                  <div key={instance.id} className="widget">
                    <WidgetWrapper
                      instance={instance}
                      onRemove={() => removeWidget(activeTabId, instance.id)}
                      onToggleZoom={() => setZoomedWidgetId(instance.id)}
                      isZoomed={false}
                    >
                      {renderWidget({
                        instance,
                        resolvedSymbol: resolvedSymbols[instance.id] ?? "SPY",
                        isGlobalOverride,
                        onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
                      })}
                    </WidgetWrapper>
                  </div>
                ))}
              </GridLayout>
            </div>
          )}
        </main>
      )}
      <AssistantFab />
    </div>
  );
}
