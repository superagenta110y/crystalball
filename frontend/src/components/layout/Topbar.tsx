"use client";

import React, { useState } from "react";
import { Menu, Search, Settings } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { symbol, setSymbol } = useDashboardStore();
  const [input, setInput] = useState(symbol);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) setSymbol(input.trim().toUpperCase());
  };

  return (
    <header className="flex items-center gap-4 px-4 py-2 bg-surface-raised border-b border-surface-border shrink-0">
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-lg hover:bg-surface-overlay text-neutral-400 hover:text-white transition"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 font-bold text-accent text-sm tracking-wide">
        <span>🔮</span>
        <span>CrystalBall</span>
      </div>

      {/* Symbol search */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 ml-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Symbol..."
            className="bg-surface-overlay border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-sm w-32 focus:outline-none focus:border-accent/60 transition"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg text-sm transition"
        >
          Go
        </button>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <MarketStatus />
        <button className="p-1.5 rounded-lg hover:bg-surface-overlay text-neutral-400 hover:text-white transition">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

function MarketStatus() {
  // TODO: derive from Alpaca WS connection status
  const isOpen = isMarketOpen();
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
      isOpen
        ? "text-bull border-bull/30 bg-bull/10"
        : "text-neutral-500 border-surface-border bg-surface-overlay"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-bull animate-pulse" : "bg-neutral-600"}`} />
      {isOpen ? "Market Open" : "Market Closed"}
    </div>
  );
}

function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeInMin = hours * 60 + minutes;
  return day >= 1 && day <= 5 && timeInMin >= 570 && timeInMin < 960; // 9:30–16:00
}
