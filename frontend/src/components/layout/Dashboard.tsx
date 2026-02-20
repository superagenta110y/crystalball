"use client";

import React, { useCallback } from "react";
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

import { useDashboardStore, type WidgetInstance } from "@/lib/store/dashboardStore";
import useWindowSize from "@/lib/hooks/useWindowSize";

type WidgetProps = { instance: WidgetInstance; onConfigChange: (patch: Record<string, string>) => void };

function renderWidget({ instance, onConfigChange }: WidgetProps) {
  const { type, config } = instance;
  const symbol = config.symbol;
  const timeframe = config.timeframe;
  switch (type) {
    case "chart":        return <ChartWidget symbol={symbol} timeframe={timeframe} onConfigChange={onConfigChange} />;
    case "orderflow":    return <OrderFlowWidget symbol={symbol} />;
    case "openinterest": return <OpenInterestWidget symbol={symbol} />;
    case "openinterest3d": return <OpenInterest3DWidget symbol={symbol} />;
    case "gex":          return <GEXWidget symbol={symbol} />;
    case "dex":          return <DEXWidget symbol={symbol} />;
    case "newsfeed":     return <NewsFeedWidget />;
    case "bloomberg":    return <BloombergTVWidget />;
    case "ai":           return <AIAssistantWidget symbol={symbol} />;
    case "report":       return <MarketReportWidget symbol={symbol} />;
    default:             return <div className="p-4 text-xs text-neutral-600">Unknown widget: {type}</div>;
  }
}

export default function Dashboard() {
  const { activeTabId, activeTab, updateLayout, removeWidget, updateWidgetConfig, theme } = useDashboardStore();
  const { width } = useWindowSize();
  const tab = activeTab();
  const layout = tab?.layout ?? [];
  const widgets = tab?.widgets ?? [];
  const gridWidth = Math.max((width ?? 1200), 400);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => updateLayout(activeTabId, newLayout),
    [activeTabId, updateLayout]
  );

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{
        background: theme.background,
        "--bull": theme.bull,
        "--bear": theme.bear,
        "--accent": theme.accent,
        "--surface-raised": theme.surface,
        "--surface-border": theme.border,
      } as React.CSSProperties}
    >
      <Topbar />
      <TabBar />

      <main className="flex-1 overflow-auto">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-600">
            <span className="text-4xl">🔮</span>
            <p className="text-sm">No widgets. Click <strong className="text-neutral-400">+ Add Widget</strong> to get started.</p>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={30}
            width={gridWidth}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            margin={[6, 6]}
            containerPadding={[6, 6]}
          >
            {widgets.map((instance) => (
              <div key={instance.id} className="widget">
                <WidgetWrapper
                  instance={instance}
                  onRemove={() => removeWidget(activeTabId, instance.id)}
                >
                  {renderWidget({
                    instance,
                    onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
                  })}
                </WidgetWrapper>
              </div>
            ))}
          </GridLayout>
        )}
      </main>
    </div>
  );
}
