"use client";

import { useEffect, useState } from "react";
import type { MemoryItem } from "@/types/chat";
import { clearMemories, forgetMemory, updateMemory } from "@/lib/memory/api";
import { memoryStore } from "@/lib/memory/store";

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      setMemories(await memoryStore.loadMemories());
    } catch {
      setMessage("Memory storage is unavailable on this device.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const startEdit = (memory: MemoryItem) => {
    setEditingId(memory.id);
    setDraft(memory.text);
    setMessage("");
  };

  const saveEdit = async (memory: MemoryItem) => {
    setBusyId(memory.id);
    try {
      const updated = await updateMemory(memory.id, draft, memory.kind);
      if (updated) setMemories((current) => current.map((item) => item.id === memory.id ? updated : item));
      setEditingId(null);
      setMessage("Memory updated locally.");
    } catch {
      setMessage("That memory could not be updated.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await forgetMemory(id);
      setMemories((current) => current.filter((item) => item.id !== id));
      if (editingId === id) setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear every saved memory from this device?")) return;
    setBusyId("all");
    try {
      await clearMemories();
      setMemories([]);
      setEditingId(null);
      setMessage("All saved memories were cleared from local storage.");
    } finally {
      setBusyId(null);
    }
  };

  return <section className="memory-panel" aria-labelledby="memory-panel-title">
    <div className="panel-toolbar">
      <div>
        <span className="eyebrow">LOCAL MEMORY</span>
        <h3 id="memory-panel-title">Memory Center</h3>
        <p className="panel-copy">Saved memories stay in Ambi&apos;s local IndexedDB store. Review, edit, or remove them individually.</p>
      </div>
      <button className="danger-btn" onClick={() => void clearAll()} disabled={loading || busyId !== null || memories.length === 0}>Clear all</button>
    </div>

    {message && <div className="inline-note" role="status">{message}</div>}
    {loading ? <p className="panel-copy">Loading saved memories…</p> : memories.length === 0 ? <div className="empty-panel"><strong>No saved memories</strong><span>Ambi has not stored any approved memory items yet.</span></div> : <div className="memory-list">
      {memories.map((memory) => <article className="memory-item" key={memory.id}>
        {editingId === memory.id ? <>
          <label className="field"><span>Memory text</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={2000} /></label>
          <div className="memory-actions"><button className="primary-btn" onClick={() => void saveEdit(memory)} disabled={busyId === memory.id || !draft.trim()}>Save</button><button className="secondary-btn" onClick={() => setEditingId(null)}>Cancel</button></div>
        </> : <>
          <div className="memory-main"><div className="memory-kind">{memory.kind.toUpperCase()}</div><p>{memory.text}</p><small>Updated {formatDate(memory.updatedAt)}{memory.sourceConversationId ? ` · Source ${memory.sourceConversationId.slice(0, 12)}` : ""}</small></div>
          <div className="memory-actions"><button className="secondary-btn" onClick={() => startEdit(memory)} disabled={busyId !== null}>Edit</button><button className="danger-btn" onClick={() => void remove(memory.id)} disabled={busyId !== null}>Delete</button></div>
        </>}
      </article>)}
    </div>}
  </section>;
}
