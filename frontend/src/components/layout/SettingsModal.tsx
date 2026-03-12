"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Link2, Brain, Gem, Bot, CandlestickChart, ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type ProviderType = "alpaca" | "hoodlink" | "openai" | "gemini" | "claude";

interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  api_key?: string;
  secret_key?: string;
  paper?: boolean;
  data_url?: string;
  url?: string;
}

interface ProvidersState {
  providers: Provider[];
  active: { data?: string; ai?: string };
}

type ProviderDef = {
  type: ProviderType;
  label: string;
  role: "data" | "ai";
  icon: React.ReactNode;
  fields: Array<{ key: string; label: string; type?: string; placeholder?: string }>;
};

const ALPACA_LOGO_DARK = "https://s3.tradingview.com/brokers/logo/160x160_LS__alpaca.svg";
const ALPACA_LOGO_LIGHT = "https://s3.tradingview.com/brokers/logo/160x160_DS__alpaca.svg";

const PROVIDER_LOGOS: Record<ProviderType, string> = {
  alpaca: ALPACA_LOGO_DARK,
  hoodlink: "https://cdn.simpleicons.org/linktree/ffffff",
  openai: "https://cdn.simpleicons.org/openai/ffffff",
  gemini: "https://cdn.simpleicons.org/googlegemini/ffffff",
  claude: "https://cdn.simpleicons.org/anthropic/ffffff",
};

const PROVIDER_DEFS: ProviderDef[] = [
  { type: "alpaca", label: "Alpaca", role: "data", icon: <CandlestickChart size={15} />, fields: [
    { key: "api_key", label: "API Key", placeholder: "PK..." },
    { key: "secret_key", label: "Secret Key", type: "password", placeholder: "••••••••" },
    { key: "data_url", label: "Data URL", placeholder: "https://data.alpaca.markets" },
    { key: "paper", label: "Paper Trading (true/false)", placeholder: "true" },
  ]},
  { type: "hoodlink", label: "Hoodlink", role: "data", icon: <Link2 size={15} />, fields: [
    { key: "url", label: "Hoodlink URL", placeholder: "http://127.0.0.1:7878" },
    { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••" },
  ]},
  { type: "openai", label: "OpenAI", role: "ai", icon: <Brain size={15} />, fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "sk-..." }]},
  { type: "gemini", label: "Gemini", role: "ai", icon: <Gem size={15} />, fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "AIza..." }]},
  { type: "claude", label: "Claude", role: "ai", icon: <Bot size={15} />, fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "sk-ant-..." }]},
];

type View = "list" | "pick" | "detail";

export function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [state, setState] = useState<ProvidersState>({ providers: [], active: {} });
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [anchor, setAnchor] = useState<{ top: number; right: number; bottom: number; left: number } | null>(null);
  const [vw, setVw] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isLight, setIsLight] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/providers`);
      if (r.ok) setState(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<any>;
      const a = ce?.detail?.anchor;
      if (a && typeof a.top === 'number') setAnchor(a);
      setOpen(true); setView("list"); load();
    };
    const onOpenAdd = () => { setOpen(true); setView("pick"); load(); };
    const onResize = () => setVw(window.innerWidth);
    const syncTheme = () => {
      const t = document.documentElement.getAttribute("data-theme");
      setIsLight(t === "light");
    };
    syncTheme();
    const obs = new MutationObserver(syncTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    window.addEventListener("settings:open", onOpen as EventListener);
    window.addEventListener("settings:open-add-provider", onOpenAdd as EventListener);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("settings:open", onOpen as EventListener);
      window.removeEventListener("settings:open-add-provider", onOpenAdd as EventListener);
      window.removeEventListener("resize", onResize);
      obs.disconnect();
    };
  }, []);

  const currentDef = useMemo(() => PROVIDER_DEFS.find(p => p.type === (selectedType || editing?.type || "alpaca")), [selectedType, editing]);

  const openDetail = (p?: Provider, type?: ProviderType) => {
    const t = type || p?.type || null;
    setEditing(p || null);
    setSelectedType(t);
    setForm({
      api_key: p?.api_key || "",
      secret_key: p?.secret_key || "",
      data_url: p?.data_url || "https://data.alpaca.markets",
      url: p?.url || "http://127.0.0.1:7878",
      paper: String(p?.paper ?? true),
    });
    setView("detail");
  };

  const save = async () => {
    if (!selectedType) return;
    const config: Record<string, unknown> = { ...form };
    if (selectedType === "alpaca") config.paper = String(form.paper).toLowerCase() !== "false";
    const body = JSON.stringify({ type: selectedType, config });
    if (editing?.id) {
      await fetch(`${API}/api/providers/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
    } else {
      const r = await fetch(`${API}/api/providers`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (r.ok) {
        const created = await r.json();
        if (created?.id) setEditing(created);
      }
    }
    await load();
  };

  const remove = async () => {
    if (!editing?.id) return;
    await fetch(`${API}/api/providers/${editing.id}`, { method: "DELETE" });
    await load();
    setView("list");
  };

  const activate = async (p: Provider) => {
    const def = PROVIDER_DEFS.find(x => x.type === p.type);
    if (!def) return;
    await fetch(`${API}/api/providers/${p.id}/activate`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: def.role }),
    });
    await load();
  };

  useEffect(() => {
    if (view !== "detail" || !selectedType) return;
    const t = setTimeout(() => { save(); }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, selectedType, editing?.id, view]);

  if (!open) return null;
  const isMobile = vw < 768;
  const panelW = 380;
  const panelH = 620;
  const left = Math.max(8, Math.min((anchor ? anchor.right : vw - 20) - panelW, vw - panelW - 8));
  const top = Math.max(8, (anchor?.top ?? 56));

  return (
    <div className={isMobile ? "fixed inset-0 z-[140] bg-surface text-[var(--text-primary)]" : "fixed z-[140] bg-surface text-[var(--text-primary)] border border-surface-border rounded-xl shadow-2xl overflow-hidden pop-in"} style={isMobile ? undefined : { width: panelW, height: panelH, left, top }}>
      <div className="h-12 px-4 border-b border-surface-border flex items-center justify-between">
        <div className="text-sm font-semibold">Settings</div>
        <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-surface-overlay"><X size={16} /></button>
      </div>

      <div className="h-[calc(100%-3rem)] overflow-auto p-4 md:p-6">
        {view === "list" && (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-end mb-3">
              <button onClick={() => setView("pick")} className="inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-surface-overlay text-sm text-neutral-300 hover:text-white">
                <Plus size={14} /> Add Provider
              </button>
            </div>

            {loading ? (
              <div className="text-sm text-neutral-500">Loading…</div>
            ) : (
              <div className="space-y-1">
                {state.providers.map((p) => {
                  const def = PROVIDER_DEFS.find(d => d.type === p.type);
                  const active = state.active.data === p.id || state.active.ai === p.id;
                  return (
                    <button key={p.id} onClick={() => openDetail(p)} className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-surface-overlay text-left">
                      <img
                        src={p.type === "alpaca" ? (isLight ? ALPACA_LOGO_LIGHT : ALPACA_LOGO_DARK) : PROVIDER_LOGOS[p.type]}
                        alt={p.type}
                        className="w-4 h-4 rounded-sm"
                        onError={(e) => {
                          if (p.type === "alpaca") (e.currentTarget as HTMLImageElement).src = ALPACA_LOGO_DARK;
                        }}
                      />
                      <span className="text-sm text-white">{def?.label || p.type}</span>
                      <span className={`ml-auto w-2 h-2 rounded-full ${active ? "bg-green-400" : "bg-green-500/80"}`} />
                    </button>
                  );
                })}
                {!state.providers.length && <div className="text-sm text-neutral-500 py-8">No providers configured yet.</div>}
              </div>
            )}
          </div>
        )}

        {view === "pick" && (
          <div className="max-w-3xl mx-auto">
            <button onClick={() => setView("list")} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-white mb-3"><ArrowLeft size={14} /> Back</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROVIDER_DEFS.map((p) => (
                <button key={p.type} onClick={() => openDetail(undefined, p.type)} className="text-left px-3 py-2 rounded hover:bg-surface-overlay">
                  <div className="text-white text-sm inline-flex items-center gap-2">{p.icon} {p.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "detail" && currentDef && (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setView("list")} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-white"><ArrowLeft size={14} /> Back</button>
              {editing && (
                <details className="relative">
                  <summary className="list-none cursor-pointer px-2 py-1 rounded hover:bg-surface-overlay text-sm text-neutral-300">Actions</summary>
                  <div className="absolute right-0 top-7 z-20 rounded bg-surface-raised border border-surface-border shadow-xl p-1 min-w-[120px] pop-in">
                    <button onClick={() => activate(editing)} className="w-full text-left px-2 py-1 rounded text-sm hover:bg-surface-overlay">Set Active</button>
                    <button onClick={remove} className="w-full text-left px-2 py-1 rounded text-sm text-red-300 hover:bg-surface-overlay">Delete</button>
                  </div>
                </details>
              )}
            </div>
            <div className="space-y-3">
              <div className="text-sm text-white inline-flex items-center gap-2"><img src={currentDef.type === "alpaca" ? (isLight ? ALPACA_LOGO_LIGHT : ALPACA_LOGO_DARK) : PROVIDER_LOGOS[currentDef.type]} alt={currentDef.type} className="w-4 h-4 rounded-sm" onError={(e) => { if (currentDef.type === "alpaca") (e.currentTarget as HTMLImageElement).src = ALPACA_LOGO_DARK; }} /> {currentDef.label}</div>
              {currentDef.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[11px] text-neutral-500">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="cb-input w-full bg-transparent border border-neutral-500/70 rounded px-3 py-2 text-sm"
                  />
                </div>
              ))}

              <div className="pt-1 text-[11px] text-neutral-500">Changes save automatically.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
