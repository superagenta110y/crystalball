"use client";
/**
 * Reusable per-widget symbol input bar.
 * Shows the currently active symbol (which may come from global override or widget config).
 * User can type a new one and press Enter to override locally.
 */
import React, { useState, useEffect } from "react";

interface SymbolBarProps {
  symbol: string;                          // resolved/effective symbol
  isGlobalOverride?: boolean;              // if true, input is read-only (globally controlled)
  onSymbolChange: (sym: string) => void;  // fires when user types a local override
  extra?: React.ReactNode;                 // optional extra content (status, price, etc.)
}

export function SymbolBar({ symbol, isGlobalOverride, onSymbolChange, extra }: SymbolBarProps) {
  const [draft, setDraft] = useState(symbol);

  // Keep draft in sync when resolved symbol changes (e.g., global override update)
  useEffect(() => { setDraft(symbol); }, [symbol]);

  const commit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = draft.trim().toUpperCase();
    if (s) onSymbolChange(s);
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-surface-border shrink-0">
      <form onSubmit={commit} className="flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          disabled={isGlobalOverride}
          title={isGlobalOverride ? "Controlled by global override in the header" : "Enter symbol and press Enter"}
          className={`border rounded px-2 py-0.5 text-xs font-mono w-16 focus:outline-none text-white transition
            ${isGlobalOverride
              ? "bg-transparent border-surface-border text-neutral-500 cursor-not-allowed"
              : "bg-surface-overlay border-surface-border focus:border-accent/60"
            }`}
        />
        {isGlobalOverride && (
          <span className="text-neutral-700 text-xs" title="Global override active">⬡</span>
        )}
      </form>
      {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
    </div>
  );
}
