"use client";

import React, { useEffect, useRef, useState } from "react";

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

interface ChartWidgetProps {
  symbol?: string;
  timeframe?: string;
  onConfigChange?: (patch: Record<string, string>) => void;
}

export function ChartWidget({
  symbol: initSymbol = "SPY",
  timeframe: initTf = "5m",
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

  // Fetch data on symbol/timeframe change
  useEffect(() => {
    const alpacaTF = TF_MAP[timeframe] || "5Min";
    const limit = BAR_LIMIT[alpacaTF] || 200;
    let cancelled = false;

    const load = () => {
      if (!seriesRef.current) { setTimeout(load, 300); return; }
      setStatus("loading");
      fetch(`${API}/api/market/history/${symbol}?timeframe=${alpacaTF}&limit=${limit}`)
        .then(r => r.json())
        .then((bars: { timestamp: string; open: number; high: number; low: number; close: number }[]) => {
          if (cancelled || !seriesRef.current || !bars?.length) {
            if (!cancelled) setStatus("error");
            return;
          }
          const candles = bars
            .map(b => ({
              time: Math.floor(new Date(b.timestamp).getTime() / 1000) as any,
              open: b.open, high: b.high, low: b.low, close: b.close,
            }))
            .sort((a, b) => a.time - b.time);
          seriesRef.current.setData(candles);
          chartRef.current?.timeScale().fitContent();
          setLastPrice(candles[candles.length - 1]?.close ?? null);
          setStatus("ok");
        })
        .catch(() => { if (!cancelled) setStatus("error"); });
    };
    load();
    return () => { cancelled = true; };
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
      {/* Per-widget controls */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-surface-border shrink-0 flex-wrap">
        {/* Symbol input */}
        <form onSubmit={handleSymbolSubmit} className="flex items-center gap-1">
          <input
            value={symbolInput}
            onChange={e => setSymbolInput(e.target.value.toUpperCase())}
            className="bg-surface-overlay border border-surface-border rounded px-2 py-0.5 text-xs font-mono w-16 focus:outline-none focus:border-accent/60 text-white"
          />
        </form>
        {/* Timeframe selector */}
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => handleTimeframe(tf)}
              className={`px-1.5 py-0.5 rounded text-xs font-mono transition ${
                tf === timeframe ? "bg-accent/20 text-accent font-semibold" : "text-neutral-500 hover:text-white"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        {/* Status */}
        {lastPrice && (
          <span className="ml-auto text-xs font-mono text-white">${lastPrice.toFixed(2)}</span>
        )}
        {status === "loading" && <span className="ml-auto text-xs text-neutral-600 animate-pulse">Loading…</span>}
        {status === "error" && <span className="ml-auto text-xs text-bear">Error</span>}
      </div>
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  );
}
