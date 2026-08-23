"use client";

import { useMemo, useState } from "react";
import type { Conversation } from "@/types/chat";

export default function Sidebar({ conversations, activeId, onNew, onSelect, onHistory, onSettings, onTogglePin, onToggleArchive, onDelete }: {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onHistory: () => void;
  onSettings: () => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const recent = useMemo(() => conversations.filter((chat) => !chat.archived).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt), [conversations]);
  const shown = query.trim() ? recent.filter((chat) => chat.title.toLowerCase().includes(query.toLowerCase())) : recent.slice(0, 12);

  return <aside className="sidebar">
    <div className="brand-row"><img src="/ambi-logo.png" alt="Ambi" className="brand-logo" /><div><strong>Ambi</strong><span>Private local workspace</span></div></div>
    <button className="new-chat" onClick={onNew}>＋ New chat</button>
    <div className="sidebar-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" /><kbd>⌘ K</kbd></div>
    <nav className="side-nav" aria-label="Workspace">
      <button onClick={onHistory}>▤ History <span>{conversations.length}</span></button>
      <button onClick={onSettings}>◫ Memory</button>
      <button onClick={onSettings}>▣ Models</button>
      <button onClick={onSettings}>⚙ Settings</button>
    </nav>
    <div className="section-label">Recent conversations</div>
    <div className="chat-list">
      {shown.map((conversation) => <div key={conversation.id} className={`chat-item-wrap ${conversation.id === activeId ? "active" : ""}`}>
        <button className="chat-item" onClick={() => onSelect(conversation.id)}><span>{conversation.pinned ? "★ " : ""}{conversation.title}</span><small>{conversation.messages.length} msg · {new Date(conversation.updatedAt).toLocaleDateString()}</small></button>
        <div className="chat-actions"><button onClick={() => onTogglePin(conversation.id)} aria-label="Pin conversation">★</button><button onClick={() => onToggleArchive(conversation.id)} aria-label="Archive conversation">⌁</button><button onClick={() => onDelete(conversation.id)} aria-label="Delete conversation">×</button></div>
      </div>)}
      {!shown.length && <p className="small">No conversations found.</p>}
    </div>
    <button className="history-footer" onClick={onHistory}>View all history <span>→</span></button>
    <div className="sidebar-status"><span className="dot" /> Local-first · stored on this device</div>
  </aside>;
}
