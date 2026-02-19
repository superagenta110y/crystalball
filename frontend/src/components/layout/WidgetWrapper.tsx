"use client";

import React from "react";

const WIDGET_LABELS: Record<string, string> = {
  chart:         "Chart",
  orderflow:     "Order Flow",
  openinterest:  "Open Interest",
  openinterest3d:"3D Open Interest",
  gex:           "Gamma Exposure (GEX)",
  dex:           "Delta Exposure (DEX)",
  newsfeed:      "News Feed",
  bloomberg:     "Bloomberg TV",
  ai:            "AI Assistant",
  report:        "Market Report",
};

interface WidgetWrapperProps {
  id: string;
  children: React.ReactNode;
}

export function WidgetWrapper({ id, children }: WidgetWrapperProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="widget-header cursor-grab active:cursor-grabbing select-none">
        <span>{WIDGET_LABELS[id] ?? id}</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
