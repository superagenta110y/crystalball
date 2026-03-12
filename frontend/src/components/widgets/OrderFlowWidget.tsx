"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { SymbolBar } from "./SymbolBar";
import { SkeletonBars, SkeletonBubbles } from "./WidgetSkeletons";
import { useDashboardStore } from "@/lib/store/dashboardStore";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const WINDOW_SEC = 300;

type StreamBucket = {
  sec: number;
  buy: number;
  sell: number;
  vol: number;
  price: number;
  imbalance: number;
};

type BubblePoint = {
  id: string;
  sec: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vol: number;
  targetVol: number;
  imbalance: number;
  tsLabel: string;
};

interface OrderFlowWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function OrderFlowWidget({ symbol = "SPY", isGlobalOverride, onConfigChange }: OrderFlowWidgetProps) {
  const { bull, bear } = useDashboardStore((s) => s.theme);
  const [series, setSeries] = useState<StreamBucket[]>([]);
  const [points, setPoints] = useState<BubblePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    setLoading(true);
    setError(false);
    setSeries([]);
    setPoints([]);

    const wsBase = (API && API.trim()) ? API.replace(/^http/, "ws") : window.location.origin.replace(/^http/, "ws");
    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(`${wsBase}/api/ws/orderflow/${symbol}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (d?.ping) return;
          if (d?.type !== "orderflow" || !Array.isArray(d?.buckets)) return;

          const next = (d.buckets as any[])
            .map((b) => ({
              sec: Number(b?.sec || 0),
              buy: Number(b?.buy || 0),
              sell: Number(b?.sell || 0),
              vol: Number(b?.vol || (Number(b?.buy || 0) + Number(b?.sell || 0))),
              price: Number(b?.price || 0),
              imbalance: Number(b?.imbalance || 0),
            }))
            .filter((b) => b.sec > 0 && b.vol > 0 && b.price > 0)
            .sort((a, b) => a.sec - b.sec)
            .slice(-WINDOW_SEC);

          setSeries(next);
          setLoading(false);
          setError(false);
        } catch {
          setError(true);
          setLoading(false);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!closed) setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [symbol]);

  // Retarget points whenever new stream data arrives.
  useEffect(() => {
    if (!series.length) return;
    setPoints((prev) => {
      const map = new Map(prev.map((p) => [p.sec, p]));
      const next: BubblePoint[] = [];
      for (let i = 0; i < series.length; i++) {
        const s = series[i];
        const existing = map.get(s.sec);
        const x = i;
        const tsLabel = new Date(s.sec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        if (existing) {
          next.push({
            ...existing,
            targetX: x,
            targetY: s.price,
            targetVol: s.vol,
            imbalance: s.imbalance,
            tsLabel,
          });
        } else {
          next.push({
            id: `of-${s.sec}`,
            sec: s.sec,
            x: Math.max(0, x - 3),
            y: s.price * 1.001,
            targetX: x,
            targetY: s.price,
            vol: Math.max(1, s.vol * 0.25),
            targetVol: s.vol,
            imbalance: s.imbalance,
            tsLabel,
          });
        }
      }
      return next;
    });
  }, [series]);

  // Animate bubbles so they move and settle into final position.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPoints((prev) => prev.map((p) => {
        const done = Math.abs(p.x - p.targetX) < 0.02 && Math.abs(p.y - p.targetY) < 0.003 && Math.abs(p.vol - p.targetVol) < 0.5;
        if (done) return { ...p, x: p.targetX, y: p.targetY, vol: p.targetVol };
        return {
          ...p,
          x: lerp(p.x, p.targetX, 0.18),
          y: lerp(p.y, p.targetY, 0.18),
          vol: lerp(p.vol, p.targetVol, 0.22),
        };
      }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const xMax = Math.max(1, series.length - 1);
  const [minPrice, maxPrice] = useMemo(() => {
    if (!series.length) return [0, 1];
    const lo = Math.min(...series.map((s) => s.price));
    const hi = Math.max(...series.map((s) => s.price));
    const pad = Math.max(0.03, (hi - lo) * 0.15);
    return [Math.max(0, lo - pad), hi + pad];
  }, [series]);
  const maxVol = useMemo(() => Math.max(1, ...series.map((s) => s.vol)), [series]);

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        label="Order Flow"
        mobileLabel="Flow"
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={(s) => onConfigChange?.({ symbol: s })}
      />

      <div className="flex-1 min-h-0 p-2 flex flex-col gap-2">
        {loading && (
          <div className="h-full grid grid-rows-[2fr_1fr] gap-2">
            <SkeletonBubbles />
            <SkeletonBars />
          </div>
        )}
        {error && !loading && <div className="h-full flex items-center justify-center text-xs text-neutral-500">Orderflow unavailable</div>}

        {!loading && !error && (
          <>
            <div className="h-[68%] min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, xMax]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: "#8b8fa8" }}
                    tickFormatter={(v: number) => {
                      const idx = Math.round(v);
                      const p = points[idx];
                      return p?.tsLabel?.slice(3, 8) || "";
                    }}
                    minTickGap={28}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    domain={[minPrice, maxPrice]}
                    tick={{ fontSize: 9, fill: "#8b8fa8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    width={56}
                  />
                  <ZAxis dataKey="vol" type="number" range={[16, 380]} domain={[0, maxVol]} />
                  <Tooltip
                    content={({ payload }) => {
                      const p = payload?.[0]?.payload as BubblePoint | undefined;
                      if (!p) return null;
                      const buyPct = ((1 + p.imbalance) * 50).toFixed(1);
                      const sellPct = (100 - Number(buyPct)).toFixed(1);
                      return (
                        <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                          <div className="text-neutral-400 font-mono">{p.tsLabel}</div>
                          <div className="text-white">Price: ${p.y.toFixed(2)}</div>
                          <div className="text-white">Vol: {Math.round(p.vol).toLocaleString()}</div>
                          <div className="text-bull">Buy aggr: {buyPct}%</div>
                          <div className="text-bear">Sell aggr: {sellPct}%</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={points}
                    isAnimationActive={false}
                    shape={(props: any) => {
                      const { cx, cy, payload, size } = props;
                      const p = payload as BubblePoint;
                      const r = Math.max(4, Math.sqrt(size) * 0.34);
                      const t = Math.max(-1, Math.min(1, p.imbalance || 0));
                      const fill = t >= 0 ? bull : bear;
                      const opacity = 0.35 + Math.abs(t) * 0.45;
                      return <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={opacity} stroke={fill} strokeWidth={1} />;
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[32%] min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.map((s, i) => ({ ...s, x: i }))} margin={{ top: 2, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="x" type="number" domain={[0, xMax]} tickLine={false} axisLine={false} tick={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v:number) => v >= 1000 ? `${Math.round(v/1000)}k` : `${Math.round(v)}`} width={40} />
                  <Tooltip
                    content={({ payload }) => {
                      const p = payload?.[0]?.payload as (StreamBucket & { x: number }) | undefined;
                      if (!p) return null;
                      const tsLabel = new Date(p.sec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                      return <div className="bg-surface-overlay border border-surface-border rounded px-2 py-1 text-xs">{tsLabel} · Vol {Math.round(p.vol).toLocaleString()}</div>;
                    }}
                  />
                  <Bar dataKey="vol" radius={[1, 1, 0, 0]}>
                    {series.map((b, i) => {
                      const t = Math.max(-1, Math.min(1, b.imbalance || 0));
                      const fill = t >= 0 ? bull : bear;
                      return <Cell key={i} fill={fill} fillOpacity={0.35 + Math.abs(t) * 0.5} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
