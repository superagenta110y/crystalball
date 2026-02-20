"use client";
import React, { useState } from "react";
import { Plus, X, Pencil } from "lucide-react";
import { useDashboardStore } from "@/lib/store/dashboardStore";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, addTab, removeTab, renameTab } = useDashboardStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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
              onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
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
    </div>
  );
}
