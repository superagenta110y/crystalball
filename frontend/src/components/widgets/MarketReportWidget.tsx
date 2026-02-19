"use client";
import React, { useEffect, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function MarketReportWidget({ symbol = "SPY" }: { symbol?: string }) {
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reports/daily-bias/${symbol}`);
      const text = await res.text();
      setReport(text);
    } catch {
      setReport("⚠️ Could not load report — backend offline?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [symbol]);

  return (
    <>
      <div className="widget-header">
        <span className="flex items-center gap-1.5">
          <FileText size={12} /> Daily Bias — {symbol}
        </span>
        <button onClick={fetchReport} className="opacity-50 hover:opacity-100 transition-opacity">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap text-gray-300">
        {loading ? "Loading report..." : report || "No data"}
      </div>
    </>
  );
}
