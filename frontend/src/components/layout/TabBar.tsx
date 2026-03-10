"use client";
import React, { useState } from "react";
import { Plus, X, Pencil } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, addTab, removeTab, renameTab } = useDashboardStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmTabId, setConfirmTabId] = useState<string | null>(null);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) renameTab(editingId, editValue.trim());
    setEditingId(null);
  };

  return (
    <div className="flex items-center gap-0.5 px-2 bg-surface border-b border-surface-border shrink-0 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-lg cursor-pointer border-b-2 transition-all whitespace-nowrap select-none ${
            tab.id === activeTabId
              ? "border-accent text-white bg-surface-raised"
              : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-surface-raised/50"
          }`}
        >
          {editingId === tab.id ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-b border-accent outline-none w-20 text-white"
            />
          ) : (
            <span onDoubleClick={(e) => { e.stopPropagation(); startEdit(tab.id, tab.name); }}>
              {tab.name}
            </span>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); startEdit(tab.id, tab.name); }}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition p-0.5 rounded"
          >
            <Pencil size={10} />
          </button>

          {tabs.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if ((tab.widgets?.length || 0) > 0) setConfirmTabId(tab.id);
                else removeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition p-0.5 rounded hover:text-bear"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}

      <button
        onClick={() => addTab()}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-600 hover:text-neutral-300 transition rounded-t-lg hover:bg-surface-raised/50 whitespace-nowrap"
      >
        <Plus size={12} /> New Tab
      </button>

      {confirmTabId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-raised p-4 shadow-2xl">
            <div className="text-sm text-white mb-1">Close tab?</div>
            <div className="text-xs text-neutral-400 mb-4">This tab contains widgets. Closing it will remove that layout.</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmTabId(null)} className="px-3 py-1.5 text-xs rounded border border-surface-border hover:bg-surface-overlay">Cancel</button>
              <button onClick={() => { removeTab(confirmTabId); setConfirmTabId(null); }} className="px-3 py-1.5 text-xs rounded border border-red-500/40 text-red-300 hover:bg-red-500/10">Close Tab</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
