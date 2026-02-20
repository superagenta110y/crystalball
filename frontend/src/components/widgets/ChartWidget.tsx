"use client";

import React, { useEffect, useRef, useState } from "react";

interface ChartWidgetProps {
  symbol?: string;
  timeframe?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Map dashboard timeframe → Alpaca timeframe param
const TF_MAP: Record<string, string> = {
  "1s":  "1Min", "5s":  "1Min",
  "1m":  "1Min", "5m":  "5Min",
  "15m": "15Min","30m": "30Min",
  "1h":  "1Hour","4h":  "4Hour",
  "1d":  "1Day", "1w":  "1Week",
};

const BAR_LIMIT: Record<string, number> = {
  "1Min": 390, "5Min": 390, "15Min": 200,
  "30Min": 200, "1Hour": 200, "4Hour": 120,
  "1Day": 252, "1Week": 104,
};

export function ChartWidget({ symbol = "SPY", timeframe = "5m" }: ChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  // Build chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current || chartRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#8b8fa8" },
        grid: { vertLines: { color: "#1a1a1a" }, horzLines: { color: "#1a1a1a" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#2a2a2a" },
        timeScale: {
          borderColor: "#2a2a2a",
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter: (time: number) => {
            const d = new Date(time * 1000);
            return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
          },
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const series = chart.addCandlestickSeries({
        upColor: "#00d4aa",
        downColor: "#ff4d6d",
        borderVisible: false,
        wickUpColor: "#00d4aa",
        wickDownColor: "#ff4d6d",
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

  // Fetch data whenever symbol or timeframe changes
  useEffect(() => {
    const alpacaTF = TF_MAP[timeframe] || "5Min";
    const limit = BAR_LIMIT[alpacaTF] || 200;
    let cancelled = false;

    const load = () => {
      if (!seriesRef.current) {
        // Chart initialising — retry shortly
        setTimeout(load, 300);
        return;
      }
      setStatus("loading");
      fetch(`${API}/api/market/history/${symbol}?timeframe=${alpacaTF}&limit=${limit}`)
        .then((r) => r.json())
        .then((bars: { timestamp: string; open: number; high: number; low: number; close: number }[]) => {
          if (cancelled || !seriesRef.current || !bars?.length) { if (!cancelled) setStatus("error"); return; }
          const candles = bars
            .map((b) => ({
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

  return (
    <div className="relative h-full w-full bg-transparent">
      {/* Header overlay */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <span className="text-xs font-mono text-neutral-400 bg-surface-raised/90 px-2 py-0.5 rounded">
          {symbol} · {timeframe}
        </span>
        {lastPrice && (
          <span className="text-xs font-mono text-white bg-surface-raised/90 px-2 py-0.5 rounded">
            ${lastPrice.toFixed(2)}
          </span>
        )}
        {status === "loading" && (
          <span className="text-xs text-neutral-600 bg-surface-raised/90 px-2 py-0.5 rounded animate-pulse">
            Loading…
          </span>
        )}
        {status === "error" && (
          <span className="text-xs text-bear bg-surface-raised/90 px-2 py-0.5 rounded">
            Error — backend offline?
          </span>
        )}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
