"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Timeframe = "1s"|"5s"|"1m"|"5m"|"15m"|"30m"|"1h"|"4h"|"1d"|"1w";
const TIMEFRAMES: Timeframe[] = ["1s","5s","1m","5m","15m","30m","1h","4h","1d","1w"];

const TF_MAP: Record<string, string> = {
  "1s":"1Min","5s":"1Min","1m":"1Min","5m":"5Min",
  "15m":"15Min","30m":"30Min","1h":"1Hour","4h":"4Hour",
  "1d":"1Day","1w":"1Week",
};
const BAR_LIMIT: Record<string, number> = {
  "1Min":390,"5Min":390,"15Min":200,"30Min":200,
  "1Hour":200,"4Hour":120,"1Day":252,"1Week":104,
};
// Realtime poll interval per Alpaca timeframe (seconds)
const POLL_INTERVAL: Record<string, number> = {
  "1Min":10,"5Min":20,"15Min":30,"30Min":60,
  "1Hour":120,"4Hour":300,"1Day":300,"1Week":300,
};

interface ChartWidgetProps {
  symbol?: string;
  timeframe?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

type Candle = { time: number; open: number; high: number; low: number; close: number };

export function ChartWidget({
  symbol: initSymbol = "SPY",
  timeframe: initTf = "5m",
  isGlobalOverride,
  onConfigChange,
}: ChartWidgetProps) {
  const [symbol, setSymbol] = useState(initSymbol);
  const [timeframe, setTimeframe] = useState<Timeframe>((initTf as Timeframe) || "5m");
  const [symbolInput, setSymbolInput] = useState(initSymbol);
  const [status, setStatus] = useState<"loading"|"ok"|"error">("loading");
  const [lastPrice, setLastPrice] = useState<number|null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const candlesRef = useRef<Map<number, Candle>>(new Map()); // time → candle cache

  // Sync prop → state when global override changes
  useEffect(() => {
    if (initSymbol && initSymbol !== symbol) {
      setSymbol(initSymbol);
      setSymbolInput(initSymbol);
    }
  }, [initSymbol]);

  // Build chart once
  useEffect(() => {
    if (!containerRef.current) return;
    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current || chartRef.current) return;
      const chart = createChart(containerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#8b8fa8" },
        grid: { vertLines: { color: "#1a1a1a" }, horzLines: { color: "#1a1a1a" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#2a2a2a" },
        timeScale: { borderColor: "#2a2a2a", timeVisible: true, secondsVisible: false },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      const series = chart.addCandlestickSeries({
        upColor: "#00d4aa", downColor: "#ff4d6d",
        borderVisible: false, wickUpColor: "#00d4aa", wickDownColor: "#ff4d6d",
      });
      chartRef.current = chart;
      seriesRef.current = series;

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    });
    return () => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; seriesRef.current = null; }
    };
  }, []);

  // Parse bars from API response into Candle objects
  const parseBars = (bars: any[]): Candle[] =>
    bars
      .filter(b => b?.timestamp && b.open != null)
      .map(b => ({
        time: Math.floor(new Date(b.timestamp).getTime() / 1000),
        open: b.open, high: b.high, low: b.low, close: b.close,
      }))
      .sort((a, b) => a.time - b.time);

  // Full initial load (clears and resets chart)
  const loadFull = useCallback(async (sym: string, tf: Timeframe) => {
    if (!seriesRef.current) return;
    const alpacaTF = TF_MAP[tf] || "5Min";
    const limit = BAR_LIMIT[alpacaTF] || 200;
    setStatus("loading");
    try {
      const r = await fetch(`${API}/api/market/history/${sym}?timeframe=${alpacaTF}&limit=${limit}`);
      const bars = await r.json();
      if (!Array.isArray(bars) || !bars.length || !seriesRef.current) { setStatus("error"); return; }
      const candles = parseBars(bars);
      candlesRef.current = new Map(candles.map(c => [c.time, c]));
      seriesRef.current.setData(candles);
      chartRef.current?.timeScale().fitContent();
      setLastPrice(candles[candles.length - 1]?.close ?? null);
      setStatus("ok");
    } catch { setStatus("error"); }
  }, []);

  // Incremental realtime update — fetch last N bars and upsert
  const updateRealtime = useCallback(async (sym: string, tf: Timeframe) => {
    if (!seriesRef.current || status === "error") return;
    const alpacaTF = TF_MAP[tf] || "5Min";
    try {
      const r = await fetch(`${API}/api/market/history/${sym}?timeframe=${alpacaTF}&limit=5`);
      const bars = await r.json();
      if (!Array.isArray(bars) || !bars.length || !seriesRef.current) return;
      const newCandles = parseBars(bars);
      let changed = false;
      for (const c of newCandles) {
        const existing = candlesRef.current.get(c.time);
        if (!existing || existing.close !== c.close || existing.high !== c.high || existing.low !== c.low) {
          candlesRef.current.set(c.time, c);
          seriesRef.current.update(c);
          changed = true;
        }
      }
      if (changed) {
        const all = [...candlesRef.current.values()].sort((a,b) => a.time - b.time);
        setLastPrice(all[all.length - 1]?.close ?? null);
      }
    } catch { /* silent — polling, don't flash error */ }
  }, [status]);

  // Initial load + realtime polling
  useEffect(() => {
    const alpacaTF = TF_MAP[timeframe] || "5Min";
    const pollMs = (POLL_INTERVAL[alpacaTF] || 30) * 1000;
    let cancelled = false;
    candlesRef.current = new Map();

    const init = async () => {
      // Retry until chart is mounted
      while (!seriesRef.current && !cancelled) {
        await new Promise(r => setTimeout(r, 300));
      }
      if (cancelled) return;
      await loadFull(symbol, timeframe);
      if (cancelled) return;
      // Start polling
      const id = setInterval(() => {
        if (!cancelled) updateRealtime(symbol, timeframe);
      }, pollMs);
      return () => clearInterval(id);
    };

    const cleanup = init();
    return () => {
      cancelled = true;
      cleanup.then(fn => fn?.());
    };
  }, [symbol, timeframe]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
    onConfigChange?.({ symbol: s });
  };

  const handleTimeframe = (tf: Timeframe) => {
    setTimeframe(tf);
    onConfigChange?.({ timeframe: tf });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-surface-border shrink-0 flex-wrap">
        <form onSubmit={handleSymbolSubmit} className="flex items-center gap-1">
          <input
            value={symbolInput}
            onChange={e => setSymbolInput(e.target.value.toUpperCase())}
            disabled={isGlobalOverride}
            title={isGlobalOverride ? "Controlled by global override" : "Enter symbol + Enter"}
            className={`border rounded px-2 py-0.5 text-xs font-mono w-16 focus:outline-none text-white transition
              ${isGlobalOverride
                ? "bg-transparent border-surface-border text-neutral-500 cursor-not-allowed"
                : "bg-surface-overlay border-surface-border focus:border-accent/60"}`}
          />
          {isGlobalOverride && <span className="text-neutral-700 text-xs">⬡</span>}
        </form>

        <div className="flex items-center gap-0.5 flex-wrap">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => handleTimeframe(tf)}
              className={`px-1.5 py-0.5 rounded text-xs font-mono transition ${
                tf === timeframe ? "bg-accent/20 text-accent font-semibold" : "text-neutral-500 hover:text-white"
              }`}>
              {tf}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {status === "ok" && (
            <span className="text-xs text-neutral-700 animate-pulse" title="Realtime updates active">●</span>
          )}
          {lastPrice && <span className="text-xs font-mono text-white">${lastPrice.toFixed(2)}</span>}
          {status === "loading" && <span className="text-xs text-neutral-600 animate-pulse">Loading…</span>}
          {status === "error"   && <span className="text-xs text-bear">Error</span>}
        </div>
      </div>
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  );
}
