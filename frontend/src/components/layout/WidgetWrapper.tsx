"use client";
import React from "react";
import { X, GripHorizontal } from "lucide-react";
import type { WidgetInstance } from "@/lib/store/dashboardStore";

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
  instance: WidgetInstance;
  onRemove: () => void;
  children: React.ReactNode;
}

export function WidgetWrapper({ instance, onRemove, children }: WidgetWrapperProps) {
  const label = WIDGET_LABELS[instance.type] ?? instance.type;
  return (
    <div className="flex flex-col h-full group/widget">
      <div className="widget-header widget-drag-handle cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-1.5">
          <GripHorizontal size={11} className="opacity-30" />
          <span>{label}</span>
          {instance.config.symbol && (
            <span className="text-neutral-600 font-mono">{instance.config.symbol}</span>
          )}
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="opacity-0 group-hover/widget:opacity-50 hover:!opacity-100 transition p-0.5 rounded hover:text-red-400"
          aria-label="Remove widget"
        >
          <X size={11} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
