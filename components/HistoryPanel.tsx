"use client";

import { useMemo, useState } from "react";
import type { Conversation } from "@/types/chat";

export default function HistoryPanel({ conversations, activeId, onSelect, onNew, onDelete, onTogglePin, onToggleArchive, onClose }: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return conversations.filter((conversation) => !conversation.archived).filter((conversation) => !value || conversation.title.toLowerCase().includes(value) || conversation.messages.some((message) => message.content.toLowerCase().includes(value))).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
  }, [conversations, query]);

  return <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" style={{ width: "min(780px,100%)" }} role="dialog" aria-modal="true" aria-label="Chat history">
      <div className="modal-head"><div><span className="eyebrow">Workspace</span><h2>Chat history</h2><p className="small">Saved locally on this device. Search titles and message text.</p></div><button className="close-btn" onClick={onClose} aria-label="Close history">×</button></div>
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations…" aria-label="Search conversations" style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", background: "var(--bg-2)", borderRadius: 10, padding: "10px 12px" }} /><button className="primary-btn" onClick={() => { onNew(); onClose(); }}>＋ New</button></div>
      <div style={{ display: "grid", gap: 7, maxHeight: "55dvh", overflowY: "auto" }}>
        {filtered.map((conversation) => <article key={conversation.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", border: "1px solid var(--line)", borderRadius: 12, background: conversation.id === activeId ? "var(--accent-wash)" : "var(--card-solid)", padding: 5 }}>
          <button onClick={() => { onSelect(conversation.id); onClose(); }} style={{ border: 0, background: "transparent", textAlign: "left", padding: 9, minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversation.pinned ? "★ " : ""}{conversation.title}</strong><small style={{ display: "block", color: "var(--muted)", marginTop: 4 }}>{conversation.messages.length} messages · {new Date(conversation.updatedAt).toLocaleString()}</small></button>
          <div style={{ display: "flex", gap: 3 }}><button className="icon-btn" onClick={() => onTogglePin(conversation.id)} aria-label="Pin conversation">★</button><button className="icon-btn" onClick={() => onToggleArchive(conversation.id)} aria-label="Archive conversation">⌁</button><button className="icon-btn" onClick={() => onDelete(conversation.id)} aria-label="Delete conversation">×</button></div>
        </article>)}
        {!filtered.length && <div className="small" style={{ padding: 24, textAlign: "center" }}>No matching conversations.</div>}
      </div>
    </section>
  </div>;
}
