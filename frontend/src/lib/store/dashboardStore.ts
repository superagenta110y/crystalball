import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Layout } from "react-grid-layout";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Timeframe = "1s" | "5s" | "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export interface ThemeColors {
  bull: string;
  bear: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
}

export interface DashboardTab {
  id: string;
  name: string;
  layout: Layout[];
  activeWidgets: string[];
}

export interface DashboardState {
  // Global
  symbol: string;
  timeframe: Timeframe;
  theme: ThemeColors;

  // Tabs
  tabs: DashboardTab[];
  activeTabId: string;

  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setTheme: (theme: Partial<ThemeColors>) => void;

  addTab: (name?: string) => void;
  removeTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setActiveTab: (id: string) => void;

  updateLayout: (tabId: string, layout: Layout[]) => void;
  toggleWidget: (tabId: string, widgetId: string) => void;
  addWidget: (tabId: string, widgetId: string) => void;
  removeWidget: (tabId: string, widgetId: string) => void;

  // Derived helper
  activeTab: () => DashboardTab | undefined;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: ThemeColors = {
  bull:       "#00d4aa",
  bear:       "#ff4d6d",
  accent:     "#00d4aa",
  background: "#0d0d0d",
  surface:    "#141414",
  border:     "#2a2a2a",
};

const DEFAULT_LAYOUT: Layout[] = [
  { i: "chart",         x: 0,  y: 0,  w: 8, h: 14 },
  { i: "orderflow",     x: 8,  y: 0,  w: 4, h: 7  },
  { i: "gex",           x: 8,  y: 7,  w: 4, h: 7  },
  { i: "openinterest",  x: 0,  y: 14, w: 6, h: 7  },
  { i: "dex",           x: 6,  y: 14, w: 6, h: 7  },
  { i: "newsfeed",      x: 0,  y: 21, w: 4, h: 9  },
  { i: "ai",            x: 4,  y: 21, w: 4, h: 9  },
  { i: "report",        x: 8,  y: 21, w: 4, h: 9  },
];

const DEFAULT_WIDGETS = DEFAULT_LAYOUT.map((l) => l.i);

function makeTab(name: string, id?: string): DashboardTab {
  return {
    id: id ?? crypto.randomUUID(),
    name,
    layout: DEFAULT_LAYOUT,
    activeWidgets: DEFAULT_WIDGETS,
  };
}

const INITIAL_TAB = makeTab("Main", "tab-main");

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      symbol: "SPY",
      timeframe: "5m",
      theme: DEFAULT_THEME,
      tabs: [INITIAL_TAB],
      activeTabId: INITIAL_TAB.id,

      setSymbol: (symbol) => set({ symbol: symbol.toUpperCase() }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setTheme: (patch) => set((s) => ({ theme: { ...s.theme, ...patch } })),

      addTab: (name) => {
        const tab = makeTab(name ?? `Tab ${get().tabs.length + 1}`);
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
      },

      removeTab: (id) => {
        const tabs = get().tabs.filter((t) => t.id !== id);
        if (tabs.length === 0) return;
        const activeTabId = get().activeTabId === id ? tabs[0].id : get().activeTabId;
        set({ tabs, activeTabId });
      },

      renameTab: (id, name) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, name } : t)) })),

      setActiveTab: (id) => set({ activeTabId: id }),

      updateLayout: (tabId, layout) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, layout } : t)),
        })),

      toggleWidget: (tabId, widgetId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const has = t.activeWidgets.includes(widgetId);
            return {
              ...t,
              activeWidgets: has
                ? t.activeWidgets.filter((w) => w !== widgetId)
                : [...t.activeWidgets, widgetId],
            };
          }),
        })),

      addWidget: (tabId, widgetId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId || t.activeWidgets.includes(widgetId)) return t;
            // Place new widget at bottom
            const maxY = t.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
            const newLayout: Layout = { i: widgetId, x: 0, y: maxY, w: 6, h: 7 };
            return {
              ...t,
              activeWidgets: [...t.activeWidgets, widgetId],
              layout: [...t.layout, newLayout],
            };
          }),
        })),

      removeWidget: (tabId, widgetId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            return {
              ...t,
              activeWidgets: t.activeWidgets.filter((w) => w !== widgetId),
            };
          }),
        })),

      activeTab: () => {
        const s = get();
        return s.tabs.find((t) => t.id === s.activeTabId);
      },
    }),
    {
      name: "crystalball-dashboard",
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        theme: s.theme,
        tabs: s.tabs,
        activeTabId: s.activeTabId,
      }),
    }
  )
);
