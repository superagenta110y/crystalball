"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bot, MessageSquare, Plus, Send, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; ts: number };
type Thread = { id: string; name: string; messages: Msg[] };

const KEY = "crystalball-assistant-threads-v1";
const FALLBACK = "To use this feature, configure an AI provider...";

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }

export function AssistantFab() {
  const [open, setOpen] = useState(false);
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
    } else {
      const t = [{ id: uuid(), name: "Thread 1", messages: [] }];
      setThreads(t); setActiveId(t[0].id);
    }
  }, []);

  useEffect(() => {
    if (threads.length) localStorage.setItem(KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    fetch("/api/ai/status").then(r => r.json()).then(d => setConfigured(!!d?.configured)).catch(() => setConfigured(false));
  }, []);

  const active = useMemo(() => threads.find(t => t.id === activeId), [threads, activeId]);

  const addThread = () => {
    const t: Thread = { id: uuid(), name: `Thread ${threads.length + 1}`, messages: [] };
    setThreads(prev => [t, ...prev]);
    setActiveId(t.id);
  };

  const append = (id: string, msg: Msg) => setThreads(prev => prev.map(t => t.id === id ? { ...t, messages: [...t.messages, msg] } : t));

  const send = async () => {
    if (!input.trim() || !active) return;
    const text = input.trim();
    setInput("");
    append(active.id, { role: "user", content: text, ts: Date.now() });

    if (!configured) {
      append(active.id, { role: "assistant", content: FALLBACK, ts: Date.now() });
      return;
    }

    setLoading(true);
    try {
      const history = (active.messages || []).slice(-8).map(m => ({ role: m.role, content: m.content }));
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history, symbol: "SPY" }) });
      const d = await r.json();
      append(active.id, { role: "assistant", content: d?.reply || "No response", ts: Date.now() });
    } catch {
      append(active.id, { role: "assistant", content: "Failed to reach AI backend.", ts: Date.now() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(v => !v)} className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-accent text-white shadow-xl flex items-center justify-center">
        {open ? <X size={18} /> : <Bot size={18} />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-[360px] h-[520px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl flex overflow-hidden">
          <div className="w-28 border-r border-surface-border p-2 flex flex-col gap-2">
            <button onClick={addThread} className="text-xs px-2 py-1 rounded border border-surface-border hover:bg-surface-overlay inline-flex items-center gap-1"><Plus size={12} /> New</button>
            <div className="flex-1 overflow-auto space-y-1">
              {threads.map(t => (
                <button key={t.id} onClick={() => setActiveId(t.id)} className={`w-full text-left text-xs px-2 py-1 rounded ${activeId===t.id ? "bg-accent/15 text-accent" : "hover:bg-surface-overlay text-neutral-400"}`}>
                  <MessageSquare size={11} className="inline mr-1" />{t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2 border-b border-surface-border text-xs text-neutral-400">Assistant</div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {(active?.messages || []).map((m, i) => (
                <div key={i} className={`text-xs px-2 py-1.5 rounded max-w-[90%] ${m.role==="user" ? "ml-auto bg-accent/15 border border-accent/30" : "bg-surface-overlay border border-surface-border"}`}>
                  {m.content}
                </div>
              ))}
              {loading && <div className="text-xs text-neutral-500">Thinking…</div>}
            </div>
            <div className="p-2 border-t border-surface-border flex gap-2">
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} className="flex-1 bg-surface-overlay border border-surface-border rounded px-2 py-1 text-xs" placeholder="Message assistant..." />
              <button onClick={send} className="px-2 py-1 rounded bg-accent/15 border border-accent/30 text-accent"><Send size={13} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
