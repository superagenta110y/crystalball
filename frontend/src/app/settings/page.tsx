"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, AlertCircle, Plus, Trash2, Zap, Settings, Database, Edit3, X,
  Brain, Gem, Bot, CandlestickChart, Link2
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type TabId = "general" | "providers";

type ProviderType = "alpaca" | "hoodwink" | "openai" | "gemini" | "claude";

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
  {
    type: "alpaca", label: "Alpaca", role: "data", icon: <CandlestickChart size={16} />,
    fields: [
      { key: "api_key", label: "API Key", placeholder: "PK..." },
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "••••••••" },
      { key: "data_url", label: "Data URL", placeholder: "https://data.alpaca.markets" },
      { key: "paper", label: "Paper Trading (true/false)", placeholder: "true" },
    ],
  },
  {
    type: "hoodwink", label: "Hoodwink", role: "data", icon: <Link2 size={16} />,
    fields: [
      { key: "url", label: "Hoodwink URL", placeholder: "http://127.0.0.1:7878" },
      { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••" },
    ],
  },
  {
    type: "openai", label: "OpenAI", role: "ai", icon: <Brain size={16} />,
    fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "sk-..." }],
  },
  {
    type: "gemini", label: "Gemini", role: "ai", icon: <Gem size={16} />,
    fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "AIza..." }],
  },
  {
    type: "claude", label: "Claude", role: "ai", icon: <Bot size={16} />,
    fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "sk-ant-..." }],
  },
];

function useSave(saveFn: () => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const run = async () => {
    setStatus("saving");
    try {
      await saveFn();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };
  return { status, run };
}

function Btn({ onClick, disabled, children, variant = "default", className = "" }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode;
  variant?: "default" | "primary" | "danger"; className?: string;
}) {
  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const vars: Record<string, string> = {
    default: "bg-[#1e1e1e] border border-[#2a2a2a] text-neutral-300 hover:text-white",
    primary: "bg-[#00d4aa]/10 border border-[#00d4aa]/40 text-[#00d4aa] hover:bg-[#00d4aa]/20",
    danger:  "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${vars[variant]} ${className}`}>{children}</button>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-neutral-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-700 focus:outline-none focus:border-[#00d4aa]/50"
      />
    </div>
  );
}

function ProviderModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<Provider>;
  onSave: (data: { type: ProviderType; config: Record<string, unknown> }) => Promise<void>;
  onClose: () => void;
}) {
  const editMode = !!initial?.id;
  const [selectedType, setSelectedType] = useState<ProviderType | null>((initial?.type as ProviderType) || null);
  const def = PROVIDER_DEFS.find(x => x.type === selectedType) || null;

  const [form, setForm] = useState<Record<string, string>>({
    api_key: initial?.api_key || "",
    secret_key: initial?.secret_key || "",
    data_url: initial?.data_url || "https://data.alpaca.markets",
    url: initial?.url || "http://127.0.0.1:7878",
    paper: String(initial?.paper ?? true),
  });

  const { status, run } = useSave(async () => {
    if (!selectedType) return;
    const config: Record<string, unknown> = { ...form };
    if (selectedType === "alpaca") {
      config.paper = String(form.paper).toLowerCase() !== "false";
    }
    await onSave({ type: selectedType, config });
    onClose();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{editMode ? "Edit Provider" : "Add Provider"}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={16} /></button>
        </div>

        {!selectedType ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PROVIDER_DEFS.map(p => (
              <button
                key={p.type}
                onClick={() => setSelectedType(p.type)}
                className="text-left p-3 rounded-xl border border-[#2a2a2a] hover:border-[#00d4aa]/60 hover:bg-[#00d4aa]/5 transition"
              >
                <div className="flex items-center gap-2 text-white text-sm">{p.icon} {p.label}</div>
                <div className="text-[11px] text-neutral-500 mt-1 uppercase">{p.role} provider</div>
              </button>
            ))}
          </div>
        ) : (
          <>
            {!editMode && (
              <button onClick={() => setSelectedType(null)} className="text-xs text-neutral-500 hover:text-white text-left">← Back to provider list</button>
            )}
            <div className="text-xs text-neutral-400">{def?.label} configuration</div>
            <div className="space-y-3">
              {def?.fields.map(f => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={form[f.key] ?? ""}
                  onChange={(v) => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder}
                  type={f.type || "text"}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Btn onClick={onClose}>Cancel</Btn>
              <Btn variant="primary" onClick={run} disabled={status === "saving"}>
                {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Error" : "Save"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProvidersTab() {
  const [state, setState] = useState<ProvidersState>({ providers: [], active: {} });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editing?: Provider }>({ open: false });
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(`${API}/api/providers`);
    if (r.ok) setState(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createOrUpdate = async (data: { type: ProviderType; config: Record<string, unknown> }) => {
    const body = { type: data.type, config: data.config };
    if (modal.editing?.id) {
      await fetch(`${API}/api/providers/${modal.editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch(`${API}/api/providers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    await load();
  };

  const activate = async (p: Provider) => {
    const def = PROVIDER_DEFS.find(x => x.type === p.type);
    if (!def) return;
    setBusy(`a:${p.id}`);
    await fetch(`${API}/api/providers/${p.id}/activate`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: def.role }) });
    await load();
    setBusy(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    setBusy(`d:${id}`);
    await fetch(`${API}/api/providers/${id}`, { method: "DELETE" });
    await load();
    setBusy(null);
  };

  const byRole = useMemo(() => ({
    data: state.providers.filter(p => ["alpaca", "hoodwink"].includes(p.type)),
    ai: state.providers.filter(p => ["openai", "gemini", "claude"].includes(p.type)),
  }), [state.providers]);

  if (loading) return <div className="text-neutral-600 text-sm animate-pulse py-8 text-center">Loading…</div>;

  const renderRow = (p: Provider, role: "data" | "ai") => {
    const isActive = (role === "data" ? state.active.data : state.active.ai) === p.id;
    const def = PROVIDER_DEFS.find(x => x.type === p.type);
    return (
      <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isActive ? "border-[#00d4aa]/40 bg-[#00d4aa]/5" : "border-[#2a2a2a] bg-[#141414]"}`}>
        <div className="text-neutral-300">{def?.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white">{def?.label || p.type}</div>
          <div className="text-[11px] text-neutral-600 font-mono truncate">{p.api_key ? `key: ${p.api_key}` : p.url ? `url: ${p.url}` : "configured"}</div>
        </div>
        {!isActive && <Btn variant="primary" onClick={() => activate(p)} disabled={busy === `a:${p.id}`}><Zap size={12} /> Activate</Btn>}
        <Btn onClick={() => setModal({ open: true, editing: p })}><Edit3 size={12} /> Edit</Btn>
        <Btn variant="danger" onClick={() => remove(p.id)} disabled={busy === `d:${p.id}`}><Trash2 size={12} /></Btn>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">Configure data and AI providers.</p>
        <Btn variant="primary" onClick={() => setModal({ open: true })}><Plus size={13} /> Add Provider</Btn>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-neutral-500">Data Providers</h3>
        {byRole.data.length ? byRole.data.map(p => renderRow(p, "data")) : <div className="text-xs text-neutral-600 border border-dashed border-[#2a2a2a] rounded-xl p-4">No data providers configured.</div>}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-neutral-500">AI Providers</h3>
        {byRole.ai.length ? byRole.ai.map(p => renderRow(p, "ai")) : <div className="text-xs text-neutral-600 border border-dashed border-[#2a2a2a] rounded-xl p-4">No AI providers configured.</div>}
      </section>

      {modal.open && <ProviderModal initial={modal.editing} onSave={createOrUpdate} onClose={() => setModal({ open: false })} />}
    </div>
  );
}

function GeneralTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">About</h3>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-sm text-neutral-400">
          CrystalBall settings and provider management.
        </div>
      </div>
    </div>
  );
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <Settings size={14} /> },
  { id: "providers", label: "Providers", icon: <Database size={14} /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("providers");

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-neutral-200 flex flex-col">
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-[#1e1e1e] shrink-0">
        <Link href="/" className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition text-sm">
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <div className="w-px h-4 bg-[#2a2a2a]" />
        <h1 className="text-sm font-semibold text-white">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <nav className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-[#1e1e1e] flex md:flex-col py-2 md:py-4 px-2 gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition text-left whitespace-nowrap ${activeTab === tab.id ? "bg-[#1e1e1e] text-white" : "text-neutral-500 hover:text-neutral-300 hover:bg-[#161616]"}`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl">
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "providers" && <ProvidersTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
