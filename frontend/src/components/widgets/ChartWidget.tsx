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
// Poll interval per Alpaca TF (ms)
const POLL_MS: Record<string, number> = {
  "1Min":8000,"5Min":15000,"15Min":30000,"30Min":60000,
  "1Hour":120000,"4Hour":300000,"1Day":300000,"1Week":300000,
};

type Bar = { time: number; open: number; high: number; low: number; close: number };

interface ChartWidgetProps {
  symbol?: string;
  timeframe?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

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
  const [isLive, setIsLive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const seriesRef    = useRef<any>(null);
  const cacheRef     = useRef<Map<number, Bar>>(new Map());
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync global override → local state
  useEffect(() => {
    if (initSymbol && initSymbol !== symbol) {
      setSymbol(initSymbol);
      setSymbolInput(initSymbol);
    }
  }, [initSymbol]);

  // Build chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current || chartRef.current) return;
      const chart = createChart(containerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#8b8fa8" },
        grid:   { vertLines: { color: "#1a1a1a" }, horzLines: { color: "#1a1a1a" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#2a2a2a" },
        timeScale: { borderColor: "#2a2a2a", timeVisible: true, secondsVisible: false },
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      // Read bull/bear from CSS variables so theme changes apply
      const bull = getComputedStyle(document.documentElement).getPropertyValue("--bull").trim() || "#00d4aa";
      const bear = getComputedStyle(document.documentElement).getPropertyValue("--bear").trim() || "#ff4d6d";
      const series = chart.addCandlestickSeries({
        upColor: bull, downColor: bear,
        borderVisible: false, wickUpColor: bull, wickDownColor: bear,
      });
      chartRef.current = chart;
      seriesRef.current = series;

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width:  containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    });

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Parse raw bar array → sorted Bar[]
  const parseBars = (raw: any[]): Bar[] =>
    (Array.isArray(raw) ? raw : [])
      .filter(b => b?.timestamp)
      .map(b => ({
        time:  Math.floor(new Date(b.timestamp).getTime() / 1000),
        open:  b.open, high: b.high, low: b.low, close: b.close,
      }))
      .sort((a, b) => a.time - b.time);

  // Full load — clears & repopulates everything
  const loadFull = useCallback(async (sym: string, tf: Timeframe) => {
    const alpacaTF = TF_MAP[tf] || "5Min";
    const limit    = BAR_LIMIT[alpacaTF] || 200;

    // Wait for chart to be ready (first mount race)
    let waited = 0;
    while (!seriesRef.current && waited < 3000) {
      await new Promise(r => setTimeout(r, 150));
      waited += 150;
    }
    if (!seriesRef.current) { setStatus("error"); return; }

    setStatus("loading");
    try {
      const r = await fetch(`${API}/api/market/history/${sym}?timeframe=${alpacaTF}&limit=${limit}`);
      if (!r.ok) throw new Error();
      const bars = parseBars(await r.json());
      if (!bars.length || !seriesRef.current) { setStatus("error"); return; }

      cacheRef.current = new Map(bars.map(b => [b.time, b]));
      seriesRef.current.setData(bars);
      chartRef.current?.timeScale().fitContent();
      setLastPrice(bars[bars.length - 1].close);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  // Incremental update — fetches last 3 bars and upserts changes
  const pollUpdate = useCallback(async (sym: string, tf: Timeframe) => {
    if (!seriesRef.current) return;
    const alpacaTF = TF_MAP[tf] || "5Min";
    try {
      const r = await fetch(`${API}/api/market/history/${sym}?timeframe=${alpacaTF}&limit=3`);
      if (!r.ok) return;
      const bars = parseBars(await r.json());
      if (!bars.length || !seriesRef.current) return;

      for (const bar of bars) {
        const cached = cacheRef.current.get(bar.time);
        if (!cached || cached.close !== bar.close || cached.high !== bar.high || cached.low !== bar.low) {
          cacheRef.current.set(bar.time, bar);
          seriesRef.current.update(bar);   // lightweight-charts upserts by time
        }
      }
      setLastPrice(bars[bars.length - 1].close);
      setIsLive(true);
    } catch { /* silent — don't flicker status on transient errors */ }
  }, []);

  // Main effect: full load then polling
  useEffect(() => {
    // Stop any existing poll
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setIsLive(false);
    cacheRef.current = new Map();

    const alpacaTF = TF_MAP[timeframe] || "5Min";
    const pollMs   = POLL_MS[alpacaTF] || 15000;
    let alive = true;

    loadFull(symbol, timeframe).then(() => {
      if (!alive) return;
      // Kick off polling
      pollRef.current = setInterval(() => pollUpdate(symbol, timeframe), pollMs);
    });

    return () => {
      alive = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [symbol, timeframe, loadFull, pollUpdate]);

  const submitSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
    onConfigChange?.({ symbol: s });
  };

  const setTF = (tf: Timeframe) => {
    setTimeframe(tf);
    onConfigChange?.({ timeframe: tf });
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-surface-border shrink-0 flex-wrap">
        {/* Symbol */}
        <form onSubmit={submitSymbol} className="flex items-center gap-1">
          <input
            value={symbolInput}
            onChange={e => setSymbolInput(e.target.value.toUpperCase())}
            disabled={isGlobalOverride}
            title={isGlobalOverride ? "Controlled by global override" : "Symbol — press Enter"}
            className={`border rounded px-2 py-0.5 text-xs font-mono w-16 focus:outline-none text-white transition
              ${isGlobalOverride
                ? "bg-transparent border-surface-border text-neutral-500 cursor-not-allowed"
                : "bg-surface-overlay border-surface-border focus:border-accent/60"}`}
          />
          {isGlobalOverride && <span className="text-neutral-700 text-xs">⬡</span>}
        </form>

        {/* Timeframes */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTF(tf)}
              className={`px-1.5 py-0.5 rounded text-xs font-mono transition ${
                tf === timeframe
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-neutral-500 hover:text-white"}`}>
              {tf}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="ml-auto flex items-center gap-2">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" title="Live updates active" />}
          {lastPrice && <span className="text-xs font-mono text-white">${lastPrice.toFixed(2)}</span>}
          {status === "loading" && <span className="text-xs text-neutral-600 animate-pulse">Loading…</span>}
          {status === "error"   && <span className="text-xs text-bear">Error</span>}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full min-h-0" />
    </div>
  );
}
