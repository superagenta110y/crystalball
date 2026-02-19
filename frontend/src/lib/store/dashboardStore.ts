import { create } from "zustand";

interface DashboardState {
  symbol: string;
  provider: "alpaca" | "hoodwink";
  setSymbol: (symbol: string) => void;
  setProvider: (provider: "alpaca" | "hoodwink") => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  symbol: "SPY",
  provider: "alpaca",
  setSymbol: (symbol) => set({ symbol: symbol.toUpperCase() }),
  setProvider: (provider) => set({ provider }),
}));
