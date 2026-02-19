/**
 * ChartWidget — Candlestick chart with VWAP, Volume Profile, RSI, and footprint overlay.
 * Uses TradingView Lightweight Charts (free, open-source).
 *
 * TODO:
 *   - Connect to /api/ws/bars WebSocket for live candle stream
 *   - Implement VWAP calculation from tick data
 *   - Add Volume Profile histogram (right axis)
 *   - Add RSI sub-pane
 *   - Add footprint (bid/ask delta per bar)
 */
"use client";

import React, { useEffect, useRef } from "react";

interface ChartWidgetProps {
  symbol?: string;
}

export function ChartWidget({ symbol = "SPY" }: ChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let chart: unknown = null;

    // Dynamically import to avoid SSR issues
    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current) return;

      chart = createChart(containerRef.current, {
        layout: {
          background: { color: "#141414" },
          textColor: "#8b8fa8",
        },
        grid: {
          vertLines: { color: "#1e1e1e" },
          horzLines: { color: "#1e1e1e" },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#2a2a2a" },
        timeScale: { borderColor: "#2a2a2a", timeVisible: true },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      chartRef.current = chart as typeof chartRef.current;

      const candleSeries = (chart as ReturnType<typeof createChart>).addCandlestickSeries({
        upColor: "#00d4aa",
        downColor: "#ff4d6d",
        borderVisible: false,
        wickUpColor: "#00d4aa",
        wickDownColor: "#ff4d6d",
      });

      // Placeholder data — replace with live Alpaca feed
      const now = Math.floor(Date.now() / 1000);
      const bars = Array.from({ length: 100 }, (_, i) => {
        const t = now - (100 - i) * 300;
        const open = 500 + Math.random() * 10 - 5;
        const close = open + Math.random() * 4 - 2;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        return { time: t as unknown as import("lightweight-charts").Time, open, high, low, close };
      });

      candleSeries.setData(bars);

      // TODO: Add VWAP line series
      // TODO: Add RSI pane
    });

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        (chartRef.current as { applyOptions: (opts: object) => void }).applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });

    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove();
      }
    };
  }, [symbol]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 left-2 z-10 text-xs text-neutral-500 bg-surface-raised/80 px-2 py-1 rounded font-mono">
        {symbol} · 5m
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
