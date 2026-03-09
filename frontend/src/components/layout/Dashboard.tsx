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
    case "newsfeed":     return <NewsFeedWidget globalSymbol={resolvedSymbol} />;
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
  const { activeTabId, activeTab, updateLayout, removeWidget, updateWidgetConfig, resolveSymbol, theme, setTheme } = useDashboardStore();
  const { width, height } = useWindowSize();
  const tab      = activeTab();
  const layout   = tab?.layout ?? [];
  const widgets  = tab?.widgets ?? [];
  const isMobile = (width ?? 0) < 768;
  const [zoomedWidgetId, setZoomedWidgetId] = useState<string | null>(null);

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

  const gridWidth = Math.max(width ?? 1200, 400);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <Topbar />
      <TabBar />

      {widgets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-600">
          <span className="text-4xl">🔮</span>
          <p className="text-sm">No widgets — click <strong className="text-neutral-400">+ Add Widget</strong> to build your dashboard.</p>
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
              draggableHandle=".widget-drag-handle"
              margin={[MARGIN, MARGIN]}
              containerPadding={[PADDING, PADDING]}
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
