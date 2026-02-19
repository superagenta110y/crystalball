"use client";

import React, { useState, useCallback } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { WidgetWrapper } from "./WidgetWrapper";

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

const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ symbol?: string }>> = {
  orderflow: OrderFlowWidget,
  openinterest: OpenInterestWidget,
  openinterest3d: OpenInterest3DWidget,
  gex: GEXWidget,
  dex: DEXWidget,
  chart: ChartWidget,
  newsfeed: NewsFeedWidget,
  bloomberg: BloombergTVWidget,
  ai: AIAssistantWidget,
  report: MarketReportWidget,
};

const DEFAULT_LAYOUT: Layout[] = [
  { i: "chart",       x: 0, y: 0,  w: 8, h: 12 },
  { i: "orderflow",   x: 8, y: 0,  w: 4, h: 6  },
  { i: "gex",         x: 8, y: 6,  w: 4, h: 6  },
  { i: "openinterest",x: 0, y: 12, w: 6, h: 6  },
  { i: "dex",         x: 6, y: 12, w: 6, h: 6  },
  { i: "newsfeed",    x: 0, y: 18, w: 4, h: 8  },
  { i: "ai",          x: 4, y: 18, w: 4, h: 8  },
  { i: "report",      x: 8, y: 18, w: 4, h: 8  },
];

const DEFAULT_WIDGETS = DEFAULT_LAYOUT.map((l) => l.i);

export default function Dashboard() {
  const [layout, setLayout] = useState<Layout[]>(DEFAULT_LAYOUT);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { symbol } = useDashboardStore();

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout);
  }, []);

  const visibleLayout = layout.filter((l) => activeWidgets.includes(l.i));

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface">
      <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          activeWidgets={activeWidgets}
          onToggleWidget={(id) =>
            setActiveWidgets((prev) =>
              prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
            )
          }
        />

        <main className="flex-1 overflow-auto p-2">
          <GridLayout
            className="layout"
            layout={visibleLayout}
            cols={12}
            rowHeight={30}
            width={1200}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-header"
            margin={[8, 8]}
          >
            {visibleLayout.map(({ i }) => {
              const Component = WIDGET_COMPONENTS[i];
              if (!Component) return null;
              return (
                <div key={i} className="widget">
                  <WidgetWrapper id={i}>
                    <Component symbol={symbol} />
                  </WidgetWrapper>
                </div>
              );
            })}
          </GridLayout>
        </main>
      </div>
    </div>
  );
}
