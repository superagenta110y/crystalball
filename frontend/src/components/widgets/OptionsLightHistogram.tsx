"use client";

import React, { useEffect, useRef, useState } from "react";

type Row = { strike: number; value: number; color: string; meta?: any };

export function OptionsLightHistogram({ rows, valueFormat, statusRender }: {
  rows: Row[];
  valueFormat: (v: number) => string;
  statusRender?: (r: Row) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const strikeByTimeRef = useRef<Map<number, number>>(new Map());
  const rowByTimeRef = useRef<Map<number, Row>>(new Map());
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!ref.current) return;
      const mod = await import("lightweight-charts");
      if (!alive || !ref.current) return;

      const chart = mod.createChart(ref.current, {
        autoSize: true,
        layout: { background: { color: "transparent" }, textColor: "#8b8fa8" },
        grid: { vertLines: { color: "transparent" }, horzLines: { color: "transparent" } },
        rightPriceScale: { borderVisible: false },
        leftPriceScale: { visible: false },
        timeScale: {
          borderVisible: false,
          rightOffset: 2,
          tickMarkFormatter: (t: any) => {
            const ts = Number(t);
            const s = strikeByTimeRef.current.get(ts);
            return s != null ? String(Math.round(s)) : "";
          },
        },
        crosshair: {
          mode: 0,
          vertLine: { color: "#9ca3af66", style: 2, width: 1, labelVisible: true },
          horzLine: { color: "#9ca3af66", style: 2, width: 1, labelVisible: true },
        },
      });

      const series = chart.addHistogramSeries({
        base: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: "custom", formatter: valueFormat },
      });

      chart.subscribeCrosshairMove((p: any) => {
        if (!p?.time) { setStatus(""); return; }
        const t = Number(p.time);
        const r = rowByTimeRef.current.get(t);
        if (!r) { setStatus(""); return; }
        setStatus(statusRender ? statusRender(r) : `Strike ${r.strike} | ${valueFormat(r.value)}`);
      });

      chartRef.current = chart;
      seriesRef.current = series;
    })();

    return () => {
      alive = false;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [valueFormat, statusRender]);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = rows.map((r, i) => {
      const time = i + 1;
      strikeByTimeRef.current.set(time, r.strike);
      rowByTimeRef.current.set(time, r);
      return { time, value: r.value, color: r.color };
    });
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [rows]);

  return (
    <div className="h-full w-full relative">
      {status && <div className="absolute left-2 top-2 z-20 text-xs font-mono text-neutral-300">{status}</div>}
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
