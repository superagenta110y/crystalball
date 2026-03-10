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

function computeRowHeight(windowH: number, layout: Layout[]): number {
  if (!layout.length) return 30;
  const maxRow = layout.reduce((m, l) => Math.max(m, l.y + l.h), 1);
  const available = windowH - TOPBAR_H - TABBAR_H - PADDING * 2 - MARGIN * (maxRow + 1);
  return Math.max(10, Math.floor(available / maxRow));
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
    (newLayout: Layout[]) => updateLayout(activeTabId, newLayout),
    [activeTabId, updateLayout]
  );

  const handleDrag = useCallback((layout: Layout[], oldItem: Layout, newItem: Layout, _placeholder: Layout, e: MouseEvent) => {
    // If dragging a full-width widget and pointer moves far left/right, snap to half during drag.
    if (oldItem.w === 12 && newItem.w === 12 && width) {
      const leftThreshold = width * 0.275;
      const rightThreshold = width * 0.725;
      if (e.clientX <= leftThreshold) {
        newItem.w = 6; newItem.x = 0;
      } else if (e.clientX >= rightThreshold) {
        newItem.w = 6; newItem.x = 6;
      }
    }

    // If dragged into another widget's horizontal space, prepare a 1:1 split live.
    const target = layout.find(it => it.i !== newItem.i && (
      Math.max(it.y, newItem.y) < Math.min(it.y + it.h, newItem.y + newItem.h)
    ) && (
      Math.max(it.x, newItem.x) < Math.min(it.x + it.w, newItem.x + newItem.w)
    ));

    if (target) {
      const splitW = Math.max(2, Math.floor(target.w / 2));
      const leftX = target.x;
      const rightX = target.x + splitW;
      const draggedLeft = (newItem.x + newItem.w / 2) < (target.x + target.w / 2);

      newItem.y = target.y;
      newItem.h = target.h;
      newItem.w = splitW;
      newItem.x = draggedLeft ? leftX : rightX;

      target.w = splitW;
      target.x = draggedLeft ? rightX : leftX;
    }
  }, [width]);

  const handleDragStop = useCallback((newLayout: Layout[], oldItem: Layout, newItem: Layout) => {
    const l = newLayout.map(it => ({ ...it }));
    const idx = l.findIndex(it => it.i === newItem.i);
    if (idx < 0) return updateLayout(activeTabId, newLayout);

    const topSnap = newItem.y <= 1;
    if (topSnap) {
      const center = newItem.x + newItem.w / 2;
      if (center >= 4 && center <= 8) {
        l[idx].x = 0; l[idx].w = 12; l[idx].y = 0;
      } else if (center > 8) {
        l[idx].x = 6; l[idx].w = 6; l[idx].y = 0;
      } else {
        l[idx].x = 0; l[idx].w = 6; l[idx].y = 0;
      }
    }

    // If dragged high/low out of viewport, cut height in half.
    const vh = height ?? 900;
    const rh = 24;
    if (newItem.y <= 0 || (newItem.y * rh) > (vh - 180)) {
      l[idx].h = Math.max(4, Math.ceil(oldItem.h / 2));
    }

    // Finalize 1:1 horizontal split if dropped over another widget lane.
    const otherIdx = l.findIndex((it, i) => i !== idx && (
      Math.max(it.y, l[idx].y) < Math.min(it.y + it.h, l[idx].y + l[idx].h)
    ) && (
      Math.max(it.x, l[idx].x) < Math.min(it.x + it.w, l[idx].x + l[idx].w)
    ));
    if (otherIdx >= 0) {
      const other = l[otherIdx];
      const splitW = Math.max(2, Math.floor(other.w / 2));
      const leftX = other.x;
      const rightX = other.x + splitW;
      const draggedLeft = (l[idx].x + l[idx].w / 2) < (other.x + other.w / 2);
      l[idx].x = draggedLeft ? leftX : rightX;
      l[idx].w = splitW;
      l[idx].y = other.y;
      l[idx].h = other.h;
      other.x = draggedLeft ? rightX : leftX;
      other.w = splitW;
    }

    // Auto-expand into empty right/bottom space after small drag.
    const target = l[idx];
    const collides = (cand: Layout) => l.some((o, i) => i !== idx && !(cand.x + cand.w <= o.x || o.x + o.w <= cand.x || cand.y + cand.h <= o.y || o.y + o.h <= cand.y));
    while (target.x + target.w < 12 && !collides({ ...target, w: target.w + 1 })) target.w += 1;
    while (target.h < 24 && !collides({ ...target, h: target.h + 1 })) target.h += 1;

    updateLayout(activeTabId, l);
  }, [activeTabId, updateLayout, height]);

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
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={rowHeight}
              width={gridWidth}
              onLayoutChange={handleLayoutChange}
              onDrag={handleDrag as any}
              onDragStop={handleDragStop}
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
          )}
        </main>
      )}
      <AssistantFab />
    </div>
  );
}
