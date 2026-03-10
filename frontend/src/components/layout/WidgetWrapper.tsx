"use client";
import React from "react";
import { X, GripHorizontal, Maximize2, Minimize2 } from "lucide-react";
import type { WidgetInstance } from "@/lib/store/dashboardStore";

const WIDGET_LABELS: Record<string, { full: string; mobile: string }> = {
  chart:          { full: "Chart", mobile: "Chart" },
  orderflow:      { full: "Order Flow", mobile: "Flow" },
  openinterest:   { full: "Open Interest", mobile: "OI" },
  openinterest3d: { full: "OI Grid", mobile: "Grid" },
  gex:            { full: "Gamma Exposure", mobile: "GEX" },
  dex:            { full: "Delta Exposure", mobile: "DEX" },
  newsfeed:       { full: "News Feed", mobile: "News" },
  bloomberg:      { full: "Bloomberg TV", mobile: "TV" },
  ai:             { full: "AI Assistant", mobile: "AI" },
  report:         { full: "Market Report", mobile: "Rpt" },
  screener:       { full: "Screener", mobile: "Scan" },
};

interface WidgetWrapperProps {
  instance: WidgetInstance;
  onRemove: () => void;
  onToggleZoom?: () => void;
  isZoomed?: boolean;
  children: React.ReactNode;
}

export function WidgetWrapper({ instance, onRemove, onToggleZoom, isZoomed, children }: WidgetWrapperProps) {
  const label = WIDGET_LABELS[instance.type] ?? { full: instance.type, mobile: instance.type.slice(0, 5) };
  const inlineHeaderTypes = new Set(["chart", "gex", "dex", "openinterest", "openinterest3d", "orderflow"]);
  const disableZoomTypes = new Set(["gex", "openinterest"]);
  const isChart = instance.type === "chart";
  const useInlineHeader = inlineHeaderTypes.has(instance.type);
  const canZoom = !disableZoomTypes.has(instance.type);
  return (
    <div className="flex flex-col h-full group/widget">
      {!useInlineHeader && (
        <div className="widget-header widget-drag-handle cursor-grab active:cursor-grabbing select-none">
          <div className="flex items-center gap-1.5">
            <GripHorizontal size={11} className="opacity-30" />
            <span className="hidden sm:inline">{label.full}</span><span className="sm:hidden">{label.mobile}</span>
            {instance.config.symbol && (
              <span className="text-neutral-600 font-mono">{instance.config.symbol}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canZoom && <button onMouseDown={(e) => e.stopPropagation()} onClick={onToggleZoom} className="opacity-0 group-hover/widget:opacity-100 transition p-1 rounded hover:bg-surface-overlay" aria-label={isZoomed ? "Zoom out" : "Zoom in"} title={isZoomed ? "Zoom out" : "Zoom in"}>{isZoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>}
            <button onMouseDown={(e) => e.stopPropagation()} onClick={onRemove} className="opacity-0 group-hover/widget:opacity-100 transition p-1 rounded hover:bg-surface-overlay hover:text-red-400" aria-label="Remove widget"><X size={13} /></button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden relative">
        {useInlineHeader && (
          <div className="absolute top-1 right-1 z-30 flex items-center gap-1">
            {canZoom && <button onMouseDown={(e) => e.stopPropagation()} onClick={onToggleZoom} className="opacity-0 group-hover/widget:opacity-100 transition p-1 rounded hover:bg-surface-overlay" aria-label={isZoomed ? "Zoom out" : "Zoom in"}>{isZoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>}
            <button onMouseDown={(e) => e.stopPropagation()} onClick={onRemove} className="opacity-0 group-hover/widget:opacity-100 transition p-1 rounded hover:bg-surface-overlay hover:text-red-400" aria-label="Remove widget"><X size={13} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
