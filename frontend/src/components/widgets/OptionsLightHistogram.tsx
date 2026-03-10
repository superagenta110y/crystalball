"use client";

import React, { useEffect, useRef, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip } from "recharts";

type Row = { strike: number; value: number; color: string; meta?: any };

export function OptionsLightHistogram({ rows, valueFormat, statusRender }: {
  rows: Row[];
  valueFormat: (v: number) => string;
  statusRender?: (r: Row) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lwRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const strikeByTimeRef = useRef<Map<number, number>>(new Map());
  const rowByTimeRef = useRef<Map<number, Row>>(new Map());
  const latestRowsRef = useRef<Row[]>([]);
  const [status, setStatus] = useState<string>("");
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setPortrait(r.height > r.width * 1.05);
    });
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (portrait) return;
    let alive = true;
    (async () => {
      if (!lwRef.current) return;
      const mod = await import("lightweight-charts");
      if (!alive || !lwRef.current) return;

      const chart = mod.createChart(lwRef.current, {
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

      const rows0 = latestRowsRef.current || [];
      const data0 = rows0.map((r, i) => {
        const time = i + 1;
        strikeByTimeRef.current.set(time, r.strike);
        rowByTimeRef.current.set(time, r);
        return { time: time as any, value: r.value, color: r.color };
      });
      series.setData(data0);
      chart.timeScale().fitContent();
    })();

    return () => {
      alive = false;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [valueFormat, statusRender, portrait]);

  useEffect(() => {
    latestRowsRef.current = rows;
    if (!seriesRef.current) return;
    const data = rows.map((r, i) => {
      const time = i + 1;
      strikeByTimeRef.current.set(time, r.strike);
      rowByTimeRef.current.set(time, r);
      return { time: time as any, value: r.value, color: r.color };
    });
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [rows]);

  return (
    <div ref={ref} className="h-full w-full relative">
      {status && <div className="absolute left-2 top-2 z-20 text-xs font-mono text-neutral-300">{status}</div>}
      {portrait ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 20, right: 6, bottom: 6, left: 6 }}
            onMouseMove={(s:any) => {
              const row = s?.activePayload?.[0]?.payload as Row | undefined;
              if (!row) { setStatus(""); return; }
              setStatus(statusRender ? statusRender(row) : `Strike ${row.strike} | ${valueFormat(row.value)}`);
            }}
            onMouseLeave={() => setStatus("")}
          >
            <XAxis type="number" tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={valueFormat} />
            <YAxis type="category" dataKey="strike" width={48} tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} />
            <Tooltip content={() => null} cursor={false} wrapperStyle={{ display: "none" }} isAnimationActive={false} />
            <Bar dataKey="value" radius={[0, 2, 2, 0]}>
              {rows.map((r, i) => <Cell key={i} fill={r.color} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div ref={lwRef} className="h-full w-full" />
      )}
    </div>
  );
}
