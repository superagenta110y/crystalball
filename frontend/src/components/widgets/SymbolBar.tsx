"use client";
import React, { useState, useEffect, useRef } from "react";
import { GripHorizontal } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type SymbolItem = { symbol: string; name?: string };

interface SymbolBarProps {
  symbol: string;
  isGlobalOverride?: boolean;
  onSymbolChange: (sym: string) => void;
  extra?: React.ReactNode;
  label?: string;
  mobileLabel?: string;
}

export function SymbolBar({ symbol, isGlobalOverride, onSymbolChange, extra, label, mobileLabel }: SymbolBarProps) {
  const [draft, setDraft] = useState(symbol);
  const [items, setItems] = useState<SymbolItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(symbol); }, [symbol]);

  useEffect(() => {
    if (isGlobalOverride) return;
    const q = draft.trim();
    if (!q) { setItems([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/market/symbols?q=${encodeURIComponent(q)}&limit=12`)
        .then(r => r.json())
        .then(d => setItems((d?.items || []).slice(0, 12)))
        .catch(() => setItems([]));
    }, 100);
    return () => clearTimeout(t);
  }, [draft, isGlobalOverride]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectItem = (s: string) => {
    setDraft(s);
    onSymbolChange(s);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 pr-14 border-b border-surface-border shrink-0 text-xs">
      {(label || mobileLabel) && (
        <div className="widget-drag-handle cursor-grab active:cursor-grabbing select-none inline-flex items-center gap-1.5 text-neutral-500">
          <GripHorizontal size={11} className="opacity-50" />
          {label && <span className="hidden sm:inline text-xs uppercase tracking-wide leading-none">{label}</span>}
          {mobileLabel && <span className="sm:hidden text-xs uppercase tracking-wide leading-none">{mobileLabel}</span>}
        </div>
      )}
      <div ref={ref} className="relative">
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value.toUpperCase()); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={isGlobalOverride}
          title={isGlobalOverride ? "Controlled by global override in the header" : "Select symbol"}
          className={`cb-input border rounded px-2 h-6 leading-none text-xs font-mono w-10 focus:outline-none text-white transition
            ${isGlobalOverride
              ? "bg-transparent border-accent/70 text-accent cursor-not-allowed shadow-[0_0_0_1px_rgba(0,212,170,0.25)]"
              : "bg-transparent border-neutral-500/70 hover:bg-surface-overlay/40 focus:border-accent/60"}`}
        />
        {open && !isGlobalOverride && items.length > 0 && (
          <div className="absolute left-0 top-7 z-40 w-56 rounded-md border border-surface-border bg-surface-raised shadow-xl max-h-64 overflow-auto">
            {items.map((it) => (
              <button key={it.symbol} onClick={() => selectItem(it.symbol)} className="w-full text-left px-2 py-1.5 hover:bg-surface-overlay">
                <div className="text-xs font-mono text-white">{it.symbol}</div>
                <div className="text-[10px] text-neutral-500 truncate">{it.name || ""}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {isGlobalOverride && <span className="text-neutral-700 text-xs leading-none" title="Global override active">⬡</span>}
      {extra && <div className="ml-auto flex items-center gap-2 leading-none opacity-100 md:opacity-0 md:group-hover/widget:opacity-100 transition">{extra}</div>}
    </div>
  );
}
