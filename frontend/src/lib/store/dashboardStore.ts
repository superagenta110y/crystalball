import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Layout } from "react-grid-layout";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetType =
  | "chart" | "orderflow" | "openinterest" | "openinterest3d"
  | "gex" | "dex" | "newsfeed" | "bloomberg" | "ai" | "report" | "screener";

// Widget types that accept a per-widget symbol override (and global)
export const SYMBOL_WIDGET_TYPES: WidgetType[] = [
  "chart", "orderflow", "openinterest", "openinterest3d", "gex", "dex",
];
// NewsFeed respects global[0] but has no per-widget input

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  config: Record<string, string>;
}

export type ThemeMode = "dark" | "light" | "auto";

export interface ThemeColors {
  mode: ThemeMode;
  accent: string;
  bull: string;
  bear: string;
}

export interface DashboardTab {
  id: string;
  name: string;
  layout: Layout[];
  widgets: WidgetInstance[];
  globalSymbols: string[]; // e.g. ["SPY", "QQQ"] — positional override
}

export interface DashboardState {
  theme: ThemeColors;
  tabs: DashboardTab[];
  activeTabId: string;

  setTheme: (theme: Partial<ThemeColors>) => void;
  addTab: (name?: string) => void;
  removeTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setActiveTab: (id: string) => void;
  setGlobalSymbols: (tabId: string, symbols: string[]) => void;

  addWidget: (tabId: string, type: WidgetType, config?: Record<string, string>) => void;
  removeWidget: (tabId: string, widgetId: string) => void;
  updateWidgetConfig: (tabId: string, widgetId: string, config: Partial<Record<string, string>>) => void;
  updateLayout: (tabId: string, layout: Layout[]) => void;

  activeTab: () => DashboardTab | undefined;
  /** Resolve effective symbol for a widget, respecting global override. */
  resolveSymbol: (tabId: string, widgetId: string, fallback?: string) => string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: ThemeColors = {
  mode: "dark",
  accent: "#00d4aa",
  bull: "#00d4aa",
  bear: "#ff4d6d",
};

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function makeWidget(type: WidgetType, config?: Record<string, string>): WidgetInstance {
  return { id: uuid(), type, config: config ?? {} };
}

function makeDefaultLayout(widgets: WidgetInstance[]): Layout[] {
  const positions: Array<[number, number, number, number]> = [
    [0,0,8,14],[8,0,4,7],[8,7,4,7],
    [0,14,6,8],[6,14,6,8],
    [0,22,4,9],[4,22,4,9],[8,22,4,9],
  ];
  return widgets.map((w, i) => {
    const [x, y, w_, h] = positions[i] ?? [0, i * 7, 6, 7];
    return { i: w.id, x, y, w: w_, h };
  });
}

function makeMainTab(): DashboardTab {
  const widgets: WidgetInstance[] = [
    makeWidget("chart"),
    makeWidget("orderflow"),
    makeWidget("gex"),
    makeWidget("openinterest"),
    makeWidget("dex"),
    makeWidget("newsfeed"),
    makeWidget("report"),
    makeWidget("screener"),
  ];
  return { id: uuid(), name: "Main", layout: makeDefaultLayout(widgets), widgets, globalSymbols: [] };
}

function makeBlankTab(name: string): DashboardTab {
  return { id: uuid(), name, layout: [], widgets: [], globalSymbols: [] };
}

// ─── Store ────────────────────────────────────────────────────────────────────

const INITIAL_TAB = makeMainTab();

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      theme: DEFAULT_THEME,
      tabs: [INITIAL_TAB],
      activeTabId: INITIAL_TAB.id,

      setTheme: (patch) => set((s) => ({ theme: { ...s.theme, ...patch } })),

      addTab: (name) => {
        const tab = makeBlankTab(name ?? `Tab ${get().tabs.length + 1}`);
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
      },

      removeTab: (id) => {
        const tabs = get().tabs.filter((t) => t.id !== id);
        if (!tabs.length) return;
        const activeTabId = get().activeTabId === id ? tabs[0].id : get().activeTabId;
        set({ tabs, activeTabId });
      },

      renameTab: (id, name) =>
        set((s) => ({ tabs: s.tabs.map((t) => t.id === id ? { ...t, name } : t) })),

      setActiveTab: (id) => set({ activeTabId: id }),

      setGlobalSymbols: (tabId, symbols) =>
        set((s) => ({
          tabs: s.tabs.map((t) => t.id === tabId ? { ...t, globalSymbols: symbols } : t),
        })),

      addWidget: (tabId, type, config) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const w = makeWidget(type, config);

            // Empty page: first widget should fill full available canvas.
            if (!t.layout.length) {
              const full: Layout = { i: w.id, x: 0, y: 0, w: 12, h: 16 };
              return { ...t, widgets: [...t.widgets, w], layout: [full] };
            }

            const collides = (cand: Layout, layout: Layout[]) =>
              layout.some((o) => !(cand.x + cand.w <= o.x || o.x + o.w <= cand.x || cand.y + cand.h <= o.y || o.y + o.h <= cand.y));

            // 1) Try to place in the largest existing gap first (fill full gap, not partial).
            const maxY = t.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
            let best: Layout | null = null;
            let bestArea = 0;
            const yLimit = Math.max(12, maxY + 8);
            for (let y = 0; y <= yLimit; y++) {
              for (let x = 0; x < 12; x++) {
                // skip covered origins
                if (collides({ i: w.id, x, y, w: 1, h: 1 }, t.layout)) continue;
                for (let gw = 12 - x; gw >= 2; gw--) {
                  let gh = 1;
                  while (y + gh <= yLimit && !collides({ i: w.id, x, y, w: gw, h: gh }, t.layout)) gh++;
                  gh = gh - 1;
                  if (gh < 3) continue;
                  const area = gw * gh;
                  if (area > bestArea) {
                    bestArea = area;
                    best = { i: w.id, x, y, w: gw, h: gh };
                  }
                }
              }
            }
            if (best) {
              return { ...t, widgets: [...t.widgets, w], layout: [...t.layout, best] };
            }

            // 2) No gap: split the smallest element in half (orientation by larger side).
            const baseIdx = t.layout
              .map((it, i) => ({ it, i, area: it.w * it.h }))
              .sort((a, b) => a.area - b.area || b.it.x - a.it.x || b.it.y - a.it.y)[0].i;
            const base = { ...t.layout[baseIdx] };
            const nextLayout = t.layout.map((it) => ({ ...it }));

            let added: Layout;
            // Prefer side-by-side split in wide areas, stack split in tall/narrow areas.
            const isWideArea = (base.w / Math.max(1, base.h)) >= 0.75;
            if (isWideArea && base.w >= 4) {
              // split vertically (left/right)
              const w1 = Math.max(2, Math.floor(base.w / 2));
              const w2 = Math.max(2, base.w - w1);
              nextLayout[baseIdx] = { ...base, w: w1 };
              added = { i: w.id, x: base.x + w1, y: base.y, w: w2, h: base.h };
            } else {
              // split horizontally (top/bottom)
              const h1 = Math.max(3, Math.floor(base.h / 2));
              const h2 = Math.max(3, base.h - h1);
              nextLayout[baseIdx] = { ...base, h: h1 };
              added = { i: w.id, x: base.x, y: base.y + h1, w: base.w, h: h2 };
            }

            return { ...t, widgets: [...t.widgets, w], layout: [...nextLayout, added] };
          }),
        })),

      removeWidget: (tabId, widgetId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            return {
              ...t,
              widgets: t.widgets.filter((w) => w.id !== widgetId),
              layout: t.layout.filter((l) => l.i !== widgetId),
            };
          }),
        })),

      updateWidgetConfig: (tabId, widgetId, config) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            return {
              ...t,
              widgets: t.widgets.map((w) => {
                if (w.id !== widgetId) return w;
                const cleaned = Object.fromEntries(
                  Object.entries(config).filter(([, v]) => typeof v === "string")
                ) as Record<string, string>;
                return { ...w, config: { ...w.config, ...cleaned } };
              }),
            };
          }),
        })),

      updateLayout: (tabId, layout) =>
        set((s) => ({ tabs: s.tabs.map((t) => t.id === tabId ? { ...t, layout } : t) })),

      activeTab: () => {
        const s = get();
        return s.tabs.find((t) => t.id === s.activeTabId);
      },

      resolveSymbol: (tabId, widgetId, fallback = "SPY") => {
        const s = get();
        const tab = s.tabs.find((t) => t.id === tabId);
        if (!tab) return fallback;

        const widget = tab.widgets.find((w) => w.id === widgetId);
        const globalSymbols = tab.globalSymbols ?? [];

        if (globalSymbols.length > 0 && widget) {
          // Apply override across all widgets by position
          const pos = tab.widgets.findIndex((w) => w.id === widgetId);
          const sym = globalSymbols.length === 1 ? globalSymbols[0] : (globalSymbols[pos] ?? globalSymbols[0]);
          if (sym) return sym.toUpperCase();
        }

        return (widget?.config?.symbol || fallback).toUpperCase();
      },
    }),
    {
      name: "crystalball-dashboard-v4", // v4: simplified theme (mode/bull/bear only)
      partialize: (s) => ({ theme: s.theme, tabs: s.tabs, activeTabId: s.activeTabId }),
      // Migrate old tabs that don't have globalSymbols
      merge: (persisted: any, current) => {
        if (!persisted) return current;
        // Migrate theme: drop old keys, keep only mode/bull/bear
        const rawTheme = persisted.theme ?? {};
        const theme: ThemeColors = {
          mode: rawTheme.mode ?? "dark",
          accent: rawTheme.accent ?? DEFAULT_THEME.accent,
          bull: rawTheme.bull ?? DEFAULT_THEME.bull,
          bear: rawTheme.bear ?? DEFAULT_THEME.bear,
        };
        return {
          ...current,
          ...persisted,
          theme,
          tabs: (persisted.tabs ?? []).map((t: any) => ({
            ...t,
            globalSymbols: t.globalSymbols ?? [],
          })),
        };
      },
    }
  )
);
