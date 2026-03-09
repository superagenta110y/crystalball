"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const PRESET_COLORS = ["#60a5fa", "#f59e0b", "#22d3ee", "#a78bfa", "#e879f9", "#ef4444", "#10b981", "#3b82f6", "#f97316", "#14b8a6", "#84cc16", "#f43f5e", "#8b5cf6", "#64748b", "#ffffff"];

function hslToHex(h: number, s = 100, l = 50) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ColorRingPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ringRef = useRef<HTMLDivElement>(null);

  const setFromEvent = (e: MouseEvent) => {
    if (!ringRef.current) return;
    const r = ringRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const x = e.clientX - cx;
    const y = e.clientY - cy;
    const dist = Math.sqrt(x * x + y * y);
    const outer = r.width / 2;
    const inner = outer - 14;
    if (dist < inner || dist > outer) return;
    const ang = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
    onChange(hslToHex(ang));
  };

  return (
    <div
      ref={ringRef}
      onMouseDown={(e) => {
        setFromEvent(e.nativeEvent);
        const move = (ev: MouseEvent) => setFromEvent(ev);
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
      className="relative w-28 h-28 rounded-full cursor-crosshair"
      style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
    >
      <div className="absolute inset-[11px] rounded-full bg-white flex items-center justify-center">
        <div className="w-[74px] h-[74px] rounded-full border border-surface-border" style={{ background: value }} />
      </div>
    </div>
  );
}

export function AppColorPicker({ value, onChange, swatchClassName = "w-6 h-6" }: { value: string; onChange: (v: string) => void; swatchClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button type="button" onClick={() => setOpen(v => !v)} className={`${swatchClassName} rounded-full border border-surface-border`} style={{ background: value }} title="Pick color" />

      {open && !customOpen && (
        <div className="absolute right-0 top-8 z-50 rounded-lg border border-surface-border bg-surface-raised/95 backdrop-blur px-2.5 py-2.5 shadow-2xl">
          <div className="grid grid-cols-4 gap-2 min-w-[96px]">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-5 h-5 rounded-full border-2 ${value.toLowerCase() === c.toLowerCase() ? "border-white ring-1 ring-white/40" : "border-surface-border"}`}
                style={{ background: c }}
                title={c}
              />
            ))}
            <button type="button" onClick={() => setCustomOpen(true)} className="w-5 h-5 rounded-full border-2 border-surface-border bg-gradient-to-br from-red-400 via-emerald-400 to-blue-500" title="Custom color" />
          </div>
        </div>
      )}

      {open && customOpen && (
        <div className="absolute right-0 top-8 z-50 rounded-lg border border-surface-border bg-surface-raised/95 backdrop-blur px-3 py-3 shadow-2xl">
          <div className="flex justify-end mb-1">
            <button type="button" onClick={() => { setOpen(false); setCustomOpen(false); }} className="p-0.5 rounded hover:bg-surface-overlay">
              <X size={12} />
            </button>
          </div>
          <ColorRingPicker value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
