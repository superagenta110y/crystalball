"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bot, MessageSquare, Plus, Send, X, Menu, Pencil, Trash2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; ts: number };
type Thread = { id: string; name: string; messages: Msg[] };

const KEY = "crystalball-assistant-threads-v2";
const FALLBACK = "To use this feature, configure an AI provider...";

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }

const SUGGESTIONS = [
  "Summarize today's SPY action",
  "Top bullish and bearish levels",
  "What changed in OI today?",
  "Quick macro risk check",
];

export function AssistantFab({ showFab = false }: { showFab?: boolean }) {
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number; bottom: number; left: number } | null>(null);
  const [vw, setVw] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [vh, setVh] = useState<number>(typeof window !== "undefined" ? window.innerHeight : 900);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean>(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const t = JSON.parse(raw) as Thread[];
      setThreads(t);
      setActiveId(t[0]?.id || "");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    fetch("/api/ai/status").then(r => r.json()).then(d => setConfigured(!!d?.configured)).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<any>;
      const a = ce?.detail?.anchor;
      if (a && typeof a.top === "number") setAnchor(a);
      else {
        const el = document.getElementById("topbar-chat-button");
        if (el) {
          const r = el.getBoundingClientRect();
          setAnchor({ top: r.top, right: r.right, bottom: r.bottom, left: r.left });
        }
      }
      setOpen(true);
    };
    window.addEventListener("assistant:open", onOpen as EventListener);
    return () => window.removeEventListener("assistant:open", onOpen as EventListener);
  }, []);

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const active = useMemo(() => threads.find(t => t.id === activeId), [threads, activeId]);

  const updateThread = (id: string, fn: (t: Thread) => Thread) => setThreads(prev => prev.map(t => t.id === id ? fn(t) : t));

  const append = (id: string, msg: Msg) => updateThread(id, (t) => ({ ...t, messages: [...t.messages, msg] }));

  const createThread = (firstMessage?: string) => {
    const t: Thread = { id: uuid(), name: `Thread ${threads.length + 1}`, messages: [] };
    setThreads(prev => [t, ...prev]);
    setActiveId(t.id);
    if (firstMessage) setInput(firstMessage);
    return t.id;
  };

  const removeThread = (id: string) => {
    const next = threads.filter(t => t.id !== id);
    setThreads(next);
    setActiveId(next[0]?.id || "");
  };

  const renameThread = (id: string) => {
    const t = threads.find(x => x.id === id);
    const v = prompt("Rename thread", t?.name || "")?.trim();
    if (!v) return;
    updateThread(id, (x) => ({ ...x, name: v }));
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text) return;
    setInput("");

    if (!configured) {
      // no thread should be created when AI unavailable
      alert(FALLBACK);
      return;
    }

    let tid = activeId;
    if (!tid) tid = createThread();

    append(tid, { role: "user", content: text, ts: Date.now() });

    setLoading(true);
    try {
      const th = threads.find(t => t.id === tid);
      const history = (th?.messages || []).slice(-8).map(m => ({ role: m.role, content: m.content }));
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history, symbol: "SPY" }) });
      const d = await r.json();
      append(tid, { role: "assistant", content: d?.reply || "No response", ts: Date.now() });
      updateThread(tid, (t) => ({ ...t, name: t.messages.length <= 1 ? text.slice(0, 28) : t.name }));
    } catch {
      append(tid, { role: "assistant", content: "Failed to reach AI backend.", ts: Date.now() });
    } finally {
      setLoading(false);
    }
  };

  const isMobile = vw < 768;
  const panelW = 380;
  const panelH = 560;
  const anchoredLeft = Math.max(8, Math.min((anchor ? anchor.right : vw - 16) - panelW, vw - panelW - 8));
  const anchoredTop = Math.max(8, Math.min(anchor ? anchor.top : 64, vh - panelH - 8));

  return (
    <>
      {showFab && (
        <button onClick={() => setOpen(v => !v)} className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-accent text-white shadow-xl flex items-center justify-center">
          {open ? <X size={18} /> : <Bot size={18} />}
        </button>
      )}

      {open && (
        <div
          className={isMobile
            ? "fixed inset-0 z-50 w-screen h-[100dvh] bg-surface-raised overflow-hidden"
            : "fixed z-40 w-[380px] h-[560px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl overflow-hidden"}
          style={isMobile ? undefined : { left: anchoredLeft, top: anchoredTop }}
        >
          <div className="h-full flex">
            {drawerOpen && (
              <div className="w-44 border-r border-surface-border p-2 flex flex-col gap-2">
                <button onClick={() => createThread()} className="text-xs px-2 py-1 rounded border border-surface-border hover:bg-surface-overlay inline-flex items-center gap-1"><Plus size={12} /> New</button>
                <div className="flex-1 overflow-auto space-y-1">
                  {threads.map(t => (
                    <div key={t.id} className={`group rounded ${activeId===t.id ? "bg-accent/15" : "hover:bg-surface-overlay"}`}>
                      <button onClick={() => setActiveId(t.id)} className="w-full text-left text-xs px-2 py-1 inline-flex items-center gap-1">
                        <MessageSquare size={11} /> <span className="truncate">{t.name}</span>
                      </button>
                      <div className="px-2 pb-1 hidden group-hover:flex gap-2 text-neutral-500">
                        <button onClick={() => renameThread(t.id)}><Pencil size={10} /></button>
                        <button onClick={() => removeThread(t.id)}><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 border-b border-surface-border text-xs text-neutral-300 flex items-center justify-between">
                <button onClick={() => setDrawerOpen(v => !v)} className="inline-flex items-center gap-1"><Menu size={14} /> Threads</button>
                <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white"><X size={14} /></button>
              </div>

              <div className="flex-1 overflow-auto p-3 space-y-2">
                {active?.messages?.length ? active.messages.map((m, i) => (
                  <div key={i} className={`text-xs px-2 py-1.5 rounded max-w-[90%] ${m.role==="user" ? "ml-auto bg-accent/15 border border-accent/30" : "bg-surface-overlay border border-surface-border"}`}>
                    {m.content}
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-sm gap-2">
                    <Bot size={26} className="opacity-60" />
                    <div>What do you want to know?</div>
                  </div>
                )}
                {loading && <div className="text-xs text-neutral-500">Thinking…</div>}
              </div>

              <div className="px-2 pb-1 flex flex-wrap gap-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} className="text-[10px] px-2 py-1 rounded-full border border-surface-border hover:bg-surface-overlay">{s}</button>
                ))}
              </div>

              <div className="p-2 border-t border-surface-border flex gap-2">
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} className="flex-1 bg-surface-overlay border border-surface-border rounded px-2 py-1 text-xs" placeholder="Message assistant..." />
                <button onClick={() => send()} className="px-2 py-1 rounded bg-accent/15 border border-accent/30 text-accent"><Send size={13} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
