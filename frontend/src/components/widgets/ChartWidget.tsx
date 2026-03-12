"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { SlidersHorizontal, Settings2, CircleHelp, X, GripHorizontal, Clock3 } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";
import { AppColorPicker } from "@/components/ui/AppColorPicker";
import { AppDropdown } from "@/components/ui/AppDropdown";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type Timeframe = "1s"|"5s"|"1m"|"5m"|"15m"|"30m"|"1h"|"4h"|"1d"|"1w";
const TIMEFRAMES: Timeframe[] = ["1s","5s","1m","5m","15m","30m","1h","4h","1d","1w"];

const TF_MAP: Record<string, string> = {
  "1s":"1Min","5s":"1Min","1m":"1Min","5m":"5Min",
  "15m":"15Min","30m":"30Min","1h":"1Hour","4h":"4Hour",
  "1d":"1Day","1w":"1Week",
};
const BAR_LIMIT: Record<string, number> = {
  // keep enough intraday bars to include full pre/post sessions around current day
  "1Min":1600,
  "5Min":1200,
  "15Min":700,
  "30Min":500,
  "1Hour":500,
  "4Hour":300,
  "1Day":756,
  "1Week":260,
};
// Poll interval per Alpaca TF (ms)
const POLL_MS: Record<string, number> = {
  "1Min":8000,"5Min":15000,"15Min":30000,"30Min":60000,
  "1Hour":120000,"4Hour":300000,"1Day":300000,"1Week":300000,
};

type Bar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

const toRgba = (hex: string, alpha: number) => {
  const h = (hex || "").trim().replace("#", "");
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <button type="button" className="text-neutral-500 hover:text-white">
        <CircleHelp size={12} />
      </button>
      <span className="pointer-events-none absolute left-0 top-5 z-50 hidden w-48 rounded border border-surface-border bg-surface-overlay px-2 py-1 text-[10px] text-neutral-300 group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

function LabelWithHelp({ label, help }: { label: string; help: string }) {
  return <span className="inline-flex items-center gap-1 text-left">{label} <HelpTip text={help} /></span>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${checked ? "bg-accent" : "bg-surface-border"}`}
      aria-pressed={checked}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}


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
  const [barStatus, setBarStatus] = useState<string>("");
  const [crosshairActive, setCrosshairActive] = useState(false);
  const [hoverBar, setHoverBar] = useState<Bar | null>(null);
  const [hoverCvd, setHoverCvd] = useState<number | null>(null);
  const [indicatorModal, setIndicatorModal] = useState<null | "sma" | "ema" | "bb" | "levels" | "vp" | "vwap" | "cvd">(null);
  const [indSMA, setIndSMA] = useState(false);
  const [indEMA, setIndEMA] = useState(false);
  const [indVWAP, setIndVWAP] = useState(false);
  const [indBB, setIndBB] = useState(false);
  const [indLevels, setIndLevels] = useState(false);
  const [indVP, setIndVP] = useState(false);
  const [indCVD, setIndCVD] = useState(false);
  const [cvdAnchor, setCvdAnchor] = useState<"auto"|"day"|"week"|"month"|"year">("auto");
  const [smaFastPeriod, setSmaFastPeriod] = useState(20);
  const [smaFastColor, setSmaFastColor] = useState("#60a5fa");
  const [smaFastWidth, setSmaFastWidth] = useState(1);
  const [smaSlowPeriod, setSmaSlowPeriod] = useState(50);
  const [smaSlowColor, setSmaSlowColor] = useState("#2563eb");
  const [smaSlowWidth, setSmaSlowWidth] = useState(1);
  const [emaFastPeriod, setEmaFastPeriod] = useState(12);
  const [emaFastColor, setEmaFastColor] = useState("#f59e0b");
  const [emaFastWidth, setEmaFastWidth] = useState(1);
  const [emaSlowPeriod, setEmaSlowPeriod] = useState(26);
  const [emaSlowColor, setEmaSlowColor] = useState("#b45309");
  const [emaSlowWidth, setEmaSlowWidth] = useState(1);
  const [vwapColor, setVwapColor] = useState("#a78bfa");
  const [vwapWidth, setVwapWidth] = useState(1);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStd, setBbStd] = useState(2);
  const [bbColor, setBbColor] = useState("#22d3ee");
  const [bbWidth, setBbWidth] = useState(1);
  const [levelColor, setLevelColor] = useState("#94a3b8");
  const [levelWidth, setLevelWidth] = useState(1);
  const [showPrevClose, setShowPrevClose] = useState(true);
  const [showDayHighLow, setShowDayHighLow] = useState(true);
  const [showPremarketHighLow, setShowPremarketHighLow] = useState(false);
  const [vpColor, setVpColor] = useState("#e879f9");
  const [vpWidth, setVpWidth] = useState(2);
  const [vwapAnchor, setVwapAnchor] = useState<"auto"|"day"|"week"|"month"|"year">("auto");
  const [vpAnchor, setVpAnchor] = useState<"auto"|"day"|"week"|"month"|"year">("auto");

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<any>(null);
  const seriesRef     = useRef<any>(null);
  const volumeRef     = useRef<any>(null);
  const extShadeRef   = useRef<any>(null);
  const cacheRef      = useRef<Map<number, Bar>>(new Map());
  const cvdMapRef     = useRef<Map<number, number>>(new Map());
  const indicatorSeriesRef = useRef<any[]>([]);
  const levelLinesRef = useRef<any[]>([]);
  const historyLimitRef = useRef<number>(0);
  const loadingMoreRef = useRef<boolean>(false);
  const noMoreOlderRef = useRef<boolean>(false);
  const pendingRangeRef = useRef<{ from: number; to: number; targetTf: Timeframe } | null>(null);

  const [symItems, setSymItems] = useState<{ symbol: string; name?: string }[]>([]);
  const [chartReady, setChartReady] = useState(false);
  const [tfOpen, setTfOpen] = useState(false);
  const [symOpen, setSymOpen] = useState(false);
  const symRef = useRef<HTMLDivElement>(null);
  const tfRef = useRef<HTMLDivElement>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef        = useRef<WebSocket | null>(null);
  const loadFullRef  = useRef<any>(null);
  const pollUpdateRef = useRef<any>(null);

  // Subscribe to theme — update chart colours whenever bull/bear/mode changes
  const theme = useDashboardStore(s => s.theme);
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim();
    const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim();
    const gridLine = getComputedStyle(document.documentElement).getPropertyValue("--grid-line").trim() || "#1e1e1e";
    const axisText = getComputedStyle(document.documentElement).getPropertyValue("--chart-text").trim()|| "#8b8fa8";
    seriesRef.current.applyOptions({
      upColor: bull, downColor: bear,
      wickUpColor: bull, wickDownColor: bear,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    if (volumeRef.current) {
      volumeRef.current.applyOptions({
        priceLineVisible: false,
        lastValueVisible: false,
      });
      volumeRef.current.priceScale().applyOptions({
        scaleMargins: indCVD ? { top: 0.62, bottom: 0.22 } : { top: 0.8, bottom: 0 },
      });
      const bars = Array.from(cacheRef.current.values()).sort((a, b) => a.time - b.time);
      volumeRef.current.setData(
        bars.map(b => ({
          time: b.time,
          value: b.volume || 0,
          color: b.close >= b.open ? toRgba(bull, 0.5) : toRgba(bear, 0.5),
        }))
      );
    }
    if (extShadeRef.current) {
      extShadeRef.current.applyOptions({
        topColor: theme.mode === "light" ? "rgba(115,115,115,0.18)" : "rgba(120,120,120,0.34)",
        bottomColor: "rgba(0,0,0,0)",
      });
    }
    chartRef.current.applyOptions({
      grid: { vertLines: { color: gridLine }, horzLines: { color: gridLine } },
      layout: { textColor: axisText },
      rightPriceScale: { borderColor: "transparent" },
      timeScale: { borderColor: "transparent" },
    });
  }, [theme.bull, theme.bear, theme.mode, indCVD]);

  // Sync global override → local state
  useEffect(() => {
    if (initSymbol && initSymbol !== symbol) {
      setSymbol(initSymbol);
      setSymbolInput(initSymbol);
    }
  }, [initSymbol]);

  useEffect(() => {
    if (isGlobalOverride) return;
    const q = symbolInput.trim();
    if (!q) { setSymItems([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/market/symbols?q=${encodeURIComponent(q)}&limit=10`)
        .then(r => r.json())
        .then(d => setSymItems(d?.items || []))
        .catch(() => setSymItems([]));
    }, 100);
    return () => clearTimeout(t);
  }, [symbolInput, isGlobalOverride]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (symRef.current && !symRef.current.contains(e.target as Node)) setSymOpen(false);
      if (tfRef.current && !tfRef.current.contains(e.target as Node)) setTfOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [symbol]);

  // Build chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    import("lightweight-charts").then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current || chartRef.current) return;
      const chart = createChart(containerRef.current, {
        layout: { background: { color: "transparent" }, textColor: "#8b8fa8" },
        grid:   { vertLines: { color: "transparent" }, horzLines: { color: "transparent" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "transparent" },
        timeScale: { borderColor: "transparent", timeVisible: true, secondsVisible: false },
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      // Read bull/bear from CSS variables so theme changes apply
      const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim() || "#00d4aa";
      const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim() || "#ff4d6d";
      const series = chart.addCandlestickSeries({
        upColor: bull, downColor: bear,
        borderVisible: false, wickUpColor: bull, wickDownColor: bear,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const extShadeSeries = chart.addAreaSeries({
        priceScaleId: "session-bg",
        lineColor: "transparent",
        lineWidth: 1,
        topColor: theme.mode === "light" ? "rgba(115,115,115,0.18)" : "rgba(120,120,120,0.34)",
        bottomColor: "rgba(0,0,0,0)",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("session-bg").applyOptions({
        visible: false,
        scaleMargins: { top: 0, bottom: 0 },
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      chartRef.current = chart;
      seriesRef.current = series;
      volumeRef.current = volumeSeries;
      extShadeRef.current = extShadeSeries;
      setChartReady(true);

      chart.subscribeCrosshairMove((param: any) => {
        const p = param?.point;
        if (!p || p.x < 0 || p.y < 0 || !containerRef.current) {
          setCrosshairActive(false);
          setHoverBar(null);
          setHoverCvd(null);
          return;
        }
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (p.x > w || p.y > h) {
          setCrosshairActive(false);
          setHoverBar(null);
          setHoverCvd(null);
          return;
        }

        const t = param?.time;
        let ts = 0;
        if (typeof t === "number") ts = t;
        else if (t && typeof t === "object" && "year" in t) {
          ts = Math.floor(Date.UTC(t.year, (t.month || 1) - 1, t.day || 1) / 1000);
        }
        if (!ts) {
          setCrosshairActive(false);
          return;
        }

        const b = cacheRef.current.get(ts);
        if (!b) {
          setCrosshairActive(false);
          return;
        }
        setHoverBar(b);
        setHoverCvd(cvdMapRef.current.get(ts) ?? null);
        setCrosshairActive(true);
      });

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
      setChartReady(false);
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      extShadeRef.current = null;
      indicatorSeriesRef.current = [];
      levelLinesRef.current = [];
    };
  }, []);

  // Parse raw bar array (or paged payload) → sorted Bar[]
  const parseBars = (raw: any): Bar[] => {
    const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.bars) ? raw.bars : (Array.isArray(raw?.b) ? raw.b : []));
    return (Array.isArray(arr) ? arr : [])
      .filter(b => b?.timestamp || b?.ts)
      .map(b => ({
        time:  Math.floor(new Date(b.timestamp || b.ts).getTime() / 1000),
        open:  Number(b.open ?? b.o), high: Number(b.high ?? b.h), low: Number(b.low ?? b.l), close: Number(b.close ?? b.c),
        volume: Number((b.volume ?? b.v) || 0),
      }))
      .sort((a, b) => a.time - b.time);
  };

  const rebuildCvdMap = useCallback((bars: Bar[]) => {
    let cvd = 0;
    const m = new Map<number, number>();
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const prev = bars[Math.max(0, i - 1)]?.close ?? b.open;
      const delta = b.close >= prev ? (b.volume || 0) : -(b.volume || 0);
      cvd += delta;
      m.set(b.time, cvd);
    }
    cvdMapRef.current = m;
  }, []);

  const clearIndicators = useCallback(() => {
    if (!chartRef.current) return;
    indicatorSeriesRef.current.forEach((s: any) => { try { chartRef.current.removeSeries(s); } catch {} });
    levelLinesRef.current.forEach((l: any) => { try { chartRef.current.removeSeries(l); } catch {} });
    indicatorSeriesRef.current = [];
    levelLinesRef.current = [];
  }, []);

  const computeSMA = (bars: Bar[], period: number) => bars.map((b, i) => {
    if (i < period - 1) return null;
    const seg = bars.slice(i - period + 1, i + 1);
    const v = seg.reduce((s, x) => s + x.close, 0) / period;
    return { time: b.time, value: v };
  }).filter(Boolean) as any[];

  const computeEMA = (bars: Bar[], period: number) => {
    const k = 2 / (period + 1); let ema = 0; const out: any[] = [];
    bars.forEach((b, i) => { ema = i === 0 ? b.close : (b.close * k + ema * (1 - k)); out.push({ time: b.time, value: ema }); });
    return out;
  };

  const drawIndicators = useCallback((bars: Bar[]) => {
    if (!chartRef.current) return;
    clearIndicators();

    const resolveAnchor = (a: "auto"|"day"|"week"|"month"|"year") => {
      if (a !== "auto") return a;
      if (timeframe === "1d") return "month";
      if (timeframe === "1w") return "year";
      return "day";
    };
    const anchorBars = (src: Bar[], a: "auto"|"day"|"week"|"month"|"year") => {
      const mode = resolveAnchor(a);
      const last = src[src.length - 1];
      if (!last) return src;
      const d = new Date(last.time * 1000);
      let start = 0;
      if (mode === "day") {
        start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
      } else if (mode === "week") {
        const w = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const day = (w.getUTCDay() + 6) % 7;
        w.setUTCDate(w.getUTCDate() - day);
        start = w.getTime() / 1000;
      } else if (mode === "month") {
        start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
      } else {
        start = Date.UTC(d.getUTCFullYear(), 0, 1) / 1000;
      }
      const anchored = src.filter(b => b.time >= start);
      return anchored.length ? anchored : src;
    };
    const addLine = (data:any[], color:string, width=1, dashed=false) => {
      const s = chartRef.current.addLineSeries({ color, lineWidth: width, lineStyle: dashed ? 2 : 0, priceLineVisible: false, lastValueVisible: false });
      s.setData(data); indicatorSeriesRef.current.push(s);
    };

    if (indSMA) {
      addLine(computeSMA(bars, Math.max(2, smaFastPeriod)), smaFastColor, Math.max(1, smaFastWidth));
      addLine(computeSMA(bars, Math.max(2, smaSlowPeriod)), smaSlowColor, Math.max(1, smaSlowWidth));
    }
    if (indEMA) {
      addLine(computeEMA(bars, Math.max(2, emaFastPeriod)), emaFastColor, Math.max(1, emaFastWidth));
      addLine(computeEMA(bars, Math.max(2, emaSlowPeriod)), emaSlowColor, Math.max(1, emaSlowWidth));
    }
    if (indVWAP) {
      const src = anchorBars(bars, vwapAnchor);
      let pv = 0, vv = 0;
      const d = src.map(b => { pv += ((b.high+b.low+b.close)/3)*(b.volume||0); vv += (b.volume||0); return { time:b.time, value: vv? pv/vv : b.close }; });
      addLine(d, vwapColor, Math.max(1, vwapWidth));
    }
    if (indBB) {
      const p = Math.max(2, bbPeriod); const s = Math.max(0.5, bbStd);
      const mid = computeSMA(bars, p);
      const upper:any[] = []; const lower:any[] = [];
      bars.forEach((b, i) => {
        if (i < p - 1) return;
        const seg = bars.slice(i - p + 1, i + 1);
        const m = seg.reduce((x,y)=>x+y.close,0)/p;
        const sd = Math.sqrt(seg.reduce((x,y)=>x+Math.pow(y.close-m,2),0)/p);
        upper.push({ time:b.time, value:m + s*sd }); lower.push({ time:b.time, value:m - s*sd });
      });
      addLine(mid, bbColor, Math.max(1, bbWidth)); addLine(upper, bbColor, Math.max(1, bbWidth), true); addLine(lower, bbColor, Math.max(1, bbWidth), true);
    }
    if (indLevels && bars.length) {
      const prevClose = bars[Math.max(0, bars.length - 2)]?.close ?? bars[bars.length - 1].close;
      const dayHigh = Math.max(...bars.map(b=>b.high));
      const dayLow = Math.min(...bars.map(b=>b.low));
      const pre = bars.filter(b => {
        const d = new Date(b.time * 1000).toLocaleString("en-US", { timeZone: "America/New_York" });
        const dt = new Date(d);
        const min = dt.getHours() * 60 + dt.getMinutes();
        return min >= 240 && min < 570;
      });
      const preHigh = pre.length ? Math.max(...pre.map(b=>b.high)) : null;
      const preLow = pre.length ? Math.min(...pre.map(b=>b.low)) : null;

      const values: number[] = [];
      if (showPrevClose) values.push(prevClose);
      if (showDayHighLow) values.push(dayHigh, dayLow);
      if (showPremarketHighLow && preHigh != null && preLow != null) values.push(preHigh, preLow);

      values.forEach((v) => {
        const s = chartRef.current.addLineSeries({ color: levelColor, lineWidth: Math.max(1, levelWidth), lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData([{ time: bars[0].time, value: v }, { time: bars[bars.length - 1].time, value: v }]);
        levelLinesRef.current.push(s);
      });
    }
    if (indVP && bars.length) {
      const src = anchorBars(bars, vpAnchor);
      const poc = src.reduce((best, b) => (b.volume||0) > (best.volume||0) ? b : best, src[0]).close;
      const s = chartRef.current.addLineSeries({ color: vpColor, lineWidth: Math.max(1, vpWidth), lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
      s.setData([{ time: src[0].time, value: poc }, { time: src[src.length - 1].time, value: poc }]);
      levelLinesRef.current.push(s);
    }
    if (indCVD && bars.length) {
      const src = anchorBars(bars, cvdAnchor);
      let cvd = 0;
      const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim();
      const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim();
      const d = src.map((b, i) => {
        const prevPx = src[Math.max(0, i - 1)]?.close ?? b.open;
        const delta = b.close >= prevPx ? (b.volume || 0) : -(b.volume || 0);
        const o = cvd;
        const c = cvd + delta;
        cvd = c;
        return { time: b.time, open: o, high: Math.max(o, c), low: Math.min(o, c), close: c };
      });
      const s = chartRef.current.addCandlestickSeries({
        priceScaleId: "cvd",
        upColor: bull,
        downColor: bear,
        wickUpColor: bull,
        wickDownColor: bear,
        borderVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0.02 }, visible: false });
      s.setData(d);
      indicatorSeriesRef.current.push(s);
    }
  }, [clearIndicators, timeframe, vwapAnchor, vpAnchor, cvdAnchor, theme.bull, theme.bear, indSMA, indEMA, indVWAP, indBB, indLevels, indVP, indCVD, smaFastPeriod, smaFastColor, smaFastWidth, smaSlowPeriod, smaSlowColor, smaSlowWidth, emaFastPeriod, emaFastColor, emaFastWidth, emaSlowPeriod, emaSlowColor, emaSlowWidth, vwapColor, vwapWidth, bbPeriod, bbStd, bbColor, bbWidth, levelColor, levelWidth, showPrevClose, showDayHighLow, showPremarketHighLow, vpColor, vpWidth]);

  const updateSessionShading = useCallback(() => {
    if (!extShadeRef.current) return;
    if (timeframe === "1d" || timeframe === "1w") { extShadeRef.current.setData([]); return; }

    const bars = Array.from(cacheRef.current.values()).sort((a, b) => a.time - b.time);
    if (!bars.length) { extShadeRef.current.setData([]); return; }

    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const isExt = (t: number) => {
      const parts = fmt.formatToParts(new Date(t * 1000));
      const h = Number(parts.find(p => p.type === "hour")?.value || "0");
      const m = Number(parts.find(p => p.type === "minute")?.value || "0");
      const mins = h * 60 + m;
      const pre = mins >= 240 && mins < 570;   // 4:00-9:30 ET
      const post = mins >= 960 && mins < 1200; // 16:00-20:00 ET
      return pre || post;
    };

    const tfSecMap: Record<string, number> = {
      "1s": 1, "5s": 5, "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
      "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800,
    };
    const eps = Math.max(1, Math.floor((tfSecMap[timeframe] || 60) / 100));
    const pts: Array<{ time: number; value: number }> = [];
    let prev: number | null = null;
    for (const b of bars) {
      const cur = isExt(b.time) ? 1 : 0;
      if (prev !== null && cur !== prev) {
        pts.push({ time: Math.max(0, b.time - eps), value: prev });
      }
      pts.push({ time: b.time, value: cur });
      prev = cur;
    }
    extShadeRef.current.setData(pts);
  }, [timeframe, theme.mode]);

  useEffect(() => {
    const bars = Array.from(cacheRef.current.values()).sort((a,b)=>a.time-b.time);
    if (!bars.length || !seriesRef.current) return;
    // Re-apply full datasets so existing candles/derived series re-color immediately on theme changes.
    seriesRef.current.setData(bars);
    const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim();
    const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim();
    volumeRef.current?.setData(
      bars.map(b => ({ time: b.time, value: b.volume || 0, color: b.close >= b.open ? toRgba(bull, 0.5) : toRgba(bear, 0.5) }))
    );
    rebuildCvdMap(bars);
    drawIndicators(bars);
    updateSessionShading();
  }, [theme.bull, theme.bear, drawIndicators, updateSessionShading, rebuildCvdMap, indCVD]);

  // Full load — clears & repopulates everything
  const loadFull = useCallback(async (sym: string, tf: Timeframe, forcedLimit?: number, fit = true) => {
    const alpacaTF = TF_MAP[tf] || "5Min";
    const tfSecMap: Record<string, number> = {
      "1s": 1, "5s": 5, "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
      "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800,
    };
    const pr = pendingRangeRef.current;
    const hasPendingRange = !!(pr && pr.targetTf === tf && typeof pr.from === "number" && typeof pr.to === "number");
    const stepSec = tfSecMap[tf] || 60;
    const spanSec = hasPendingRange ? Math.max(1, (pr!.to - pr!.from)) : 0;
    const neededBars = hasPendingRange ? Math.ceil(spanSec / stepSec) + 200 : 0;
    const limit = forcedLimit ?? Math.max(BAR_LIMIT[alpacaTF] || 200, neededBars);
    historyLimitRef.current = limit;

    // Wait for chart to be ready (first mount race)
    let waited = 0;
    while (!seriesRef.current && waited < 3000) {
      await new Promise(r => setTimeout(r, 150));
      waited += 150;
    }
    if (!seriesRef.current) { setStatus("error"); return; }

    setStatus("loading");
    try {
      const latestAnchor = hasPendingRange ? String(Math.floor(pr!.to)) : "now";
      const r = await fetch(`${API}/api/market/history/${sym}?timeframe=${alpacaTF}&limit=${limit}&latest=${encodeURIComponent(latestAnchor)}`);
      if (!r.ok) throw new Error();
      const payload = await r.json();
      const bars = parseBars(payload);
      if (!bars.length || !seriesRef.current) { setStatus("error"); return; }

      cacheRef.current = new Map(bars.map(b => [b.time, b]));
      seriesRef.current.setData(bars);
      const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim();
      const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim();
      volumeRef.current?.setData(
        bars.map(b => ({
          time: b.time,
          value: b.volume || 0,
          color: b.close >= b.open ? toRgba(bull, 0.5) : toRgba(bear, 0.5),
        }))
      );
      rebuildCvdMap(bars);
      drawIndicators(bars);
      const lb = bars[bars.length - 1];
      if (lb) {
        setBarStatus(`O ${lb.open.toFixed(2)} H ${lb.high.toFixed(2)} L ${lb.low.toFixed(2)} C ${lb.close.toFixed(2)} V ${Math.round(lb.volume || 0).toLocaleString()}`);
      }

      if (pr && pr.targetTf === tf && chartRef.current?.timeScale) {
        let from = pr.from;
        let to = pr.to;

        if (tf === "1d" && sameUtcDay(pr.from, pr.to)) {
          // Ensure at least current + previous 2 daily bars are visible.
          from = to - 3 * 86400;
        }
        if (tf === "1w" && sameUtcWeek(pr.from, pr.to)) {
          // Ensure at least current + previous 2 weekly bars are visible.
          from = to - 3 * 7 * 86400;
        }

        chartRef.current.timeScale().setVisibleRange({ from, to });
        pendingRangeRef.current = null;
      } else if (fit) {
        chartRef.current?.timeScale().fitContent();
      }

      setLastPrice(bars[bars.length - 1].close);
      updateSessionShading();

      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [theme.bull, theme.bear, indCVD, drawIndicators, updateSessionShading, rebuildCvdMap]);

  // Incremental update — fetches last 3 bars and upserts changes
  const pollUpdate = useCallback(async (sym: string, tf: Timeframe) => {
    if (!seriesRef.current) return;
    const alpacaTF = TF_MAP[tf] || "5Min";
    try {
      const r = await fetch(`${API}/api/market/history/${sym}?timeframe=${alpacaTF}&limit=3&latest=now`);
      if (!r.ok) return;
      const payload = await r.json();
      const bars = parseBars(payload);
      if (!bars.length || !seriesRef.current) return;

      let hasNewBar = false;
      for (const bar of bars) {
        const cached = cacheRef.current.get(bar.time);
        if (!cached || cached.close !== bar.close || cached.high !== bar.high || cached.low !== bar.low) {
          if (!cached) hasNewBar = true;
          cacheRef.current.set(bar.time, bar);
          seriesRef.current.update(bar);   // lightweight-charts upserts by time
          const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim();
          const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim();
          volumeRef.current?.update({
            time: bar.time,
            value: bar.volume || 0,
            color: bar.close >= bar.open ? toRgba(bull, 0.5) : toRgba(bear, 0.5),
          });
        }
      }
      if (hasNewBar) {
        const merged = Array.from(cacheRef.current.values()).sort((a,b)=>a.time-b.time);
        rebuildCvdMap(merged);
        drawIndicators(merged);
      }
      updateSessionShading();
      const lb = bars[bars.length - 1];
      if (lb) {
        setBarStatus(`O ${lb.open.toFixed(2)} H ${lb.high.toFixed(2)} L ${lb.low.toFixed(2)} C ${lb.close.toFixed(2)} V ${Math.round(lb.volume || 0).toLocaleString()}`);
      }
      setLastPrice(bars[bars.length - 1].close);
      setIsLive(true);


    } catch { /* silent — don't flicker status on transient errors */ }
  }, [theme.bull, theme.bear, drawIndicators, updateSessionShading, rebuildCvdMap]);

  useEffect(() => { loadFullRef.current = loadFull; }, [loadFull]);
  useEffect(() => { pollUpdateRef.current = pollUpdate; }, [pollUpdate]);

  const fetchOlder = useCallback(async () => {
    if (!seriesRef.current || loadingMoreRef.current) return;
    const times = Array.from(cacheRef.current.keys()).sort((a, b) => a - b);
    if (!times.length) return;
    const oldest = times[0];
    const alpacaTF = TF_MAP[timeframe] || "5Min";
    const latestCursor = String(oldest - 1);

    loadingMoreRef.current = true;
    try {
      const r = await fetch(`${API}/api/market/history/${symbol}?timeframe=${alpacaTF}&limit=1000&latest=${encodeURIComponent(latestCursor)}`);
      if (!r.ok) return;
      const payload = await r.json();
      const older = parseBars(payload).filter(b => b.time < oldest);
      if (!older.length) { noMoreOlderRef.current = true; return; }

      for (const b of older) cacheRef.current.set(b.time, b);
      const merged = Array.from(cacheRef.current.values()).sort((a, b) => a.time - b.time);
      seriesRef.current.setData(merged);
      const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim();
      const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim();
      volumeRef.current?.setData(merged.map(b => ({ time: b.time, value: b.volume || 0, color: b.close >= b.open ? toRgba(bull, 0.5) : toRgba(bear, 0.5) })));
      rebuildCvdMap(merged);
      drawIndicators(merged);
      updateSessionShading();
    } finally {
      loadingMoreRef.current = false;
    }
  }, [symbol, timeframe, theme.bull, theme.bear, indCVD, drawIndicators, updateSessionShading, rebuildCvdMap]);

  // Auto-backfill older candles when panning to the left edge
  useEffect(() => {
    if (!chartReady || !chartRef.current) return;
    const ts = chartRef.current.timeScale();

    const onRange = (range: any) => {
      if (!range || !seriesRef.current) return;
      updateSessionShading();
      if (loadingMoreRef.current || noMoreOlderRef.current) return;
      const info = seriesRef.current.barsInLogicalRange?.(range);
      // Fetch more whenever user approaches the left edge of loaded data.
      if (!info || typeof info.barsBefore !== "number" || info.barsBefore < 80) {
        fetchOlder();
      }
    };

    ts.subscribeVisibleLogicalRangeChange(onRange);
    const vr = ts.getVisibleLogicalRange?.();
    if (vr) onRange(vr);
    return () => ts.unsubscribeVisibleLogicalRangeChange(onRange);
  }, [chartReady, fetchOlder, updateSessionShading]);

  // Main effect: full load then polling
  useEffect(() => {
    // Stop any existing poll
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setIsLive(false);
    cacheRef.current = new Map();
    cvdMapRef.current = new Map();
    noMoreOlderRef.current = false;

    const alpacaTF = TF_MAP[timeframe] || "5Min";
    const pollMs   = POLL_MS[alpacaTF] || 15000;
    let alive = true;

    loadFullRef.current?.(symbol, timeframe).then(() => {
      if (!alive) return;
      // Kick off polling
      pollRef.current = setInterval(() => pollUpdateRef.current?.(symbol, timeframe), pollMs);
    });

    return () => {
      alive = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [symbol, timeframe]);

  // WebSocket — live price overlay (updates lastPrice + last bar close in real time)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wsBase = (API && API.trim())
      ? API.replace(/^http/, "ws")
      : window.location.origin.replace(/^http/, "ws");
    let ws: WebSocket;
    let closed = false;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(`${wsBase}/api/ws/quotes/${symbol}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.ping || !data.price) return;
          const price = parseFloat(data.price);
          if (!isFinite(price)) return;

          setLastPrice(price);
          setIsLive(true);

          // Update latest bar; if stale, start a new current-time bucket so chart stays current.
          if (seriesRef.current && cacheRef.current.size > 0) {
            const times = Array.from(cacheRef.current.keys()).sort((a, b) => a - b);
            const lastTime = times[times.length - 1];
            const lastBar = cacheRef.current.get(lastTime)!;

            const updated: Bar = {
              ...lastBar,
              close: price,
              high: Math.max(lastBar.high, price),
              low: Math.min(lastBar.low, price),
            };

            cacheRef.current.set(lastTime, updated);
            seriesRef.current.update(updated);
            const bull = theme.bull || getComputedStyle(document.documentElement).getPropertyValue("--bull").trim();
            const bear = theme.bear || getComputedStyle(document.documentElement).getPropertyValue("--bear").trim();
            volumeRef.current?.update({
              time: updated.time,
              value: updated.volume || 0,
              color: updated.close >= updated.open ? toRgba(bull, 0.5) : toRgba(bear, 0.5),
            });
            setBarStatus(`O ${updated.open.toFixed(2)} H ${updated.high.toFixed(2)} L ${updated.low.toFixed(2)} C ${updated.close.toFixed(2)} V ${Math.round(updated.volume || 0).toLocaleString()}`);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect after 3s unless component unmounted
        if (!closed) setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      closed = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [symbol, theme.bull, theme.bear, drawIndicators]);

  const submitSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
    onConfigChange?.({ symbol: s });
  };

  const sameUtcDay = (a: number, b: number) => {
    const da = new Date(a * 1000), db = new Date(b * 1000);
    return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth() && da.getUTCDate() === db.getUTCDate();
  };

  const sameUtcWeek = (a: number, b: number) => {
    const week = (t: number) => {
      const d = new Date(t * 1000);
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNr = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNr + 3);
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const diff = target.getTime() - firstThursday.getTime();
      return [target.getUTCFullYear(), 1 + Math.round(diff / 604800000)] as const;
    };
    const wa = week(a), wb = week(b);
    return wa[0] === wb[0] && wa[1] === wb[1];
  };

  const setTF = (tf: Timeframe) => {
    const vr = chartRef.current?.timeScale?.().getVisibleRange?.();
    if (vr && typeof vr.from === "number" && typeof vr.to === "number") {
      pendingRangeRef.current = { from: vr.from, to: vr.to, targetTf: tf };
    }
    setTimeframe(tf);
    onConfigChange?.({ timeframe: tf });
  };

  const enabledCount = useMemo(() => [indSMA, indEMA, indVWAP, indBB, indLevels, indVP, indCVD].filter(Boolean).length, [indSMA, indEMA, indVWAP, indBB, indLevels, indVP, indCVD]);

  return (
    <div className="relative flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 pr-14 border-b border-surface-border shrink-0 flex-wrap text-xs">
        <div className="widget-drag-handle cursor-grab active:cursor-grabbing select-none inline-flex items-center gap-1.5 text-neutral-500 leading-none">
          <GripHorizontal size={11} className="opacity-50" />
          <span className="text-xs uppercase tracking-wide">Chart</span>
        </div>

        {/* Symbol */}
        <div ref={symRef} className="relative flex items-center gap-1">
          <input
            value={symbolInput}
            onChange={e => { setSymbolInput(e.target.value.toUpperCase()); setSymOpen(true); }}
            onFocus={() => setSymOpen(true)}
            disabled={isGlobalOverride}
            title={isGlobalOverride ? "Controlled by global override" : "Select symbol"}
            className={`cb-input border rounded px-2 h-6 leading-none text-xs font-mono w-10 focus:outline-none text-white transition
              ${isGlobalOverride
                ? "bg-surface-overlay border-accent/70 text-accent cursor-not-allowed shadow-[0_0_0_1px_rgba(0,212,170,0.25)]"
                : "bg-transparent border-neutral-500/70 hover:bg-surface-overlay/40 focus:border-accent/60"}`}
          />
          {isGlobalOverride && <span className="text-neutral-700 text-xs">⬡</span>}
          {symOpen && !isGlobalOverride && symItems.length > 0 && (
            <div className="absolute left-0 top-6 z-50 w-56 rounded-md border border-surface-border bg-surface-raised shadow-xl max-h-64 overflow-auto">
              {symItems.map((it) => (
                <button key={it.symbol} onClick={() => { setSymbol(it.symbol); setSymbolInput(it.symbol); onConfigChange?.({ symbol: it.symbol }); setSymOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-surface-overlay">
                  <div className="text-xs font-mono text-white">{it.symbol}</div>
                  <div className="text-[10px] text-neutral-500 truncate">{it.name || ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center justify-end gap-2 min-w-[120px] opacity-100 md:opacity-0 md:group-hover/widget:opacity-100 transition">
          {/* Timeframes */}
          <div ref={tfRef} className="relative">
            <button onClick={() => setTfOpen(v => !v)} className="widget-trigger-btn px-1.5 text-xs font-mono leading-none gap-1">
              <Clock3 size={11} className="opacity-80" />
              <span className="widget-trigger-label">{timeframe}</span>
            </button>
            {tfOpen && (
              <div className="absolute right-0 top-6 z-40 rounded-md bg-surface-raised shadow-xl p-1 pop-in min-w-[52px]">
                {TIMEFRAMES.filter(tf => tf !== timeframe).map(tf => (
                  <button key={tf} onClick={() => { setTF(tf); setTfOpen(false); }} className="w-full text-left px-2 py-1 rounded text-xs font-mono text-neutral-400 hover:text-white hover:bg-surface-overlay">{tf}</button>
                ))}
              </div>
            )}
          </div>

          <details className="relative">
            <summary className="widget-trigger-summary px-1 leading-none">
              <SlidersHorizontal size={13} />
              {enabledCount > 0 && <span className="text-[11px] font-mono widget-trigger-label">{enabledCount}</span>}
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-52 max-w-[calc(100vw-16px)] rounded bg-surface p-2 shadow-xl text-xs space-y-1 pop-in">
            {[
              { key: 'sma', label: 'SMA', enabled: indSMA, set: setIndSMA },
              { key: 'ema', label: 'EMA', enabled: indEMA, set: setIndEMA },
              { key: 'vwap', label: 'VWAP', enabled: indVWAP, set: setIndVWAP },
              { key: 'bb', label: 'Bollinger Bands', enabled: indBB, set: setIndBB },
              { key: 'levels', label: 'Price Levels', enabled: indLevels, set: setIndLevels },
              { key: 'vp', label: 'Volume Profile', enabled: indVP, set: setIndVP },
              { key: 'cvd', label: 'CVD', enabled: indCVD, set: setIndCVD },
            ].map((it:any) => (
              <div key={it.key} className="flex items-center justify-between gap-2 py-1">
                <label className="flex items-center gap-2"><input type="checkbox" checked={it.enabled} onChange={e=>it.set(e.target.checked)} /><span>{it.label}</span></label>
                {it.enabled && <button onClick={() => setIndicatorModal(it.key)} className="p-0.5 rounded hover:bg-surface-overlay"><Settings2 size={12} /></button>}
              </div>
            ))}
          </div>
        </details>
        </div>

      </div>

      <div className="relative flex-1 w-full min-h-0">
        {crosshairActive && hoverBar && (
          <div className="absolute left-2 top-1 z-10 text-[12px] font-mono pointer-events-none flex items-center gap-2">
            <span className="text-neutral-500">O</span><span className="text-neutral-200">{hoverBar.open.toFixed(2)}</span>
            <span className="text-neutral-500">H</span><span className="text-bull">{hoverBar.high.toFixed(2)}</span>
            <span className="text-neutral-500">L</span><span className="text-bear">{hoverBar.low.toFixed(2)}</span>
            <span className="text-neutral-500">C</span><span className={hoverBar.close >= hoverBar.open ? "text-bull" : "text-bear"}>{hoverBar.close.toFixed(2)}</span>
            <span className="text-neutral-500">V</span><span className="text-neutral-200">{Math.round(hoverBar.volume || 0).toLocaleString()}</span>
            {hoverCvd != null && (<><span className="text-neutral-500">CVD</span><span className={hoverCvd >= 0 ? "text-bull" : "text-bear"}>{Math.round(hoverCvd).toLocaleString()}</span></>)}
            {lastPrice != null && <span className="ml-1 text-white">${lastPrice.toFixed(2)}</span>}
            {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />}
          </div>
        )}
        <div ref={containerRef} className="h-full w-full relative z-[5]" />
      </div>

      {indicatorModal && (
        <div className="absolute inset-0 z-30 bg-black/50 flex items-center justify-center p-3">
          <div className="w-full max-w-sm rounded-xl bg-surface-raised p-3 text-xs space-y-3 pop-in">
            <div className="flex items-center justify-between text-sm text-white">
              <span className="capitalize">{indicatorModal} settings</span>
              <button onClick={() => setIndicatorModal(null)}><X size={14} /></button>
            </div>

            <div className="pt-2">
              {indicatorModal === "sma" && (
                <div className="space-y-2">
                  <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Fast Line</div>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Fast Period" help="Bars used for fast SMA." /><input type="number" value={smaFastPeriod} onChange={e=>setSmaFastPeriod(Number(e.target.value)||20)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Fast Color" help="Color of fast SMA line." /><AppColorPicker value={smaFastColor} onChange={setSmaFastColor} /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Fast Width" help="Thickness of fast SMA line." /><input type="number" min={1} max={6} value={smaFastWidth} onChange={e=>setSmaFastWidth(Number(e.target.value)||1)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                  <div className="pt-1 text-[11px] text-neutral-500 uppercase tracking-wide">Slow Line</div>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Slow Period" help="Bars used for slow SMA." /><input type="number" value={smaSlowPeriod} onChange={e=>setSmaSlowPeriod(Number(e.target.value)||50)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Slow Color" help="Color of slow SMA line." /><AppColorPicker value={smaSlowColor} onChange={setSmaSlowColor} /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Slow Width" help="Thickness of slow SMA line." /><input type="number" min={1} max={6} value={smaSlowWidth} onChange={e=>setSmaSlowWidth(Number(e.target.value)||1)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                </div>
              )}
              {indicatorModal === "ema" && (
                <div className="space-y-2">
                  <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Fast Line</div>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Fast Period" help="Bars used for fast EMA." /><input type="number" value={emaFastPeriod} onChange={e=>setEmaFastPeriod(Number(e.target.value)||12)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Fast Color" help="Color of fast EMA line." /><AppColorPicker value={emaFastColor} onChange={setEmaFastColor} /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Fast Width" help="Thickness of fast EMA line." /><input type="number" min={1} max={6} value={emaFastWidth} onChange={e=>setEmaFastWidth(Number(e.target.value)||1)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                  <div className="pt-1 text-[11px] text-neutral-500 uppercase tracking-wide">Slow Line</div>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Slow Period" help="Bars used for slow EMA." /><input type="number" value={emaSlowPeriod} onChange={e=>setEmaSlowPeriod(Number(e.target.value)||26)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Slow Color" help="Color of slow EMA line." /><AppColorPicker value={emaSlowColor} onChange={setEmaSlowColor} /></label>
                  <label className="flex items-center justify-between gap-2"><LabelWithHelp label="Slow Width" help="Thickness of slow EMA line." /><input type="number" min={1} max={6} value={emaSlowWidth} onChange={e=>setEmaSlowWidth(Number(e.target.value)||1)} className="w-10 bg-surface-overlay border border-surface-border rounded px-1 py-1" /></label>
                </div>
              )}
              {indicatorModal === "bb" && (
                <div className="space-y-2">
                  <label className="flex items-center justify-between"><LabelWithHelp label="Period" help="Window length for Bollinger calculations." /><input type="number" value={bbPeriod} onChange={e=>setBbPeriod(Number(e.target.value)||20)} className="w-20 bg-surface-overlay border border-surface-border rounded px-2 py-1" /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Std Dev" help="Standard deviation multiplier for upper/lower bands." /><input type="number" step="0.1" value={bbStd} onChange={e=>setBbStd(Number(e.target.value)||2)} className="w-20 bg-surface-overlay border border-surface-border rounded px-2 py-1" /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Color" help="Display color for BB lines." /><AppColorPicker value={bbColor} onChange={setBbColor} /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Thickness" help="Pixel width for BB lines." /><input type="number" min={1} max={6} value={bbWidth} onChange={e=>setBbWidth(Number(e.target.value)||1)} className="w-20 bg-surface-overlay border border-surface-border rounded px-2 py-1" /></label>
                </div>
              )}
              {indicatorModal === "levels" && (
                <div className="space-y-2">
                  <label className="flex items-center justify-between"><LabelWithHelp label="Show Previous Close" help="Adds yesterday close level." /><Toggle checked={showPrevClose} onChange={setShowPrevClose} /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Show Day High/Low" help="Adds current session high and low." /><Toggle checked={showDayHighLow} onChange={setShowDayHighLow} /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Show Premarket H/L" help="Adds premarket high and low (4:00–9:30 ET)." /><Toggle checked={showPremarketHighLow} onChange={setShowPremarketHighLow} /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Color" help="Display color for all price levels." /><AppColorPicker value={levelColor} onChange={setLevelColor} /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Thickness" help="Pixel width for level lines." /><input type="number" min={1} max={6} value={levelWidth} onChange={e=>setLevelWidth(Number(e.target.value)||1)} className="w-20 bg-surface-overlay border border-surface-border rounded px-2 py-1" /></label>
                </div>
              )}
              {indicatorModal === "vwap" && (
                <div className="space-y-2">
                  <label className="flex items-center justify-between"><LabelWithHelp label="Anchor" help="Auto: day for intraday, month for 1D, year for 1W." />
                    <AppDropdown value={vwapAnchor} onChange={(v)=>setVwapAnchor(v as any)} options={[{value:"auto",label:"Auto"},{value:"day",label:"Day"},{value:"week",label:"Week"},{value:"month",label:"Month"},{value:"year",label:"Year"}]} />
                  </label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Color" help="Display color for VWAP line." /><AppColorPicker value={vwapColor} onChange={setVwapColor} /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Thickness" help="Pixel width for VWAP line." /><input type="number" min={1} max={6} value={vwapWidth} onChange={e=>setVwapWidth(Number(e.target.value)||1)} className="w-20 bg-surface-overlay border border-surface-border rounded px-2 py-1" /></label>
                </div>
              )}
              {indicatorModal === "vp" && (
                <div className="space-y-2">
                  <label className="flex items-center justify-between"><LabelWithHelp label="Anchor" help="Auto: day for intraday, month for 1D, year for 1W." />
                    <AppDropdown value={vpAnchor} onChange={(v)=>setVpAnchor(v as any)} options={[{value:"auto",label:"Auto"},{value:"day",label:"Day"},{value:"week",label:"Week"},{value:"month",label:"Month"},{value:"year",label:"Year"}]} />
                  </label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Color" help="Display color for POC line." /><AppColorPicker value={vpColor} onChange={setVpColor} /></label>
                  <label className="flex items-center justify-between"><LabelWithHelp label="Line Thickness" help="Pixel width for POC line." /><input type="number" min={1} max={6} value={vpWidth} onChange={e=>setVpWidth(Number(e.target.value)||2)} className="w-20 bg-surface-overlay border border-surface-border rounded px-2 py-1" /></label>
                </div>
              )}
              {indicatorModal === "cvd" && (
                <div className="space-y-2">
                  <label className="flex items-center justify-between"><LabelWithHelp label="Anchor" help="Reset point for cumulative delta." />
                    <AppDropdown value={cvdAnchor} onChange={(v)=>setCvdAnchor(v as any)} options={[{value:"auto",label:"Auto"},{value:"day",label:"Day"},{value:"week",label:"Week"},{value:"month",label:"Month"},{value:"year",label:"Year"}]} />
                  </label>
                  <div className="text-[11px] text-neutral-500">Colors inherit Bull/Bear theme.</div>
                </div>
              )}
            </div>


          </div>
        </div>
      )}
    </div>
  );
}
