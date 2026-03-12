"use client";

import React from "react";

export function SkeletonBars() {
  return (
    <div className="h-full w-full animate-pulse p-2 flex items-end gap-1">
      {Array.from({ length: 22 }).map((_, i) => (
        <div key={i} className="bg-surface-overlay/80 rounded-sm" style={{ height: `${20 + ((i * 37) % 70)}%`, width: "4.2%" }} />
      ))}
    </div>
  );
}

export function SkeletonBubbles() {
  return (
    <div className="h-full w-full animate-pulse p-2 relative">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-surface-overlay/80"
          style={{
            width: `${14 + ((i * 13) % 26)}px`,
            height: `${14 + ((i * 13) % 26)}px`,
            left: `${4 + ((i * 19) % 88)}%`,
            top: `${8 + ((i * 23) % 76)}%`,
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="h-full w-full animate-pulse p-2 space-y-1">
      <div className="h-6 bg-surface-overlay/70 rounded" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="grid grid-cols-5 gap-1">
          {Array.from({ length: 5 }).map((__, j) => <div key={j} className="h-5 bg-surface-overlay/60 rounded" />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards() {
  return (
    <div className="h-full w-full animate-pulse p-2 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-md border border-surface-border p-2 space-y-2">
          <div className="h-4 bg-surface-overlay/75 rounded w-[85%]" />
          <div className="h-3 bg-surface-overlay/60 rounded w-[95%]" />
          <div className="h-3 bg-surface-overlay/60 rounded w-[70%]" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeatmap() {
  return (
    <div className="h-full w-full animate-pulse p-2">
      <div className="grid h-full w-full gap-[2px]" style={{ gridTemplateColumns: "56px repeat(6, minmax(0, 1fr))", gridTemplateRows: "16px repeat(14, minmax(0, 1fr))" }}>
        {Array.from({ length: 7 * 15 }).map((_, i) => <div key={i} className="bg-surface-overlay/70 rounded-sm" />)}
      </div>
    </div>
  );
}
