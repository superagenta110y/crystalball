"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Link2, Brain, Gem, Bot, CandlestickChart, ArrowLeft } from "lucide-react";

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
    const onOpen = () => { setOpen(true); setView("list"); load(); };
    window.addEventListener("settings:open", onOpen as EventListener);
    return () => window.removeEventListener("settings:open", onOpen as EventListener);
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
      await fetch(`${API}/api/providers`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    }
    await load();
    setView("list");
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] bg-surface text-[var(--text-primary)]">
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
                      <span className={`w-2 h-2 rounded-full ${active ? "bg-green-400" : "bg-green-500/80"}`} />
                      <span className="text-neutral-300">{def?.icon}</span>
                      <span className="text-sm text-white">{def?.label || p.type}</span>
                      <span className="ml-auto text-[11px] text-neutral-500 font-mono truncate max-w-[40%]">{p.url || (p.api_key ? "configured" : "")}</span>
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
            <button onClick={() => setView("list")} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-white mb-3"><ArrowLeft size={14} /> Back</button>
            <div className="space-y-3">
              <div className="text-sm text-white inline-flex items-center gap-2">{currentDef.icon} {currentDef.label}</div>
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

              {editing && (
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => activate(editing)} className="px-2 py-1 rounded hover:bg-surface-overlay text-sm text-neutral-300">Set Active</button>
                  <button onClick={remove} className="px-2 py-1 rounded hover:bg-surface-overlay text-sm text-red-300 inline-flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                </div>
              )}

              <div className="pt-1">
                <button onClick={save} className="px-3 py-1.5 rounded hover:bg-surface-overlay text-sm text-white">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
