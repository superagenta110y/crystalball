"use client";

import React, { useEffect, useRef, useState } from "react";

type Option = { value: string; label: string };

export function AppDropdown({ value, options, onChange, className = "", menuClassName = "" }: { value: string; options: Option[]; onChange: (v: string) => void; className?: string; menuClassName?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(v => !v)} className="px-2 py-1 rounded hover:bg-surface-overlay text-xs text-neutral-300">
        {current?.label}
      </button>
      {open && (
        <div className={`absolute left-0 top-full mt-1 z-50 rounded bg-surface-raised shadow-xl p-1 pop-in min-w-[110px] ${menuClassName}`}>
          {options.filter(o => o.value !== value).map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} className="w-full text-left px-2 py-1 rounded text-xs text-neutral-300 hover:text-white hover:bg-surface-overlay">
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
