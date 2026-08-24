"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, CapabilityState, Conversation, HealthState, Message } from "@/types/chat";
import { CLOUD_MODEL_CATALOG, DEFAULT_SETTINGS, SYSTEM_PROMPT } from "@/lib/constants";
import { uid } from "@/lib/id";
import { memoryStore } from "@/lib/memory/store";
import { buildContext } from "@/lib/memory/context";
import { checkUserMessage, redactSecrets } from "@/lib/security/safety";
import { streamCloudChat, CloudInferenceError } from "@/lib/ai/cloud";
import { runOptionalTool } from "@/lib/tools/router";
import { wantsWebSearch } from "@/lib/tools/intents";
import { detectCapabilities } from "@/lib/ai/capabilities";
import Composer from "@/components/Composer";
import EmptyState from "@/components/EmptyState";
import MessageBubble from "@/components/MessageBubble";
import SettingsModal from "@/components/SettingsModal";
import MemoryPanel from "@/components/MemoryPanel";

function newConversation(): Conversation { const now = Date.now(); return { id: uid("chat"), title: "New conversation", messages: [], createdAt: now, updatedAt: now }; }
function titleFor(text: string) { return text.trim().replace(/\s+/g, " ").slice(0, 48) || "New conversation"; }
const initialHealth: HealthState = { inference: "unavailable", storage: "ready", network: "online", recovery: "idle", lastRecoveryAt: null, safeMode: false, webSearch: "disabled" };

export default function AmbiShell() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [caps] = useState<CapabilityState | null>(() => typeof window === "undefined" ? null : detectCapabilities());
  const [health, setHealth] = useState<HealthState>(initialHealth);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const active = useMemo(() => conversations.find((item) => item.id === activeId) ?? null, [conversations, activeId]);
  const activeModel = CLOUD_MODEL_CATALOG.find((model) => model.id === settings.model) ?? CLOUD_MODEL_CATALOG[0];
  const visibleConversations = useMemo(() => conversations.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())), [conversations, search]);

  async function refreshAiHealth() {
    try { const response = await fetch("/api/health/groq", { cache: "no-store" }); setHealth((h) => ({ ...h, inference: response.ok ? "ready" : "error", network: "online", safeMode: !response.ok, recovery: response.ok ? "idle" : "safe" })); }
    catch { setHealth((h) => ({ ...h, inference: "error", network: "offline", safeMode: true, recovery: "safe" })); }
  }

  useEffect(() => {
    const syncNetwork = () => setHealth((h) => ({ ...h, network: navigator.onLine ? "online" : "offline" }));
    const onNew = () => { const chat = newConversation(); setConversations((items) => [chat, ...items]); setActiveId(chat.id); };
    const onMemory = () => setMemoryOpen(true);
    syncNetwork();
    window.addEventListener("online", syncNetwork); window.addEventListener("offline", syncNetwork); window.addEventListener("ambi:new-chat", onNew); window.addEventListener("ambi:open-memory", onMemory);
    void (async () => {
      try {
        const [saved, storedSettings, storedActive] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadSettings(), memoryStore.loadActiveConversationId()]);
        const safeSettings = storedSettings ? { ...DEFAULT_SETTINGS, ...storedSettings, localOnly: false } : DEFAULT_SETTINGS;
        setConversations(saved); setSettings(safeSettings); setActiveId(storedActive && saved.some((c) => c.id === storedActive) ? storedActive : saved.find((c) => !c.archived)?.id ?? null);
        await refreshAiHealth();
      } catch { setHealth((h) => ({ ...h, storage: "degraded", recovery: "safe", safeMode: true, lastRecoveryAt: Date.now() })); }
      finally { setHydrated(true); }
    })();
    return () => { window.removeEventListener("online", syncNetwork); window.removeEventListener("offline", syncNetwork); window.removeEventListener("ambi:new-chat", onNew); window.removeEventListener("ambi:open-memory", onMemory); };
  }, []);

  useEffect(() => { if (!hydrated || settings.temporaryChat) return; void memoryStore.saveConversations(conversations).catch(() => setHealth((h) => ({ ...h, storage: "degraded" }))); }, [conversations, hydrated, settings.temporaryChat]);
  useEffect(() => { if (!hydrated) return; void memoryStore.saveSettings(settings).catch(() => undefined); void memoryStore.saveActiveConversationId(activeId).catch(() => undefined); document.documentElement.dataset.theme = settings.theme; document.documentElement.dataset.motion = settings.reducedMotion ? "reduced" : "full"; }, [settings, activeId, hydrated]);

  function createChat() { const chat = newConversation(); setConversations((items) => [chat, ...items]); setActiveId(chat.id); setHistoryOpen(false); }
  function deleteChat(id: string) { setConversations((items) => items.filter((item) => item.id !== id)); if (activeId === id) setActiveId(null); }
  function stop() { controllerRef.current?.abort(); requestIdRef.current = null; setBusy(false); }

  async function send(text: string) {
    const clean = text.trim(); if (!clean || busy) return;
    const decision = checkUserMessage(clean); const chatId = activeId ?? uid("chat"); const current = conversations.find((c) => c.id === chatId) ?? { ...newConversation(), id: chatId, title: titleFor(clean) };
    if (!decision.allowed) { const blocked: Message = { id: uid("msg"), role: "assistant", content: decision.reason ?? "I can't help with that request.", createdAt: Date.now(), status: "complete", source: "local" }; const next = { ...current, title: current.messages.length ? current.title : titleFor(clean), messages: [...current.messages, blocked], updatedAt: Date.now() }; setConversations((items) => items.some((c) => c.id === chatId) ? items.map((c) => c.id === chatId ? next : c) : [next, ...items]); setActiveId(chatId); return; }
    if (!navigator.onLine) { const user: Message = { id: uid("msg"), role: "user", content: clean, createdAt: Date.now(), status: "complete" }; const error: Message = { id: uid("msg"), role: "assistant", content: "Ambi needs an internet connection for Groq AI. Reconnect and try again.", createdAt: Date.now(), status: "error", source: "cloud" }; const next = { ...current, title: current.messages.length ? current.title : titleFor(clean), messages: [...current.messages, user, error] }; setConversations((items) => items.some((c) => c.id === chatId) ? items.map((c) => c.id === chatId ? next : c) : [next, ...items]); setActiveId(chatId); return; }

    const user: Message = { id: uid("msg"), role: "user", content: clean, createdAt: Date.now(), status: "complete" };
    const conversationWithUser: Conversation = { ...current, title: current.messages.length ? current.title : titleFor(clean), messages: [...current.messages, user], updatedAt: Date.now() };
    setConversations((items) => items.some((c) => c.id === chatId) ? items.map((c) => c.id === chatId ? conversationWithUser : c) : [conversationWithUser, ...items]); setActiveId(chatId); setBusy(true); setHealth((h) => ({ ...h, inference: "loading", safeMode: false, recovery: "idle" }));

    const responseId = uid("msg"); const placeholder: Message = { id: responseId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", source: "cloud" };
    setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, placeholder] } : c));
    const requestId = uid("request"); requestIdRef.current = requestId; const controller = new AbortController(); controllerRef.current = controller;
    let citations: Message["citations"] = [];
    try {
      let toolText = "";
      if (settings.webSearch && wantsWebSearch(clean)) { const result = await runOptionalTool("web_search", clean); if (result.ok) { citations = result.citations ?? []; toolText = `[Untrusted web research]\n${result.text}`; setHealth((h) => ({ ...h, webSearch: "ready" })); } else setHealth((h) => ({ ...h, webSearch: "error" })); }
      const enriched: Conversation = toolText ? { ...conversationWithUser, messages: [...conversationWithUser.messages, { id: uid("tool"), role: "tool", content: toolText, createdAt: Date.now(), status: "complete", source: "web" }] } : conversationWithUser;
      const memories = settings.memoryEnabled && !settings.temporaryChat ? await memoryStore.loadMemories() : [];
      const modelMessages = buildContext(enriched, SYSTEM_PROMPT, memories); let output = "";
      await streamCloudChat({ messages: modelMessages, model: settings.model, signal: controller.signal, onDelta: (delta) => { if (requestIdRef.current !== requestId) return; output += delta; setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: c.messages.map((m) => m.id === responseId ? { ...m, content: redactSecrets(output), citations } : m) } : c)); } });
      if (requestIdRef.current !== requestId) return; const final = redactSecrets(output.trim()); if (!final) throw new CloudInferenceError("Groq returned no text. Please try again.", "EMPTY_RESPONSE");
      setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: c.messages.map((m) => m.id === responseId ? { ...m, content: final, status: "complete", source: "cloud", citations } : m), updatedAt: Date.now() } : c)); setHealth((h) => ({ ...h, inference: "ready", safeMode: false, recovery: "idle", network: "online" }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Ambi could not reach Groq.";
      setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: c.messages.map((m) => m.id === responseId ? { ...m, content: `${message}\n\nOpen Settings → Diagnostics and test the connection.`, status: "error", source: "cloud" } : m) } : c)); setHealth((h) => ({ ...h, inference: "error", safeMode: true, recovery: "safe", lastRecoveryAt: Date.now() }));
    } finally { if (requestIdRef.current === requestId) requestIdRef.current = null; controllerRef.current = null; setBusy(false); }
  }

  return <div className="ambi">
    <aside className="sidebar"><div className="brand"><img src="/ambi-logo.png" alt="Ambi"/><div><strong>Ambi</strong><small>Calm AI workspace</small></div></div><button className="new-chat" onClick={createChat}>＋ New chat</button><div className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats"/><kbd>⌘K</kbd></div><nav className="nav"><button onClick={() => setHistoryOpen(true)}>▤ History · {conversations.length}</button><button onClick={() => setMemoryOpen(true)}>◈ Memory</button><button onClick={() => setSettingsOpen(true)}>⚙ Settings</button></nav><div className="section-title">Recent conversations</div><div className="conversation-list">{visibleConversations.filter((c) => !c.archived).slice(0, 30).map((c) => <div key={c.id} className={`conversation ${c.id === activeId ? "active" : ""}`}><button onClick={() => setActiveId(c.id)}><span>{c.title}</span><small>{c.messages.length} messages</small></button><button className="delete" onClick={() => deleteChat(c.id)} aria-label="Delete chat">×</button></div>)}</div><div className="sidebar-foot"><span><strong>●</strong> Groq AI</span><span>{health.network === "online" ? "Online" : "Offline"}</span></div></aside>
    <main className="main"><header className="topbar"><div className="mobile-brand"><img src="/ambi-logo.png" alt="Ambi"/><strong>Ambi</strong></div><button className="model-button" onClick={() => setSettingsOpen(true)} title={activeModel.description}><span className="provider-dot"/>{activeModel.name} ▾</button><div className="status"><span className="online-dot"/><span>{health.inference === "ready" ? "AI connected" : health.inference === "error" ? "AI needs attention" : "Checking AI…"}</span><button className="settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button></div></header>{health.safeMode && <div style={{ padding: "10px 24px", color: "#7a423d", fontSize: 11, textAlign: "center" }}>Groq connection needs attention. Open Settings → Diagnostics.</div>}<div className="content"><section className="messages">{active?.messages.length ? active.messages.map((message) => <MessageBubble key={message.id} message={message}/>) : <EmptyState onSuggestion={send}/>}</section></div><Composer onSend={send} onStop={stop} busy={busy} webSearch={settings.webSearch} onToggleResearch={() => setSettings((s) => ({ ...s, webSearch: !s.webSearch }))}/></main>
    {historyOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}><section className="modal"><div className="modal-header"><div><span className="eyebrow">CHAT HISTORY</span><h2>All conversations</h2></div><button className="close" onClick={() => setHistoryOpen(false)}>×</button></div>{visibleConversations.map((c) => <div className="row" key={c.id}><div><strong>{c.title}</strong><p>{c.messages.length} messages</p></div><button className="secondary" onClick={() => { setActiveId(c.id); setHistoryOpen(false); }}>Open</button></div>)}</section></div>}
    {memoryOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setMemoryOpen(false); }}><section className="modal"><div className="modal-header"><div><span className="eyebrow">PRIVACY</span><h2>Memory Center</h2></div><button className="close" onClick={() => setMemoryOpen(false)}>×</button></div><MemoryPanel/></section></div>}
    {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} capabilities={caps} health={health} onClose={() => setSettingsOpen(false)} onRefreshHealth={refreshAiHealth}/>} 
  </div>;
}
