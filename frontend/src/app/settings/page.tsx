"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Check, AlertCircle, Plus, Trash2, Zap, Settings, Database, Edit3, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";
type TabId = "general" | "providers";

interface Provider {
  id: string;
  type: string;
  name: string;
  api_key?: string;
  secret_key?: string;
  paper?: boolean;
  data_url?: string;
  url?: string;
}

interface ProvidersState {
  providers: Provider[];
  active: { data?: string };
}

// ── Small helpers ──────────────────────────────────────────────────────────

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

function StatusIcon({ status }: { status: SaveStatus }) {
  if (status === "saving") return <span className="animate-spin text-xs">⏳</span>;
  if (status === "saved")  return <Check size={13} className="text-[#00d4aa]" />;
  if (status === "error")  return <AlertCircle size={13} className="text-red-400" />;
  return <Save size={13} />;
}

function Btn({ onClick, disabled, children, variant = "default", className = "" }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode;
  variant?: "default" | "primary" | "danger" | "ghost"; className?: string;
}) {
  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const vars: Record<string, string> = {
    default: "bg-[#1e1e1e] border border-[#2a2a2a] text-neutral-300 hover:text-white hover:border-neutral-500",
    primary: "bg-[#00d4aa]/10 border border-[#00d4aa]/40 text-[#00d4aa] hover:bg-[#00d4aa]/20",
    danger:  "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20",
    ghost:   "text-neutral-500 hover:text-white",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${vars[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", mono = true }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-neutral-500 uppercase tracking-wider">{label}</label>
      <input
        type={type} value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        placeholder={placeholder}
        className={`bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm ${mono ? "font-mono" : ""} text-white placeholder-neutral-700 focus:outline-none focus:border-[#00d4aa]/50 transition ${!onChange ? "opacity-60 cursor-default" : ""}`}
      />
    </div>
  );
}

// ── Provider Form Modal ────────────────────────────────────────────────────

function ProviderModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<Provider>;
  onSave: (data: { type: string; name: string; config: Record<string, unknown> }) => Promise<void>;
  onClose: () => void;
}) {
  const [type,      setType]      = useState(initial?.type      || "alpaca");
  const [name,      setName]      = useState(initial?.name      || "");
  const [apiKey,    setApiKey]    = useState(initial?.api_key   || "");
  const [secretKey, setSecretKey] = useState(initial?.secret_key || "");
  const [paper,     setPaper]     = useState(initial?.paper     ?? true);
  const [dataUrl,   setDataUrl]   = useState(initial?.data_url  || "https://data.alpaca.markets");
  const [hwUrl,     setHwUrl]     = useState(initial?.url       || "http://127.0.0.1:7878");
  const [hwKey,     setHwKey]     = useState(initial?.api_key   || "");

  const { status, run } = useSave(async () => {
    let config: Record<string, unknown> = {};
    if (type === "alpaca") {
      config = { api_key: apiKey, secret_key: secretKey, paper, data_url: dataUrl };
    } else {
      config = { url: hwUrl, api_key: hwKey };
    }
    await onSave({ type, name, config });
    onClose();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {initial?.id ? "Edit Provider" : "Add Provider"}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Type selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-neutral-500 uppercase tracking-wider">Type</label>
          <div className="flex gap-2">
            {["alpaca", "hoodwink"].map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition capitalize ${
                  type === t
                    ? "border-[#00d4aa] bg-[#00d4aa]/10 text-[#00d4aa]"
                    : "border-[#2a2a2a] text-neutral-400 hover:text-white"
                }`}>
                {t === "alpaca" ? "Alpaca Markets" : "Hoodwink"}
              </button>
            ))}
          </div>
        </div>

        <Field label="Display Name" value={name} onChange={setName}
          placeholder={type === "alpaca" ? "Alpaca Paper" : "Hoodwink Local"} mono={false} />

        {type === "alpaca" ? (
          <>
            <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="PKXXXXXXXXXXXX" />
            <Field label="Secret Key" value={secretKey} onChange={setSecretKey} type="password" placeholder="••••••••" />
            <Field label="Data URL" value={dataUrl} onChange={setDataUrl} />
            <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer select-none">
              <input type="checkbox" checked={paper} onChange={e => setPaper(e.target.checked)}
                className="w-4 h-4 accent-[#00d4aa] rounded" />
              Paper trading mode
            </label>
            {!paper && (
              <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                ⚠️ Live trading enabled — real money at risk
              </p>
            )}
          </>
        ) : (
          <>
            <Field label="Hoodwink URL" value={hwUrl} onChange={setHwUrl} placeholder="http://127.0.0.1:7878" />
            <Field label="API Key" value={hwKey} onChange={setHwKey} type="password" placeholder="••••••••" />
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={run} disabled={status === "saving"}>
            <StatusIcon status={status} />
            {status === "saved" ? "Saved!" : "Save Provider"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Providers Tab ──────────────────────────────────────────────────────────

function ProvidersTab() {
  const [state, setState] = useState<ProvidersState>({ providers: [], active: {} });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editing?: Provider }>({ open: false });
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(`${API}/api/providers`);
    if (r.ok) setState(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createOrUpdate = async (data: { type: string; name: string; config: Record<string, unknown> }) => {
    const editing = modal.editing;
    if (editing?.id) {
      await fetch(`${API}/api/providers/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch(`${API}/api/providers`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    await load();
  };

  const activate = async (id: string) => {
    setActivating(id);
    await fetch(`${API}/api/providers/${id}/activate`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "data" }),
    });
    await load();
    setActivating(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    setDeleting(id);
    await fetch(`${API}/api/providers/${id}`, { method: "DELETE" });
    await load();
    setDeleting(null);
  };

  if (loading) return (
    <div className="text-neutral-600 text-sm animate-pulse py-8 text-center">Loading…</div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-neutral-500 max-w-md leading-relaxed">
          Configure market data providers. The active provider is used for all market data.
        </p>
        <Btn variant="primary" onClick={() => setModal({ open: true })} className="self-start sm:self-auto">
          <Plus size={13} /> Add Provider
        </Btn>
      </div>

      {state.providers.length === 0 && (
        <div className="py-10 text-center text-neutral-600 text-sm border border-dashed border-[#2a2a2a] rounded-xl">
          No providers configured.{" "}
          <button onClick={() => setModal({ open: true })} className="text-[#00d4aa] underline">Add one</button>.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {state.providers.map(p => {
          const isActive = state.active.data === p.id;
          return (
            <div key={p.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border transition ${
                isActive
                  ? "border-[#00d4aa]/40 bg-[#00d4aa]/5"
                  : "border-[#2a2a2a] bg-[#141414] hover:border-neutral-600"
              }`}>
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e1e] text-neutral-500 border border-[#2a2a2a] capitalize">
                    {p.type}
                  </span>
                  {isActive && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30">
                      active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-600 mt-1 font-mono truncate">
                  {p.api_key ? `key: ${p.api_key}` : p.url ? `url: ${p.url}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto sm:justify-end shrink-0">
                {!isActive && (
                  <Btn variant="primary" onClick={() => activate(p.id)}
                    disabled={activating === p.id} className="h-8 px-2.5">
                    <Zap size={12} />
                    <span className="hidden sm:inline">{activating === p.id ? "…" : "Activate"}</span>
                  </Btn>
                )}
                <Btn onClick={() => setModal({ open: true, editing: p })} className="h-8 px-2.5">
                  <Edit3 size={12} /> <span className="hidden sm:inline">Edit</span>
                </Btn>
                <Btn variant="danger" onClick={() => remove(p.id)} disabled={deleting === p.id} className="h-8 px-2.5">
                  <Trash2 size={12} />
                </Btn>
              </div>
            </div>
          );
        })}
      </div>

      {modal.open && (
        <ProviderModal
          initial={modal.editing}
          onSave={createOrUpdate}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}

// ── General Tab ────────────────────────────────────────────────────────────

function GeneralTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">About</h3>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-2 text-sm text-neutral-400">
          <div className="flex justify-between">
            <span>Version</span>
            <span className="font-mono text-white">0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span>Repository</span>
            <a href="https://github.com/superagenta110y/crystalball" target="_blank" rel="noreferrer"
              className="text-[#00d4aa] hover:underline font-mono text-xs">
              superagenta110y/crystalball
            </a>
          </div>
          <div className="flex justify-between">
            <span>Domain</span>
            <a href="https://crystalball.dev" target="_blank" rel="noreferrer"
              className="text-[#00d4aa] hover:underline font-mono text-xs">
              crystalball.dev
            </a>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Resources</h3>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-2 text-sm text-neutral-400">
          <p className="text-xs leading-relaxed">
            CrystalBall is a free, open-source quantitative trading platform built for 0DTE options analysis.
            Configure your data provider in the <strong className="text-neutral-300">Providers</strong> tab.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "general",   label: "General",   icon: <Settings size={14} /> },
  { id: "providers", label: "Providers", icon: <Database size={14} /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("providers");

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-neutral-200 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-[#1e1e1e] shrink-0">
        <Link href="/" className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition text-sm">
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <div className="w-px h-4 bg-[#2a2a2a]" />
        <h1 className="text-sm font-semibold text-white">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Tabs */}
        <nav className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-[#1e1e1e] flex md:flex-col py-2 md:py-4 px-2 gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition text-left whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[#1e1e1e] text-white"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-[#161616]"
              }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-white mb-4 md:mb-6">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            {activeTab === "general"   && <GeneralTab />}
            {activeTab === "providers" && <ProvidersTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
