/**
 * AIAssistantWidget — Chat interface for AI market analysis.
 * Routes to /api/ai/chat (POST) which uses configured OpenAI or Anthropic key.
 *
 * TODO:
 *   - Add context injection: current symbol, GEX level, market status
 *   - Add canned prompts: "Analyze GEX", "What's the bias?", "Key levels?"
 *   - Streaming response support (SSE)
 *   - Save conversation history (SQLite via backend)
 */
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! I'm your AI trading assistant. Ask me anything about the current market — GEX levels, key strikes, bias, or options flow. I'll use your live dashboard data as context.",
};

const CANNED_PROMPTS = [
  "What's the current market bias?",
  "Explain the GEX flip level",
  "Key support and resistance today",
  "Summarize today's news",
];

interface AIAssistantWidgetProps {
  symbol?: string;
}

export function AIAssistantWidget({ symbol = "SPY" }: AIAssistantWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          symbol,
          history: messages.slice(-6), // last 3 turns
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { reply: string };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Error: ${err instanceof Error ? err.message : "Failed to reach AI backend. Is your API key configured?"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              msg.role === "assistant" ? "bg-accent/20 text-accent" : "bg-surface-border text-neutral-400"
            }`}>
              {msg.role === "assistant" ? <Bot size={12} /> : <User size={12} />}
            </div>
            <div className={`max-w-[85%] text-xs leading-relaxed rounded-xl px-3 py-2 ${
              msg.role === "assistant"
                ? "bg-surface-overlay text-neutral-200"
                : "bg-accent/10 border border-accent/20 text-neutral-200"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-accent/20 text-accent">
              <Bot size={12} />
            </div>
            <div className="bg-surface-overlay rounded-xl px-3 py-2">
              <Loader2 size={12} className="animate-spin text-neutral-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Canned prompts */}
      <div className="flex gap-1.5 px-3 pb-1 flex-wrap">
        {CANNED_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={loading}
            className="ai-chip text-xs px-2 py-1 rounded-full bg-surface-overlay border border-surface-border text-neutral-500 hover:text-white hover:border-accent/40 transition"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2 p-2 border-t border-surface-border"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the market..."
          disabled={loading}
          className="ai-input flex-1 bg-surface-overlay border border-surface-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition placeholder:text-neutral-600"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg transition disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
