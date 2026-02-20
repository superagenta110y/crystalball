"use client";

import React, { useCallback, useMemo, useRef } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Topbar } from "./Topbar";
import { WidgetWrapper } from "./WidgetWrapper";
import { TabBar } from "./TabBar";

import { OrderFlowWidget }     from "@/components/widgets/OrderFlowWidget";
import { OpenInterestWidget }  from "@/components/widgets/OpenInterestWidget";
import { OpenInterest3DWidget }from "@/components/widgets/OpenInterest3DWidget";
import { GEXWidget }           from "@/components/widgets/GEXWidget";
import { DEXWidget }           from "@/components/widgets/DEXWidget";
import { ChartWidget }         from "@/components/widgets/ChartWidget";
import { NewsFeedWidget }      from "@/components/widgets/NewsFeedWidget";
import { BloombergTVWidget }   from "@/components/widgets/BloombergTVWidget";
import { AIAssistantWidget }   from "@/components/widgets/AIAssistantWidget";
import { MarketReportWidget }  from "@/components/widgets/MarketReportWidget";

import { useDashboardStore, type WidgetInstance, type WidgetType } from "@/lib/store/dashboardStore";
import useWindowSize from "@/lib/hooks/useWindowSize";

// ─── Widget renderer ─────────────────────────────────────────────────────────

type WRP = { instance: WidgetInstance; resolvedSymbol: string; isGlobalOverride: boolean; onConfigChange: (p: Record<string,string>) => void };

function renderWidget({ instance, resolvedSymbol, isGlobalOverride, onConfigChange }: WRP) {
  const { type, config } = instance;
  switch (type) {
    case "chart":        return <ChartWidget symbol={resolvedSymbol} timeframe={config.timeframe} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "orderflow":    return <OrderFlowWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "openinterest": return <OpenInterestWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "openinterest3d":return <OpenInterest3DWidget symbol={resolvedSymbol} />;
    case "gex":          return <GEXWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "dex":          return <DEXWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "newsfeed":     return <NewsFeedWidget globalSymbol={resolvedSymbol} />;
    case "bloomberg":    return <BloombergTVWidget />;
    case "ai":           return <AIAssistantWidget symbol={config.symbol || "SPY"} />;
    case "report":       return <MarketReportWidget symbol={config.symbol || "SPY"} />;
    default:             return <div className="p-4 text-xs text-neutral-600">Unknown: {type}</div>;
  }
}

// Mobile widget type groups
const MAIN_TYPES: WidgetType[] = ["chart"];
const SUB_TYPES:  WidgetType[] = ["gex","dex","openinterest","openinterest3d","orderflow","newsfeed","bloomberg","ai","report"];

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
  const { activeTabId, activeTab, updateLayout, removeWidget, updateWidgetConfig, resolveSymbol, theme } = useDashboardStore();
  const { width, height } = useWindowSize();
  const tab      = activeTab();
  const layout   = tab?.layout ?? [];
  const widgets  = tab?.widgets ?? [];
  const isMobile = (width ?? 0) < 768;

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

  const gridWidth = Math.max(width ?? 1200, 400);

  const themeVars = {
    background: theme.background,
    "--bull": theme.bull, "--bear": theme.bear, "--accent": theme.accent,
    "--surface-raised": theme.surface, "--surface-border": theme.border,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ ...themeVars, background: theme.background }}>
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
                <WidgetWrapper instance={instance} onRemove={() => removeWidget(activeTabId, instance.id)}>
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
        </main>
      )}
    </div>
  );
}
