"use client";

import React, { useCallback, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Topbar } from "./Topbar";
import { WidgetWrapper } from "./WidgetWrapper";
import { TabBar } from "./TabBar";

import { OrderFlowWidget } from "@/components/widgets/OrderFlowWidget";
import { OpenInterestWidget } from "@/components/widgets/OpenInterestWidget";
import { OpenInterest3DWidget } from "@/components/widgets/OpenInterest3DWidget";
import { GEXWidget } from "@/components/widgets/GEXWidget";
import { DEXWidget } from "@/components/widgets/DEXWidget";
import { ChartWidget } from "@/components/widgets/ChartWidget";
import { NewsFeedWidget } from "@/components/widgets/NewsFeedWidget";
import { BloombergTVWidget } from "@/components/widgets/BloombergTVWidget";
import { AIAssistantWidget } from "@/components/widgets/AIAssistantWidget";
import { MarketReportWidget } from "@/components/widgets/MarketReportWidget";

import { useDashboardStore } from "@/lib/store/dashboardStore";
import useWindowSize from "@/lib/hooks/useWindowSize";

const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ symbol?: string; timeframe?: string }>> = {
  orderflow:     OrderFlowWidget,
  openinterest:  OpenInterestWidget,
  openinterest3d: OpenInterest3DWidget,
  gex:           GEXWidget,
  dex:           DEXWidget,
  chart:         ChartWidget,
  newsfeed:      NewsFeedWidget,
  bloomberg:     BloombergTVWidget,
  ai:            AIAssistantWidget,
  report:        MarketReportWidget,
};

export default function Dashboard() {
  const {
    symbol, timeframe,
    activeTabId, activeTab, updateLayout, theme,
  } = useDashboardStore();

  const { width } = useWindowSize();
  const tab = activeTab();
  const layout = tab?.layout ?? [];
  const activeWidgets = tab?.activeWidgets ?? [];

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => updateLayout(activeTabId, newLayout),
    [activeTabId, updateLayout]
  );

  const visibleLayout = layout.filter((l) => activeWidgets.includes(l.i));
  const gridWidth = Math.max((width ?? 1200) - 0, 400);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{
        background: theme.background,
        "--bull": theme.bull,
        "--bear": theme.bear,
        "--accent": theme.accent,
        "--surface": theme.background,
        "--surface-raised": theme.surface,
        "--surface-border": theme.border,
      } as React.CSSProperties}
    >
      <Topbar />
      <TabBar />

      <main className="flex-1 overflow-auto">
        {visibleLayout.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-600">
            <span className="text-4xl">🔮</span>
            <p className="text-sm">No widgets on this tab. Click <strong className="text-neutral-400">Add Widget</strong> to get started.</p>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={visibleLayout}
            cols={12}
            rowHeight={30}
            width={gridWidth}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            margin={[6, 6]}
            containerPadding={[6, 6]}
          >
            {visibleLayout.map(({ i }) => {
              const Component = WIDGET_COMPONENTS[i];
              if (!Component) return <div key={i} />;
              return (
                <div key={i} className="widget">
                  <WidgetWrapper id={i} tabId={activeTabId}>
                    <Component symbol={symbol} timeframe={timeframe} />
                  </WidgetWrapper>
                </div>
              );
            })}
          </GridLayout>
        )}
      </main>
    </div>
  );
}
