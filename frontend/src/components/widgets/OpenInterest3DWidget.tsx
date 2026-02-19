/**
 * OpenInterest3DWidget — 3D surface plot: strike × expiry × OI.
 * Provides intuitive view of where options interest concentrates across the curve.
 *
 * TODO:
 *   - Integrate Plotly.js (or Three.js) for 3D surface rendering
 *   - Fetch /api/options/surface?symbol=SPY
 *   - Add rotation controls
 *   - Color map: green = calls dominant, red = puts dominant
 */
"use client";

import React from "react";

interface OpenInterest3DWidgetProps {
  symbol?: string;
}

export function OpenInterest3DWidget({ symbol = "SPY" }: OpenInterest3DWidgetProps) {
  return (
    <div className="h-full w-full flex items-center justify-center text-neutral-500 text-sm flex-col gap-2 p-4">
      <div className="text-3xl">📐</div>
      <div className="font-medium">3D Open Interest</div>
      <div className="text-xs text-center text-neutral-600 max-w-48">
        Strike × Expiry × OI surface chart.<br />
        Plotly.js integration coming soon.
      </div>
      <div className="text-xs text-neutral-700 font-mono mt-2">
        GET /api/options/surface?symbol={symbol}
      </div>
    </div>
  );
}
