"use client";

import type { Conversation } from "@/types/chat";

export default function Sidebar({ conversations, activeId, onNew, onSelect, onSettings, onTogglePin, onToggleArchive, onDelete }: { conversations: Conversation[]; activeId: string | null; onNew: () => void; onSelect: (id: string) => void; onSettings: () => void; onTogglePin: (id: string) => void; onToggleArchive: (id: string) => void; onDelete: (id: string) => void; }) {
  return <aside className="sidebar">
    <div className="brand-row"><img src="/ambi-logo.png" alt="Ambi" className="brand-logo" /><div><strong>Ambi</strong><span>Local AI workspace</span></div></div>
    <button className="new-chat" onClick={onNew}>＋ New chat</button>
    <nav className="side-nav" aria-label="Workspace">
      <button onClick={onNew}>⌕ Search chats</button><button onClick={onSettings}>◫ Memory Center</button><button onClick={onSettings}>▣ Model Manager</button><button onClick={onSettings}>⚙ Settings & Privacy</button>
    </nav>
    <div className="section-label">Recent</div>
    <div className="chat-list">
      {conversations.filter((c) => !c.archived).map((conversation) => <div key={conversation.id} className={`chat-item-wrap ${conversation.id === activeId ? "active" : ""}`}>
        <button className="chat-item" onClick={() => onSelect(conversation.id)}><span>{conversation.pinned ? "★ " : ""}{conversation.title}</span><small>{conversation.messages.length} msg</small></button>
        <div className="chat-actions"><button onClick={() => onTogglePin(conversation.id)} aria-label="Pin conversation">★</button><button onClick={() => onToggleArchive(conversation.id)} aria-label="Archive conversation">⌁</button><button onClick={() => onDelete(conversation.id)} aria-label="Delete conversation">×</button></div>
      </div>)}
      {!conversations.length && <p className="small">Your conversations stay on this device by default.</p>}
    </div>
    <div className="sidebar-status"><span className="dot" /> Local-first · privacy controls available</div>
  </aside>;
}
