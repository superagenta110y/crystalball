"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { SymbolBar } from "./SymbolBar";
import { useDashboardStore } from "@/lib/store/dashboardStore";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const WINDOW_SEC = 300; // 5 minutes

type Bucket = {
  sec: number;
  x: number;
  tsLabel: string;
  buyVol: number;
  sellVol: number;
  totalVol: number;
  buyPct: number;
  sellPct: number;
  y: number;
  fill: string;
  stroke: string;
};

interface OrderFlowWidgetProps {
  symbol?: string;
  isGlobalOverride?: boolean;
  onConfigChange?: (patch: Record<string, string>) => void;
}

export function OrderFlowWidget({ symbol = "SPY", isGlobalOverride, onConfigChange }: OrderFlowWidgetProps) {
  const { bull, bear } = useDashboardStore(s => s.theme);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const normalizeWindow = (rows: Bucket[]): Bucket[] => {
    const sorted = [...rows].sort((a, b) => a.sec - b.sec).slice(-WINDOW_SEC);
    return sorted.map((r, i) => ({ ...r, x: i }));
  };

  const buildBucket = (sec: number, buyVol: number, sellVol: number): Bucket => {
    const total = buyVol + sellVol;
    const buyPct = total > 0 ? buyVol / total : 0.5;
    const sellPct = total > 0 ? sellVol / total : 0.5;
    const dominance = Math.abs(buyPct - sellPct);
    const neutral = dominance < 0.02;
    const fill = neutral ? "#ffffff" : (buyPct > sellPct ? bull : bear);

    return {
      sec,
      x: 0,
      tsLabel: new Date(sec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      buyVol,
      sellVol,
      totalVol: total,
      buyPct,
      sellPct,
      y: (buyPct - sellPct) * 100,
      fill,
      stroke: neutral ? "#d1d5db" : fill,
    };
  };

  useEffect(() => {
    let closed = false;
    setLoading(true);
    setError(false);
    setBuckets([]);

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
          const rows = d.buckets.map((b: any) => buildBucket(Number(b.sec || 0), Number(b.buy || 0), Number(b.sell || 0)));
          setBuckets(normalizeWindow(rows));
          setLoading(false);
          setError(false);
        } catch {
          setError(true);
          setLoading(false);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!closed) setTimeout(connect, 1200);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [symbol, bull, bear]);

  const maxVol = useMemo(() => Math.max(1, ...buckets.map(b => b.totalVol)), [buckets]);

  return (
    <div className="h-full w-full flex flex-col">
      <SymbolBar
        label="Order Flow"
        mobileLabel="Flow"
        symbol={symbol}
        isGlobalOverride={isGlobalOverride}
        onSymbolChange={s => onConfigChange?.({ symbol: s })}
        extra={<span className="text-xs text-neutral-500">Realtime order bubbles · last 5m</span>}
      />

      <div className="flex-1 min-h-0 p-2 flex flex-col gap-2">
        {loading && <div className="h-full flex items-center justify-center text-xs text-neutral-500 animate-pulse">Loading orderflow…</div>}
        {error && !loading && <div className="h-full flex items-center justify-center text-xs text-neutral-500">Orderflow unavailable</div>}

        {!loading && !error && (
          <>
            <div className="h-[68%] min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="x" type="number" domain={[0, WINDOW_SEC - 1]} hide />
                  <YAxis dataKey="y" type="number" domain={[-100, 100]} tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v)}%`} />
                  <ZAxis dataKey="totalVol" type="number" range={[12, 280]} domain={[0, maxVol]} />
                  <Tooltip content={({ payload }) => {
                    const p = payload?.[0]?.payload as Bucket | undefined;
                    if (!p) return null;
                    return (
                      <div className="bg-surface-overlay border border-surface-border rounded-lg px-3 py-2 text-xs">
                        <div className="text-neutral-400 font-mono">{p.tsLabel}</div>
                        <div className="text-white">Total: {Math.round(p.totalVol).toLocaleString()}</div>
                        <div className="text-bull">Buy: {(p.buyPct * 100).toFixed(1)}%</div>
                        <div className="text-bear">Sell: {(p.sellPct * 100).toFixed(1)}%</div>
                      </div>
                    );
                  }} />
                  <Scatter data={buckets} shape={(props: any) => {
                    const { cx, cy, payload, size } = props;
                    const r = Math.max(4, Math.sqrt(size) * 0.35);
                    return <circle cx={cx} cy={cy} r={r} fill={payload.fill} fillOpacity={0.82} stroke={payload.stroke} strokeWidth={1} />;
                  }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[32%] min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 2, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="x" type="number" domain={[0, WINDOW_SEC - 1]} tickLine={false} axisLine={false} tick={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#8b8fa8" }} tickLine={false} axisLine={false} tickFormatter={(v:number) => v >= 1000 ? `${Math.round(v/1000)}k` : `${Math.round(v)}`} />
                  <Tooltip content={({ payload }) => {
                    const p = payload?.[0]?.payload as Bucket | undefined;
                    if (!p) return null;
                    return <div className="bg-surface-overlay border border-surface-border rounded px-2 py-1 text-xs">{p.tsLabel} · Vol {Math.round(p.totalVol).toLocaleString()}</div>;
                  }} />
                  <Bar dataKey="totalVol" radius={[1, 1, 0, 0]}>
                    {buckets.map((b, i) => <Cell key={i} fill={b.fill === "#ffffff" ? "#cfd4dc" : b.fill} fillOpacity={0.75} />)}
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
