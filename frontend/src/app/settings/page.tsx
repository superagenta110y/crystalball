"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Check, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AlpacaConfig { api_key: string; secret_key: string; paper: boolean; data_url: string }
interface HoodwinkConfig { url: string; api_key: string }

type SaveStatus = "idle" | "saving" | "saved" | "error";

function useSave(endpoint: string) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const save = async (body: object) => {
    setStatus("saving");
    try {
      const r = await fetch(`${API}/api/settings/${endpoint}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch { setStatus("error"); setTimeout(() => setStatus("idle"), 3000); }
  };
  return { status, save };
}

function SaveButton({ status }: { status: SaveStatus }) {
  return (
    <button type="submit" disabled={status === "saving"}
      className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg text-sm transition disabled:opacity-50">
      {status === "saving" && <span className="animate-spin">⏳</span>}
      {status === "saved" && <Check size={14} />}
      {status === "error" && <AlertCircle size={14} className="text-bear" />}
      {status === "idle" && <Save size={14} />}
      {status === "saved" ? "Saved!" : status === "error" ? "Error" : "Save"}
    </button>
  );
}

export default function SettingsPage() {
  const [activeProvider, setActiveProvider] = useState("alpaca");
  const [alpaca, setAlpaca] = useState<AlpacaConfig>({ api_key: "", secret_key: "", paper: true, data_url: "https://data.alpaca.markets" });
  const [hoodwink, setHoodwink] = useState<HoodwinkConfig>({ url: "http://127.0.0.1:7878", api_key: "" });
  const [loading, setLoading] = useState(true);

  const alpacaSave = useSave("alpaca");
  const hoodwinkSave = useSave("hoodwink");
  const [providerStatus, setProviderStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(d => {
        setActiveProvider(d.active_provider || "alpaca");
        if (d.alpaca) setAlpaca(a => ({ ...a, ...d.alpaca }));
        if (d.hoodwink) setHoodwink(h => ({ ...h, ...d.hoodwink }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const switchProvider = async (p: string) => {
    setProviderStatus("saving");
    try {
      await fetch(`${API}/api/settings/active-provider`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: p }),
      });
      setActiveProvider(p);
      setProviderStatus("saved");
      setTimeout(() => setProviderStatus("idle"), 2000);
    } catch { setProviderStatus("error"); setTimeout(() => setProviderStatus("idle"), 3000); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-neutral-600 text-sm animate-pulse">
      Loading settings…
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-neutral-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#2a2a2a]">
        <Link href="/" className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition text-sm">
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="w-px h-4 bg-[#2a2a2a]" />
        <h1 className="text-sm font-semibold text-white">Settings</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Active Provider */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Active Provider</h2>
          <div className="flex gap-3">
            {["alpaca", "hoodwink"].map(p => (
              <button key={p} onClick={() => switchProvider(p)}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition capitalize ${
                  activeProvider === p
                    ? "border-[#00d4aa] bg-[#00d4aa]/10 text-[#00d4aa]"
                    : "border-[#2a2a2a] text-neutral-400 hover:border-neutral-500 hover:text-white"
                }`}>
                {p === "alpaca" ? "Alpaca Markets" : "Hoodwink (Robinhood)"}
              </button>
            ))}
          </div>
          {providerStatus === "saved" && <p className="text-xs text-[#00d4aa] mt-2">✓ Provider switched</p>}
        </section>

        {/* Alpaca */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Alpaca Markets</h2>
          <form onSubmit={e => { e.preventDefault(); alpacaSave.save(alpaca); }}
            className="flex flex-col gap-3 bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
            <Field label="API Key" value={alpaca.api_key} onChange={v => setAlpaca(a => ({...a, api_key: v}))} placeholder="PKXXXXXXXXXXXX" />
            <Field label="Secret Key" value={alpaca.secret_key} onChange={v => setAlpaca(a => ({...a, secret_key: v}))} placeholder="••••••••••••" type="password" />
            <Field label="Data URL" value={alpaca.data_url} onChange={v => setAlpaca(a => ({...a, data_url: v}))} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer select-none">
                <input type="checkbox" checked={alpaca.paper} onChange={e => setAlpaca(a => ({...a, paper: e.target.checked}))}
                  className="w-4 h-4 accent-[#00d4aa] rounded" />
                Paper trading mode
              </label>
              <SaveButton status={alpacaSave.status} />
            </div>
            {!alpaca.paper && (
              <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                ⚠️ Live trading enabled — real money at risk
              </p>
            )}
          </form>
        </section>

        {/* Hoodwink */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Hoodwink (Robinhood Bridge)</h2>
          <form onSubmit={e => { e.preventDefault(); hoodwinkSave.save(hoodwink); }}
            className="flex flex-col gap-3 bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
            <p className="text-xs text-neutral-500">
              Hoodwink runs locally alongside CrystalBall and bridges to your Robinhood account for free market data and execution.
            </p>
            <Field label="Hoodwink URL" value={hoodwink.url} onChange={v => setHoodwink(h => ({...h, url: v}))} placeholder="http://127.0.0.1:7878" />
            <Field label="API Key" value={hoodwink.api_key} onChange={v => setHoodwink(h => ({...h, api_key: v}))} type="password" placeholder="••••••••" />
            <div className="flex justify-end">
              <SaveButton status={hoodwinkSave.status} />
            </div>
          </form>
        </section>

      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-500">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-700 focus:outline-none focus:border-[#00d4aa]/50 transition"
      />
    </div>
  );
}
