"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { Topbar } from "./Topbar";
import { WidgetWrapper } from "./WidgetWrapper";
import { TabBar } from "./TabBar";
import { AssistantFab } from "./AssistantFab";
import { SettingsModal } from "./SettingsModal";

import { OrderFlowWidget }     from "@/components/widgets/OrderFlowWidget";
import { OpenInterestWidget }  from "@/components/widgets/OpenInterestWidget";
import { OpenInterest3DWidget }from "@/components/widgets/OpenInterest3DWidget";
import { GEXWidget }           from "@/components/widgets/GEXWidget";
import { DEXWidget }           from "@/components/widgets/DEXWidget";
import { ChartWidget }         from "@/components/widgets/ChartWidget";
import { NewsFeedWidget }      from "@/components/widgets/NewsFeedWidget";
import { OptionsLadderWidget } from "@/components/widgets/OptionsLadderWidget";
import { ScreenerWidget }      from "@/components/widgets/ScreenerWidget";

import { useDashboardStore, type WidgetInstance, type WidgetType } from "@/lib/store/dashboardStore";
import useWindowSize from "@/lib/hooks/useWindowSize";

const API = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Hex → "r, g, b" for CSS rgba() ──────────────────────────
function hexToRgbTriple(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function applyTheme(mode: string, accent: string, bull: string, bear: string) {
  const html = document.documentElement;
  const effective = mode === "auto"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : mode;
  html.setAttribute("data-theme", effective);
  html.style.setProperty("--accent", accent);
  html.style.setProperty("--accent-muted", `rgba(${hexToRgbTriple(accent)}, 0.2)`);
  // Dynamic bull/bear + RGB triples for opacity variants
  html.style.setProperty("--bull",      bull);
  html.style.setProperty("--bull-rgb",  hexToRgbTriple(bull));
  html.style.setProperty("--bear",      bear);
  html.style.setProperty("--bear-rgb",  hexToRgbTriple(bear));
  // Remove chart grid lines in both themes
  html.style.setProperty("--grid-line", "transparent");
  // Text colours for charts
  html.style.setProperty("--chart-text", effective === "light" ? "#6b7280" : "#8b8fa8");
}

// ─── Widget renderer ─────────────────────────────────────────────────────────

type WRP = { instance: WidgetInstance; resolvedSymbol: string; isGlobalOverride: boolean; onConfigChange: (p: Record<string,string>) => void };

function renderWidget({ instance, resolvedSymbol, isGlobalOverride, onConfigChange }: WRP) {
  const { type, config } = instance;
  switch (type) {
    case "chart":        return <ChartWidget symbol={resolvedSymbol} timeframe={config.timeframe} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "orderflow":    return <OrderFlowWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} onConfigChange={onConfigChange} />;
    case "openinterest": return <OpenInterestWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "openinterest3d":return <OpenInterest3DWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "gex":          return <GEXWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "dex":          return <DEXWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "newsfeed":     return <NewsFeedWidget globalSymbol={resolvedSymbol} config={config} onConfigChange={onConfigChange} />;
    case "optionsladder":return <OptionsLadderWidget symbol={resolvedSymbol} isGlobalOverride={isGlobalOverride} config={config} onConfigChange={onConfigChange} />;
    case "ai":           return <div className="p-3 text-xs text-neutral-500">AI Assistant moved to the bottom-right assistant button.</div>;
    case "screener":     return <ScreenerWidget />;
    default:             return <div className="p-4 text-xs text-neutral-600">Unknown: {type}</div>;
  }
}

// Mobile widget type groups
const MAIN_TYPES: WidgetType[] = ["chart"];
const SUB_TYPES:  WidgetType[] = ["gex","dex","openinterest","openinterest3d","orderflow","newsfeed","optionsladder","screener"];

// ─── Mobile swipe layout ─────────────────────────────────────────────────────

function MobileLayout({ widgets, resolvedSymbols, isGlobalOverride, activeTabId }: {
  widgets: WidgetInstance[];
  resolvedSymbols: Record<string,string>;
  isGlobalOverride: boolean;
  activeTabId: string;
}) {
  const { removeWidget, updateWidgetConfig } = useDashboardStore();
  const [zoomedWidgetId, setZoomedWidgetId] = useState<string | null>(null);

  const mains = widgets.filter(w => MAIN_TYPES.includes(w.type));
  const subs  = widgets.filter(w => SUB_TYPES.includes(w.type));

  const renderRow = (group: WidgetInstance[]) => (
    <div
      className="h-full flex overflow-x-auto snap-x snap-mandatory min-h-0"
      style={{ scrollbarWidth: "none" }}
    >
      {group.map(instance => (
        <div
          key={instance.id}
          className="snap-start shrink-0 w-full h-full p-1"
        >
          <div className="h-full rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <WidgetWrapper
              instance={instance}
              onRemove={() => removeWidget(activeTabId, instance.id)}
              onToggleZoom={() => setZoomedWidgetId(z => z === instance.id ? null : instance.id)}
              isZoomed={zoomedWidgetId === instance.id}
            >
              {renderWidget({
                instance,
                resolvedSymbol: resolvedSymbols[instance.id] ?? "SPY",
                isGlobalOverride,
                onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
              })}
            </WidgetWrapper>
          </div>
        </div>
      ))}
      {group.length === 0 && (
        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-700">
          No widgets
        </div>
      )}
    </div>
  );

  if (zoomedWidgetId) {
    const instance = widgets.find(w => w.id === zoomedWidgetId);
    if (instance) {
      return (
        <div className="flex-1 overflow-hidden p-1">
          <div className="h-full rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <WidgetWrapper
              instance={instance}
              onRemove={() => removeWidget(activeTabId, instance.id)}
              onToggleZoom={() => setZoomedWidgetId(null)}
              isZoomed
            >
              {renderWidget({
                instance,
                resolvedSymbol: resolvedSymbols[instance.id] ?? "SPY",
                isGlobalOverride,
                onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
              })}
            </WidgetWrapper>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0">{renderRow(mains)}</div>
      <div className="shrink-0 h-px bg-surface-border" />
      <div className="flex-1 min-h-0">{renderRow(subs)}</div>
    </div>
  );
}

// ─── Desktop viewport-fit grid ───────────────────────────────────────────────

const TOPBAR_H  = 48; // h-12
const TABBAR_H  = 34;
const MARGIN    = 6;  // gap between cells
const PADDING   = 6;  // container padding

type SnapZone = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;

function computeRowHeight(windowH: number, layout: Layout[]): number {
  if (!layout.length) return 30;
  const maxRow = layout.reduce((m, l) => Math.max(m, l.y + l.h), 1);
  const available = windowH - TOPBAR_H - TABBAR_H - PADDING * 2 - MARGIN * (maxRow + 1);
  return Math.max(6, Math.floor(available / maxRow));
}

// ─── Main dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { activeTabId, setActiveTab, activeTab, updateLayout, removeWidget, updateWidgetConfig, resolveSymbol, theme, setTheme } = useDashboardStore();
  const { width, height } = useWindowSize();
  const tab      = activeTab();
  const layout   = tab?.layout ?? [];
  const widgets  = tab?.widgets ?? [];
  const isMobile = (width ?? 0) < 768;
  const [zoomedWidgetId, setZoomedWidgetId] = useState<string | null>(null);
  const [resizeDebugEdges, setResizeDebugEdges] = useState<Record<string, string[]>>({});
  const resizeBaselineRef = useRef<Record<string, Layout>>({});
  const [gapTargets, setGapTargets] = useState<Array<{ id: string; x: number; y: number; w: number; h: number }>>([]);
  const [activeGapId, setActiveGapId] = useState<string | null>(null);
  const [sideSplitTarget, setSideSplitTarget] = useState<{ targetId: string; side: "left" | "right" } | null>(null);
  const [prominent, setProminent] = useState<{ id: string; alt: boolean } | null>(null);

  // Hydrate tab/zoom from URL
  useEffect(() => {
    const u = new URL(window.location.href);
    const tabQ = u.searchParams.get("tab");
    const zoomQ = u.searchParams.get("zoomed");
    if (tabQ) setActiveTab(tabQ);
    if (zoomQ) setZoomedWidgetId(zoomQ);
  }, [setActiveTab]);

  // Apply theme to <html> element whenever it changes
  useEffect(() => {
    applyTheme(theme.mode, theme.accent, theme.bull, theme.bear);
    // Also listen for system preference changes when in auto mode
    if (theme.mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("auto", theme.accent, theme.bull, theme.bear);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme.mode, theme.accent, theme.bull, theme.bear]);

  // Load persisted UI theme from backend once
  const themeHydratedRef = useRef(false);
  useEffect(() => {
    fetch(`${API}/api/settings/ui-theme`)
      .then(r => r.json())
      .then((t) => {
        if (t && typeof t === "object") {
          setTheme({ mode: t.mode, accent: t.accent, bull: t.bull, bear: t.bear });
        }
      })
      .finally(() => { themeHydratedRef.current = true; });
  }, [setTheme]);

  // Persist theme to backend (debounced)
  useEffect(() => {
    if (!themeHydratedRef.current) return;
    const t = setTimeout(() => {
      fetch(`${API}/api/settings/ui-theme`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [theme]);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!height) return updateLayout(activeTabId, newLayout);
      const availablePx = Math.max(120, height - TOPBAR_H - TABBAR_H - PADDING * 2);
      const minRowPx = 6;
      const maxRowsAllowed = Math.max(4, Math.floor((availablePx - MARGIN) / (minRowPx + MARGIN)));
      const fixed = newLayout.map(it => ({ ...it }));
      for (const it of fixed) {
        if (it.h > maxRowsAllowed) it.h = maxRowsAllowed;
        if (it.y + it.h > maxRowsAllowed) it.y = Math.max(0, maxRowsAllowed - it.h);
      }
      updateLayout(activeTabId, fixed);
    },
    [activeTabId, updateLayout, height]
  );

  const [snapZone, setSnapZone] = useState<SnapZone>(null);
  const lastZoneRef = useRef<SnapZone>(null);

  const detectSnapZone = useCallback((x: number, y: number, w: number, h: number, prev: SnapZone): SnapZone => {
    const edge = 92;
    const corner = 132;
    const grace = prev ? 56 : 16; // stronger hysteresis/leeway before dropping zone
    const nearLeft = x <= (edge + grace);
    const nearRight = x >= (w - edge - grace);
    const nearTop = y <= (edge + grace);
    const nearBottom = y >= (h - edge - grace);
    if (x <= (corner + grace) && y <= (corner + grace)) return "top-left";
    if (x >= (w - corner - grace) && y <= (corner + grace)) return "top-right";
    if (x <= (corner + grace) && y >= (h - corner - grace)) return "bottom-left";
    if (x >= (w - corner - grace) && y >= (h - corner - grace)) return "bottom-right";
    if (nearLeft) return "left";
    if (nearRight) return "right";
    if (nearTop) return "top";
    if (nearBottom) return "bottom";
    return null;
  }, []);

  const computeGapTargets = useCallback((layout: Layout[], ignoreId?: string) => {
    const filtered = layout.filter(it => it.i !== ignoreId);
    const maxY = Math.max(12, ...filtered.map(it => it.y + it.h));
    const gaps: Array<{ id: string; x: number; y: number; w: number; h: number; area: number }> = [];
    for (let y = 0; y < maxY; y++) {
      for (let x = 0; x < 12; x++) {
        const covered = filtered.some(o => !(x + 1 <= o.x || o.x + o.w <= x || y + 1 <= o.y || o.y + o.h <= y));
        if (covered) continue;
        let bestW = 0, bestH = 0, bestA = 0;
        for (let w = 12 - x; w >= 2; w--) {
          let h = 0;
          while (y + h < maxY) {
            const cand = { x, y, w, h: h + 1 };
            const coll = filtered.some(o => !(cand.x + cand.w <= o.x || o.x + o.w <= cand.x || cand.y + cand.h <= o.y || o.y + o.h <= cand.y));
            if (coll) break;
            h++;
          }
          const a = w * h;
          if (h >= 3 && a > bestA) { bestA = a; bestW = w; bestH = h; }
        }
        if (bestA > 0) gaps.push({ id: `g-${x}-${y}`, x, y, w: bestW, h: bestH, area: bestA });
      }
    }
    // dedupe by exact rect and keep largest few meaningful targets
    const uniq = new Map<string, { id: string; x: number; y: number; w: number; h: number; area: number }>();
    for (const g of gaps) uniq.set(`${g.x}:${g.y}:${g.w}:${g.h}`, g);
    return Array.from(uniq.values()).sort((a, b) => b.area - a.area).slice(0, 6).map(({ area, ...r }) => r);
  }, []);

  const handleDrag = useCallback((layout: Layout[], _oldItem: Layout, newItem: Layout, _placeholder: Layout, e: MouseEvent) => {
    if (!width || !height) return;
    const zone = detectSnapZone(
      e.clientX,
      e.clientY - (TOPBAR_H + TABBAR_H),
      width,
      Math.max(200, height - TOPBAR_H - TABBAR_H),
      lastZoneRef.current
    );
    lastZoneRef.current = zone;
    setSnapZone(zone);

    const gx = ((e.clientX - PADDING) / Math.max(1, width - PADDING * 2)) * 12;
    const gy = ((e.clientY - (TOPBAR_H + TABBAR_H) - PADDING) / Math.max(1, height - TOPBAR_H - TABBAR_H - PADDING * 2)) * Math.max(12, ...layout.map(it => it.y + it.h));

    if (gapTargets.length) {
      const hit = gapTargets.find(g => gx >= g.x && gx <= g.x + g.w && gy >= g.y && gy <= g.y + g.h);
      setActiveGapId(hit?.id || null);
    }

    // Side-split target preview: show when cursor aligns with left/right half of wide tile.
    const wideCandidates = layout.filter(it => it.i !== newItem.i && it.w >= 10);
    let hit: { targetId: string; side: "left" | "right" } | null = null;
    for (const t of wideCandidates) {
      const yNear = gy >= (t.y - 1) && gy <= (t.y + t.h + 1);
      const xNear = gx >= (t.x - 0.75) && gx <= (t.x + t.w + 0.75);
      if (!yNear || !xNear) continue;
      const rel = (gx - t.x) / Math.max(1, t.w);
      if (rel <= 0.48) { hit = { targetId: t.i, side: "left" }; break; }
      if (rel >= 0.52) { hit = { targetId: t.i, side: "right" }; break; }
    }
    setSideSplitTarget(hit);
  }, [width, height, detectSnapZone, gapTargets]);

  const handleDragStop = useCallback((newLayout: Layout[], _oldItem: Layout, newItem: Layout) => {
    const l = newLayout.map(it => ({ ...it }));
    const idx = l.findIndex(it => it.i === newItem.i);
    if (idx < 0) return updateLayout(activeTabId, newLayout);

    const activeGap = gapTargets.find(g => g.id === activeGapId);
    if (activeGap) {
      l[idx].x = activeGap.x;
      l[idx].y = activeGap.y;
      l[idx].w = activeGap.w;
      l[idx].h = activeGap.h;
    }

    const availablePx = Math.max(120, (height ?? 900) - TOPBAR_H - TABBAR_H - PADDING * 2);
    const minRowPx = 6;
    const maxRowsAllowed = Math.max(6, Math.floor((availablePx - MARGIN) / (minRowPx + MARGIN)));
    const halfH = Math.max(3, Math.floor(maxRowsAllowed / 2));

    // Side-drop split: explicit left/right-half target preview on wide tiles.
    if (!activeGap && !snapZone && sideSplitTarget) {
      const dragged = l[idx];
      const targetIdx = l.findIndex((it, i) => i !== idx && it.i === sideSplitTarget.targetId);
      if (targetIdx >= 0) {
        const t = l[targetIdx];
        const half = Math.max(2, Math.floor(t.w / 2));
        if (sideSplitTarget.side === "right") {
          t.w = half;
          dragged.x = t.x + half;
          dragged.w = half;
        } else {
          dragged.x = t.x;
          dragged.w = half;
          t.x = t.x + half;
          t.w = half;
        }
        dragged.y = t.y;
        dragged.h = t.h;
      }
    }

    const zoneAtDrop = snapZone || lastZoneRef.current;
    if (!activeGap && zoneAtDrop) {
      if (zoneAtDrop === "left")      { l[idx].x = 0; l[idx].y = 0; l[idx].w = 6; l[idx].h = maxRowsAllowed; }
      if (zoneAtDrop === "right")     { l[idx].x = 6; l[idx].y = 0; l[idx].w = 6; l[idx].h = maxRowsAllowed; }
      if (zoneAtDrop === "top")       { l[idx].x = 0; l[idx].y = 0; l[idx].w = 12; l[idx].h = halfH; }
      if (zoneAtDrop === "bottom")    { l[idx].x = 0; l[idx].y = maxRowsAllowed - halfH; l[idx].w = 12; l[idx].h = halfH; }
      if (zoneAtDrop === "top-left")  { l[idx].x = 0; l[idx].y = 0; l[idx].w = 6; l[idx].h = halfH; }
      if (zoneAtDrop === "top-right") { l[idx].x = 6; l[idx].y = 0; l[idx].w = 6; l[idx].h = halfH; }
      if (zoneAtDrop === "bottom-left")  { l[idx].x = 0; l[idx].y = maxRowsAllowed - halfH; l[idx].w = 6; l[idx].h = halfH; }
      if (zoneAtDrop === "bottom-right") { l[idx].x = 6; l[idx].y = maxRowsAllowed - halfH; l[idx].w = 6; l[idx].h = halfH; }

      const freeRects: Array<{x:number;y:number;w:number;h:number}> = [];
      if (zoneAtDrop === "left") freeRects.push({ x: 6, y: 0, w: 6, h: maxRowsAllowed });
      if (zoneAtDrop === "right") freeRects.push({ x: 0, y: 0, w: 6, h: maxRowsAllowed });
      if (zoneAtDrop === "top") freeRects.push({ x: 0, y: halfH, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      if (zoneAtDrop === "bottom") freeRects.push({ x: 0, y: 0, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      if (zoneAtDrop === "top-left") {
        freeRects.push({ x: 6, y: 0, w: 6, h: halfH });
        freeRects.push({ x: 0, y: halfH, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }
      if (zoneAtDrop === "top-right") {
        freeRects.push({ x: 0, y: 0, w: 6, h: halfH });
        freeRects.push({ x: 0, y: halfH, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }
      if (zoneAtDrop === "bottom-left") {
        freeRects.push({ x: 6, y: maxRowsAllowed - halfH, w: 6, h: halfH });
        freeRects.push({ x: 0, y: 0, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }
      if (zoneAtDrop === "bottom-right") {
        freeRects.push({ x: 0, y: maxRowsAllowed - halfH, w: 6, h: halfH });
        freeRects.push({ x: 0, y: 0, w: 12, h: Math.max(2, maxRowsAllowed - halfH) });
      }

      const others = l.filter((_, i) => i !== idx);
      const totalArea = freeRects.reduce((s, r) => s + (r.w * r.h), 0) || 1;
      let start = 0;
      for (let ri = 0; ri < freeRects.length; ri++) {
        const fr = freeRects[ri];
        const remaining = others.length - start;
        if (remaining <= 0) break;
        const rawTake = Math.round((fr.w * fr.h / totalArea) * others.length);
        const take = Math.max(ri === freeRects.length - 1 ? remaining : 1, Math.min(remaining, rawTake || 1));
        const chunk = others.slice(start, start + take);
        start += take;

        const n = chunk.length;
        const aspect = fr.w / Math.max(1, fr.h);
        const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * aspect))));
        const rows = Math.max(1, Math.ceil(n / cols));
        const cellW = Math.max(2, Math.floor(fr.w / cols));
        const cellH = Math.max(3, Math.floor(fr.h / rows));

        chunk.forEach((it, i2) => {
          const c = i2 % cols;
          const r = Math.floor(i2 / cols);
          it.x = fr.x + c * cellW;
          it.y = fr.y + r * cellH;
          it.w = (c === cols - 1) ? Math.max(2, fr.x + fr.w - it.x) : cellW;
          it.h = (r === rows - 1) ? Math.max(3, fr.y + fr.h - it.y) : cellH;
        });
      }
    } else {
      // no anchor zone: keep dragged widget size/position from drop, only clamp to viewport rows
      const t = l[idx];
      if (t.y + t.h > maxRowsAllowed) t.y = Math.max(0, maxRowsAllowed - t.h);
    }

    // final safety clamp (nothing offscreen)
    for (const it of l) {
      if (it.h > maxRowsAllowed) it.h = maxRowsAllowed;
      if (it.y < 0) it.y = 0;
      if (it.y + it.h > maxRowsAllowed) it.y = Math.max(0, maxRowsAllowed - it.h);
      if (it.x < 0) it.x = 0;
      if (it.x + it.w > 12) it.x = Math.max(0, 12 - it.w);
    }

    lastZoneRef.current = null;
    setSnapZone(null);
    setActiveGapId(null);
    setSideSplitTarget(null);
    setGapTargets([]);
    updateLayout(activeTabId, l);
  }, [activeTabId, updateLayout, snapZone, height, gapTargets, activeGapId, sideSplitTarget]);

  const handleResize = useCallback((newLayout: Layout[], oldItem: Layout, newItem: Layout) => {
    const l = newLayout as Layout[];
    const idx = l.findIndex(it => it.i === newItem.i);
    if (idx < 0) return;
    const item = l[idx];

    const prev = resizeBaselineRef.current[item.i] || oldItem;
    const oldRight = prev.x + prev.w;
    const newRight = item.x + item.w;
    const dx = newRight - oldRight;
    const oldBottom = prev.y + prev.h;
    const newBottom = item.y + item.h;
    const dy = newBottom - oldBottom;
    const overlapY = (a: Layout, b: Layout) => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const overlapX = (a: Layout, b: Layout) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));

    const dbg: Record<string, string[]> = { [item.i]: [] };

    if (dx !== 0) {
      dbg[item.i].push("right");
      const moved = new Set<string>();
      for (const it of l) {
        if (it.i !== item.i && it.x === oldRight && overlapY(it, oldItem) > 0) {
          moved.add(it.i);
          it.x += dx;
          it.w = Math.max(2, it.w - dx); // preserve far edge, keep connected edge glued
        }
      }
      moved.forEach(id => { dbg[id] = [...(dbg[id] || []), "left", "right"]; });
    }

    if (dy !== 0) {
      dbg[item.i].push("bottom");
      const moved = new Set<string>();
      for (const it of l) {
        if (it.i !== item.i && it.y === oldBottom && overlapX(it, oldItem) > 0) {
          moved.add(it.i);
          it.y += dy;
          it.h = Math.max(3, it.h - dy); // preserve lower edge while staying connected
        }
      }
      moved.forEach(id => { dbg[id] = [...(dbg[id] || []), "top", "bottom"]; });
    }

    resizeBaselineRef.current[item.i] = { ...item };
    setResizeDebugEdges(dbg);
  }, []);

  const handleResizeStop = useCallback((newLayout: Layout[], oldItem: Layout, newItem: Layout) => {
    const l = newLayout.map(it => ({ ...it }));
    const idx = l.findIndex(it => it.i === newItem.i);
    if (idx < 0) return updateLayout(activeTabId, newLayout);

    const item = l[idx];
    const oldRight = oldItem.x + oldItem.w;
    const newRight = item.x + item.w;
    const dx = newRight - oldRight;
    const oldBottom = oldItem.y + oldItem.h;
    const newBottom = item.y + item.h;
    const dy = newBottom - oldBottom;
    const overlapY = (a: Layout, b: Layout) => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const overlapX = (a: Layout, b: Layout) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));

    if (dx !== 0) {
      for (const it of l) {
        if (it.i !== item.i && it.x === oldRight && overlapY(it, oldItem) > 0) {
          it.x += dx;
          it.w = Math.max(2, it.w - dx);
        }
      }
    }

    if (dy !== 0) {
      for (const it of l) {
        if (it.i !== item.i && it.y === oldBottom && overlapX(it, oldItem) > 0) {
          it.y += dy;
          it.h = Math.max(3, it.h - dy);
        }
      }
    }

    for (const it of l) {
      if (it.x < 0) it.x = 0;
      if (it.w < 2) it.w = 2;
      if (it.x + it.w > 12) it.x = Math.max(0, 12 - it.w);
      if (it.y < 0) it.y = 0;
      if (it.h < 3) it.h = 3;
    }

    setResizeDebugEdges({});
    updateLayout(activeTabId, l);
  }, [activeTabId, updateLayout]);

  const handleRetileProminent = useCallback((widgetId: string) => {
    const nextLayout = layout.map(it => ({ ...it }));
    const idx = nextLayout.findIndex(it => it.i === widgetId);
    if (idx < 0 || !nextLayout.length) return;

    const isPortrait = (height || 0) > (width || 0);
    const nextAlt = (prominent?.id === widgetId) ? !prominent.alt : false;
    setProminent({ id: widgetId, alt: nextAlt });

    const maxRows = Math.max(10, ...nextLayout.map(it => it.y + it.h));
    const main = nextLayout[idx];
    if (isPortrait) {
      // portrait: prominent on top half
      main.x = 0; main.y = 0; main.w = 12; main.h = Math.max(4, Math.floor(maxRows / 2));
      const others = nextLayout.filter((_, i) => i !== idx);
      const remY = main.h;
      const remH = Math.max(3, maxRows - remY);
      if (!nextAlt) {
        // horizontal strip grid
        const n = Math.max(1, others.length);
        const wEach = Math.max(2, Math.floor(12 / n));
        others.forEach((o, i) => { o.x = i * wEach; o.y = remY; o.w = (i === n - 1) ? 12 - o.x : wEach; o.h = remH; });
      } else {
        // vertical stack
        const n = Math.max(1, others.length);
        const hEach = Math.max(3, Math.floor(remH / n));
        others.forEach((o, i) => { o.x = 0; o.y = remY + i * hEach; o.w = 12; o.h = (i === n - 1) ? remH - i * hEach : hEach; });
      }
    } else {
      // landscape: prominent on left half
      main.x = 0; main.y = 0; main.w = 6; main.h = maxRows;
      const others = nextLayout.filter((_, i) => i !== idx);
      if (!nextAlt) {
        // vertical stack on right
        const n = Math.max(1, others.length);
        const hEach = Math.max(3, Math.floor(maxRows / n));
        others.forEach((o, i) => { o.x = 6; o.y = i * hEach; o.w = 6; o.h = (i === n - 1) ? maxRows - i * hEach : hEach; });
      } else {
        // horizontal lanes on right upper/lower
        const n = Math.max(1, others.length);
        const cols = Math.min(2, n);
        const rows = Math.ceil(n / cols);
        const hEach = Math.max(3, Math.floor(maxRows / rows));
        const wEach = Math.max(2, Math.floor(6 / cols));
        others.forEach((o, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          o.x = 6 + c * wEach;
          o.y = r * hEach;
          o.w = (c === cols - 1) ? 6 - c * wEach : wEach;
          o.h = (r === rows - 1) ? maxRows - r * hEach : hEach;
        });
      }
    }
    updateLayout(activeTabId, nextLayout);
  }, [layout, activeTabId, updateLayout, width, height, prominent]);

  const isGlobalOverride = (tab?.globalSymbols?.length ?? 0) > 0;

  const resolvedSymbols = useMemo(
    () => Object.fromEntries(widgets.map(w => [w.id, resolveSymbol(activeTabId, w.id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTabId, widgets, tab?.globalSymbols]
  );

  // Dynamic row height so grid always fits viewport (no scroll)
  const rowHeight = useMemo(
    () => computeRowHeight(height ?? 900, layout),
    [height, layout]
  );

  useEffect(() => {
    if (zoomedWidgetId && !widgets.some(w => w.id === zoomedWidgetId)) {
      setZoomedWidgetId(null);
    }
  }, [zoomedWidgetId, widgets]);

  // Sync URL with active tab + zoomed widget
  useEffect(() => {
    const u = new URL(window.location.href);
    if (activeTabId) u.searchParams.set("tab", activeTabId);
    else u.searchParams.delete("tab");
    if (zoomedWidgetId) u.searchParams.set("zoomed", zoomedWidgetId);
    else u.searchParams.delete("zoomed");
    const q = u.searchParams.toString();
    window.history.replaceState({}, "", q ? `${u.pathname}?${q}` : u.pathname);
  }, [activeTabId, zoomedWidgetId]);

  const gridWidth = Math.max(width ?? 1200, 400);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-surface">
      <Topbar />
      <TabBar />

      {widgets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-500">
          <svg width="96" height="96" viewBox="0 0 96 96" className="opacity-90">
            <defs>
              <radialGradient id="cbGlow" cx="50%" cy="42%" r="58%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
              </radialGradient>
            </defs>
            <circle cx="48" cy="48" r="28" fill="url(#cbGlow)" stroke="var(--accent)" strokeOpacity="0.45"/>
            <path d="M24 72h48" stroke="currentColor" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round"/>
            <path d="M32 76h32" stroke="currentColor" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round"/>
          </svg>
          <p className="text-sm">Click <strong className="text-neutral-300">[+Add Widget]</strong> or <button className="text-accent underline" onClick={() => window.dispatchEvent(new Event('assistant:open'))}>[Use AI]</button> to build your dashboard.</p>
        </div>
      ) : isMobile ? (
        <MobileLayout
          widgets={widgets}
          resolvedSymbols={resolvedSymbols}
          isGlobalOverride={isGlobalOverride}
          activeTabId={activeTabId}
        />
      ) : (
        <main className="flex-1 overflow-hidden">
          {zoomedWidgetId ? (
            <div className="h-full p-2">
              {widgets.filter(w => w.id === zoomedWidgetId).map(instance => (
                <div key={instance.id} className="h-full rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                  <WidgetWrapper
                    instance={instance}
                    onRemove={() => removeWidget(activeTabId, instance.id)}
                    onToggleZoom={() => setZoomedWidgetId(null)}
                    isZoomed
                  >
                    {renderWidget({
                      instance,
                      resolvedSymbol: resolvedSymbols[instance.id] ?? "SPY",
                      isGlobalOverride,
                      onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
                    })}
                  </WidgetWrapper>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative h-full">
              {sideSplitTarget && (() => {
                const t = layout.find(it => it.i === sideSplitTarget.targetId);
                if (!t) return null;
                const leftPct = (t.x / 12) * 100;
                const wPct = (t.w / 12) * 100;
                const halfPct = wPct / 2;
                return (
                  <div className="absolute z-41 pointer-events-none border-2 border-accent bg-accent/30 rounded-xl transition-all duration-100"
                    style={{
                      left: `calc(${sideSplitTarget.side === "left" ? leftPct : leftPct + halfPct}% + ${PADDING}px)`,
                      width: `calc(${halfPct}% - ${PADDING * 2}px)`,
                      top: `${PADDING + (t.y * (rowHeight + MARGIN))}px`,
                      height: `${Math.max(12, t.h * rowHeight + (t.h - 1) * MARGIN)}px`,
                    }}
                  />
                );
              })()}
              {snapZone && (
                <div className={`absolute z-40 pointer-events-none border-2 border-accent bg-accent/35 rounded-xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)] backdrop-blur-[1px] transition-all duration-150
                  ${snapZone === "left" ? "left-0 top-0 h-full w-1/2" : ""}
                  ${snapZone === "right" ? "right-0 top-0 h-full w-1/2" : ""}
                  ${snapZone === "top" ? "left-0 top-0 w-full h-1/2" : ""}
                  ${snapZone === "bottom" ? "left-0 bottom-0 w-full h-1/2" : ""}
                  ${snapZone === "top-left" ? "left-0 top-0 w-1/2 h-1/2" : ""}
                  ${snapZone === "top-right" ? "right-0 top-0 w-1/2 h-1/2" : ""}
                  ${snapZone === "bottom-left" ? "left-0 bottom-0 w-1/2 h-1/2" : ""}
                  ${snapZone === "bottom-right" ? "right-0 bottom-0 w-1/2 h-1/2" : ""}
                `} />
              )}
              <GridLayout
                className="layout"
                layout={layout}
                cols={12}
                rowHeight={rowHeight}
                width={gridWidth}
                onLayoutChange={handleLayoutChange}
                onDragStart={(layout:any, oldItem:any) => { setGapTargets(computeGapTargets(layout as Layout[], oldItem?.i)); setActiveGapId(null); setSideSplitTarget(null); }}
                onDrag={handleDrag as any}
                onDragStop={handleDragStop}
                onResizeStart={(_layout:any, oldItem:any) => { setResizeDebugEdges({}); resizeBaselineRef.current = { [oldItem.i]: { ...oldItem } }; }}
                onResize={handleResize as any}
                onResizeStop={(layout:any, oldItem:any, newItem:any) => { resizeBaselineRef.current = {}; handleResizeStop(layout, oldItem, newItem); }}
                draggableHandle=".widget-drag-handle"
                margin={[MARGIN, MARGIN]}
                containerPadding={[PADDING, PADDING]}
                compactType="vertical"
                preventCollision={false}
                isDraggable
                isResizable
                resizeHandles={["n", "e", "s", "w", "ne", "se", "sw"] as any}
              >
                {widgets.map(instance => (
                  <div key={instance.id} className="widget relative">
                    {resizeDebugEdges[instance.id]?.includes("left") && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent/80 z-40 pointer-events-none" />}
                    {resizeDebugEdges[instance.id]?.includes("right") && <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent/80 z-40 pointer-events-none" />}
                    {resizeDebugEdges[instance.id]?.includes("top") && <div className="absolute left-0 right-0 top-0 h-1 bg-accent/80 z-40 pointer-events-none" />}
                    {resizeDebugEdges[instance.id]?.includes("bottom") && <div className="absolute left-0 right-0 bottom-0 h-1 bg-accent/80 z-40 pointer-events-none" />}
                    <WidgetWrapper
                      instance={instance}
                      onRemove={() => removeWidget(activeTabId, instance.id)}
                      onToggleZoom={() => setZoomedWidgetId(instance.id)}
                      onRetileProminent={() => handleRetileProminent(instance.id)}
                      isZoomed={false}
                    >
                      {renderWidget({
                        instance,
                        resolvedSymbol: resolvedSymbols[instance.id] ?? "SPY",
                        isGlobalOverride,
                        onConfigChange: (patch) => updateWidgetConfig(activeTabId, instance.id, patch),
                      })}
                    </WidgetWrapper>
                  </div>
                ))}
              </GridLayout>
            </div>
          )}
        </main>
      )}
      <AssistantFab />
      <SettingsModal />
    </div>
  );
}
