"use client";
import React from "react";
import { X, GripHorizontal } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";

const WIDGET_LABELS: Record<string, string> = {
  chart:          "Chart",
  orderflow:      "Order Flow",
  openinterest:   "Open Interest",
  openinterest3d: "3D Open Interest",
  gex:            "Gamma Exposure (GEX)",
  dex:            "Delta Exposure (DEX)",
  newsfeed:       "News Feed",
  bloomberg:      "Bloomberg TV",
  ai:             "AI Assistant",
  report:         "Market Report",
};

interface WidgetWrapperProps {
  id: string;
  tabId: string;
  children: React.ReactNode;
}

export function WidgetWrapper({ id, tabId, children }: WidgetWrapperProps) {
  const { removeWidget } = useDashboardStore();
  return (
    <div className="flex flex-col h-full">
      <div className="widget-header widget-drag-handle cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-1.5">
          <GripHorizontal size={11} className="opacity-30" />
          <span>{WIDGET_LABELS[id] ?? id}</span>
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => removeWidget(tabId, id)}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition p-0.5 rounded hover:text-red-400"
          aria-label="Close widget"
        >
          <X size={11} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative group">
        {children}
      </div>
    </div>
  );
}
