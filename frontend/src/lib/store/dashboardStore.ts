import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Layout } from "react-grid-layout";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetType =
  | "chart" | "orderflow" | "openinterest" | "openinterest3d"
  | "gex" | "dex" | "newsfeed" | "bloomberg" | "ai" | "report";

export interface WidgetInstance {
  id: string;           // unique UUID — used as layout `i`
  type: WidgetType;
  config: Record<string, string>; // e.g. { symbol: "QQQ", timeframe: "1d" }
}

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
  widgets: WidgetInstance[];
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

  addWidget: (tabId: string, type: WidgetType, config?: Record<string, string>) => void;
  removeWidget: (tabId: string, widgetId: string) => void;
  updateWidgetConfig: (tabId: string, widgetId: string, config: Partial<Record<string, string>>) => void;
  updateLayout: (tabId: string, layout: Layout[]) => void;

  activeTab: () => DashboardTab | undefined;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: ThemeColors = {
  bull: "#00d4aa", bear: "#ff4d6d", accent: "#00d4aa",
  background: "#0d0d0d", surface: "#141414", border: "#2a2a2a",
};

function uuid(): string {
  // Polyfill for environments without crypto.randomUUID
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
    [0,0,8,14], [8,0,4,7], [8,7,4,7],
    [0,14,6,8], [6,14,6,8],
    [0,22,4,9], [4,22,4,9], [8,22,4,9],
  ];
  return widgets.map((w, i) => {
    const [x, y, w_, h] = positions[i] ?? [0, (i * 7), 6, 7];
    return { i: w.id, x, y, w: w_, h };
  });
}

function makeDefaultTab(name: string): DashboardTab {
  const widgets: WidgetInstance[] = [
    makeWidget("chart"),
    makeWidget("orderflow"),
    makeWidget("gex"),
    makeWidget("openinterest"),
    makeWidget("dex"),
    makeWidget("newsfeed"),
    makeWidget("ai"),
    makeWidget("report"),
  ];
  return { id: uuid(), name, layout: makeDefaultLayout(widgets), widgets };
}

// ─── Store ────────────────────────────────────────────────────────────────────

const INITIAL_TAB = makeDefaultTab("Main");

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      theme: DEFAULT_THEME,
      tabs: [INITIAL_TAB],
      activeTabId: INITIAL_TAB.id,

      setTheme: (patch) => set((s) => ({ theme: { ...s.theme, ...patch } })),

      addTab: (name) => {
        const tab = makeDefaultTab(name ?? `Tab ${get().tabs.length + 1}`);
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

      addWidget: (tabId, type, config) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const w = makeWidget(type, config);
            const maxY = t.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
            const layout: Layout = { i: w.id, x: 0, y: maxY, w: 6, h: 8 };
            return { ...t, widgets: [...t.widgets, w], layout: [...t.layout, layout] };
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
              widgets: t.widgets.map((w) =>
                w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
              ),
            };
          }),
        })),

      updateLayout: (tabId, layout) =>
        set((s) => ({ tabs: s.tabs.map((t) => t.id === tabId ? { ...t, layout } : t) })),

      activeTab: () => {
        const s = get();
        return s.tabs.find((t) => t.id === s.activeTabId);
      },
    }),
    {
      name: "crystalball-dashboard-v2",
      partialize: (s) => ({ theme: s.theme, tabs: s.tabs, activeTabId: s.activeTabId }),
    }
  )
);
