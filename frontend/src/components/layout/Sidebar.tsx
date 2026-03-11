"use client";

import React from "react";
import {
  BarChart2, Activity, Layers, TrendingUp, TrendingDown,
  CandlestickChart, Newspaper, ScanSearch, ListOrdered
} from "lucide-react";

const WIDGETS = [
  { id: "chart",        label: "Chart",           icon: CandlestickChart, desc: "Candles + VWAP/VP/RSI" },
  { id: "orderflow",    label: "Order Flow",      icon: Activity,         desc: "Buy/sell bubble chart" },
  { id: "openinterest", label: "Open Interest",   icon: BarChart2,        desc: "OI by strike" },
  { id: "openinterest3d",label: "OI Grid",        icon: Layers,           desc: "Net OI skew grid by strike/expiry" },
  { id: "gex",          label: "Gamma Exposure",  icon: TrendingUp,       desc: "Gamma exposure levels" },
  { id: "dex",          label: "Delta Exposure",  icon: TrendingDown,     desc: "Delta exposure" },
  { id: "newsfeed",     label: "News Feed",       icon: Newspaper,        desc: "Real-time market news" },
  { id: "optionsladder",label: "Options Ladder",  icon: ListOrdered,      desc: "Single-expiration calls/puts ladder" },
  { id: "screener",     label: "Screener",        icon: ScanSearch,       desc: "Realtime filtered ticker table" },
];

interface SidebarProps {
  open: boolean;
  activeWidgets: string[];
  onToggleWidget: (id: string) => void;
}

export function Sidebar({ open, activeWidgets, onToggleWidget }: SidebarProps) {
  if (!open) return null;

  return (
    <aside className="w-56 shrink-0 bg-surface-raised border-r border-surface-border flex flex-col overflow-y-auto">
      <div className="px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest font-semibold border-b border-surface-border">
        Widgets
      </div>

      <div className="flex flex-col gap-0.5 p-2">
        {WIDGETS.map(({ id, label, icon: Icon, desc }) => {
          const active = activeWidgets.includes(id);
          return (
            <button
              key={id}
              onClick={() => onToggleWidget(id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition group ${
                active
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-neutral-400 hover:bg-surface-overlay hover:text-white"
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight">{label}</div>
                <div className="text-xs text-neutral-600 group-hover:text-neutral-500 leading-tight truncate">
                  {desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
