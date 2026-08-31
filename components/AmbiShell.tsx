"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, CapabilityState, Conversation, HealthState, Message } from "@/types/chat";
import { CLOUD_MODEL_CATALOG, DEFAULT_SETTINGS, SYSTEM_PROMPT } from "@/lib/constants";
import { uid } from "@/lib/id";
import { memoryStore } from "@/lib/memory/store";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  async function refreshAiHealth(probe = false) {
    try {
      const response = await fetch(`/api/health/groq?probe=${probe ? "1" : "0"}`, { cache: "no-store" });
      setHealth((h) => ({ ...h, inference: response.ok ? "ready" : "error", network: navigator.onLine ? "online" : "offline", safeMode: !response.ok, recovery: response.ok ? "idle" : "safe" }));
    } catch { setHealth((h) => ({ ...h, inference: "error", network: "offline", safeMode: true, recovery: "safe" })); }
  }

  async function refreshResearchHealth() {
    try {
      const response = await fetch("/api/search?probe=1", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; provider?: string; enabled?: boolean };
      setHealth((h) => ({ ...h, webSearch: response.ok && data.enabled ? "ready" : "disabled" }));
    } catch { setHealth((h) => ({ ...h, webSearch: "error" })); }
  }

  useEffect(() => {
    const syncNetwork = () => setHealth((h) => ({ ...h, network: navigator.onLine ? "online" : "offline" }));
    const syncConversations = () => { void memoryStore.loadConversations().then((saved) => setConversations(saved)).catch(() => setHealth((h) => ({ ...h, storage: "degraded" }))); };
    const onNew = () => { const chat = newConversation(); setConversations((items) => [chat, ...items]); setActiveId(chat.id); setHistoryOpen(false); setMobileNavOpen(false); };
    const onMemory = () => { setMemoryOpen(true); setSettingsOpen(false); setMobileNavOpen(false); };
    syncNetwork();
    window.addEventListener("online", syncNetwork); window.addEventListener("offline", syncNetwork); window.addEventListener("ambi:new-chat", onNew); window.addEventListener("ambi:open-memory", onMemory); window.addEventListener("ambi:conversation-sync", syncConversations);
    void (async () => {
      try {
        const [saved, storedSettings, storedActive] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadSettings(), memoryStore.loadActiveConversationId()]);
        const safeSettings = storedSettings ? { ...DEFAULT_SETTINGS, ...storedSettings, localOnly: false } : DEFAULT_SETTINGS;
        setConversations(saved); setSettings(safeSettings); setActiveId(storedActive && saved.some((c) => c.id === storedActive) ? storedActive : saved.find((c) => !c.archived)?.id ?? null);
        await Promise.all([refreshAiHealth(), refreshResearchHealth()]);
      } catch { setHealth((h) => ({ ...h, storage: "degraded", recovery: "safe", safeMode: true, lastRecoveryAt: Date.now() })); }
      finally { setHydrated(true); }
    })();
    return () => { window.removeEventListener("online", syncNetwork); window.removeEventListener("offline", syncNetwork); window.removeEventListener("ambi:new-chat", onNew); window.removeEventListener("ambi:open-memory", onMemory); window.removeEventListener("ambi:conversation-sync", syncConversations); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void memoryStore.saveSettings(settings).catch(() => undefined);
    void memoryStore.saveActiveConversationId(activeId).catch(() => undefined);
    const root = document.documentElement;
    root.dataset.motion = settings.reducedMotion ? "reduced" : "full";
    const applyTheme = () => { const resolved = settings.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : settings.theme; root.dataset.theme = resolved; };
    applyTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)"); media.addEventListener?.("change", applyTheme);
    return () => media.removeEventListener?.("change", applyTheme);
  }, [settings, activeId, hydrated]);

  useEffect(() => { if (!hydrated || settings.temporaryChat) return; void memoryStore.saveConversations(conversations).catch(() => setHealth((h) => ({ ...h, storage: "degraded" }))); }, [conversations, hydrated, settings.temporaryChat]);

  function createChat() { const chat = newConversation(); setConversations((items) => [chat, ...items]); setActiveId(chat.id); setHistoryOpen(false); setMobileNavOpen(false); }
  function deleteChat(id: string) { setConversations((items) => items.filter((item) => item.id !== id)); if (activeId === id) setActiveId(null); }
  function openSettings() { setMobileNavOpen(false); setSettingsOpen(true); }
  function stop() { controllerRef.current?.abort(); requestIdRef.current = null; setBusy(false); }

  async function send(text: string, imageDataUrl?: string) {
    const clean = text.trim(); if (!clean || busy) return;
    const decision = checkUserMessage(clean); const chatId = activeId ?? uid("chat"); const current = conversations.find((c) => c.id === chatId) ?? { ...newConversation(), id: chatId, title: titleFor(clean) };
    const userMedia = imageDataUrl ? { type: "image" as const, dataUrl: imageDataUrl, alt: "User attached image" } : undefined;
    if (!decision.allowed) { const blocked: Message = { id: uid("msg"), role: "assistant", content: decision.reason ?? "I can't help with that request.", createdAt: Date.now(), status: "complete", source: "local" }; const next = { ...current, title: current.messages.length ? current.title : titleFor(clean), messages: [...current.messages, blocked], updatedAt: Date.now() }; setConversations((items) => items.some((c) => c.id === chatId) ? items.map((c) => c.id === chatId ? next : c) : [next, ...items]); setActiveId(chatId); return; }
    if (!navigator.onLine) { const user: Message = { id: uid("msg"), role: "user", content: clean, createdAt: Date.now(), status: "complete", media: userMedia }; const error: Message = { id: uid("msg"), role: "assistant", content: "Ambi needs an internet connection for Groq AI. Reconnect and try again.", createdAt: Date.now(), status: "error", source: "cloud" }; const next = { ...current, title: current.messages.length ? current.title : titleFor(clean), messages: [...current.messages, user, error] }; setConversations((items) => items.some((c) => c.id === chatId) ? items.map((c) => c.id === chatId ? next : c) : [next, ...items]); setActiveId(chatId); return; }

    const user: Message = { id: uid("msg"), role: "user", content: clean, createdAt: Date.now(), status: "complete", media: userMedia };
    const conversationWithUser: Conversation = { ...current, title: current.messages.length ? current.title : titleFor(clean), messages: [...current.messages, user], updatedAt: Date.now() };
    setConversations((items) => items.some((c) => c.id === chatId) ? items.map((c) => c.id === chatId ? conversationWithUser : c) : [conversationWithUser, ...items]); setActiveId(chatId); setBusy(true); setHealth((h) => ({ ...h, inference: "loading", safeMode: false, recovery: "idle" }));

    const responseId = uid("msg"); const placeholder: Message = { id: responseId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", source: "cloud" };
    setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, placeholder] } : c));
    const requestId = uid("request"); requestIdRef.current = requestId; const controller = new AbortController(); controllerRef.current = controller;
    let citations: Message["citations"] = [];
    try {
      let toolText = "";
      const researchRequested = settings.webSearch || wantsWebSearch(clean);
      if (researchRequested) {
        const result = await runOptionalTool("web_search", clean);
        if (result.ok) { citations = result.citations ?? []; toolText = `[Untrusted web research]\n${result.text}`; setHealth((h) => ({ ...h, webSearch: "ready" })); }
        else { setHealth((h) => ({ ...h, webSearch: "error" })); toolText = `[Web research unavailable]\n${result.text}`; }
      }
      const memories = settings.memoryEnabled && !settings.temporaryChat ? await memoryStore.loadMemories() : [];
      const memoryTexts = memories.filter((memory) => memory.approved && (!memory.expiresAt || memory.expiresAt > Date.now())).slice(-20).map((memory) => memory.text);
      let output = "";
      await streamCloudChat({ messages: conversationWithUser.messages, model: settings.model, signal: controller.signal, imageDataUrl, systemExtras: { language: settings.language, responseStyle: settings.responseStyle }, memories: memoryTexts, toolNotes: toolText, onDelta: (delta) => { if (requestIdRef.current !== requestId) return; output += delta; setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: c.messages.map((m) => m.id === responseId ? { ...m, content: redactSecrets(output), citations } : m) } : c)); } });
      if (requestIdRef.current !== requestId) return;
      const final = redactSecrets(output.trim()); if (!final) throw new CloudInferenceError("Groq returned no text. Please try again.", "EMPTY_RESPONSE");
      setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: c.messages.map((m) => m.id === responseId ? { ...m, content: final, status: "complete", source: "cloud", citations } : m), updatedAt: Date.now() } : c)); setHealth((h) => ({ ...h, inference: "ready", safeMode: false, recovery: "idle", network: "online" }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Ambi could not reach Groq.";
      setConversations((items) => items.map((c) => c.id === chatId ? { ...c, messages: c.messages.map((m) => m.id === responseId ? { ...m, content: `${message}\n\nOpen Settings → Diagnostics and test the connection.`, status: "error", source: "cloud" } : m) } : c)); setHealth((h) => ({ ...h, inference: "error", safeMode: true, recovery: "safe", lastRecoveryAt: Date.now() }));
    } finally { if (requestIdRef.current === requestId) requestIdRef.current = null; controllerRef.current = null; setBusy(false); }
  }

  return <div className="ambi">
    <style>{`html[data-theme="dark"] .topbar,html[data-theme="oled"] .topbar{background:rgba(23,25,20,.84);color:var(--text)} html[data-theme="dark"] .composer,html[data-theme="oled"] .composer{background:rgba(33,35,29,.95)} html[data-theme="dark"] .settings-btn{color:var(--text)} .close{display:grid;place-items:center;line-height:1;color:var(--text)} .code-wrap{position:relative}.code-copy{position:absolute;right:9px;top:9px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.2);color:#fff;border-radius:8px;padding:5px 7px;font-size:9px}.math-block{display:block;width:fit-content;max-width:100%;margin:14px 0;padding:13px 16px;border:1px solid var(--line);background:var(--panel);border-radius:14px;font-family:"Cambria Math","Times New Roman",serif;font-size:18px;overflow:auto}.inline-code{padding:2px 5px;border-radius:5px;background:var(--panel);border:1px solid var(--line);font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.composer-error{margin-top:6px;padding:5px 8px;border-radius:8px;color:var(--danger);font-size:10px;background:color-mix(in srgb,var(--danger) 10%,transparent)} .mobile-nav-backdrop{position:fixed;inset:0;z-index:39;background:rgba(0,0,0,.38)}.mobile-nav{position:fixed;left:0;top:0;bottom:0;width:min(86vw,360px);z-index:40;background:var(--card);border-right:1px solid var(--line);box-shadow:24px 0 60px rgba(0,0,0,.2);padding:14px;overflow:auto}.mobile-nav-head{display:flex;align-items:center;justify-content:space-between}.mobile-nav-head button{border:1px solid var(--line);background:var(--panel);color:var(--text);width:34px;height:34px;border-radius:10px}.mobile-nav-brand{display:flex;align-items:center;gap:9px}.mobile-nav-brand img{width:36px;height:36px;border-radius:11px}.mobile-nav-brand strong{font:700 17px var(--font-manrope),sans-serif}.mobile-nav-links{display:grid;gap:4px;margin:14px 0}.mobile-nav-links button,.mobile-recent{border:0;background:transparent;color:var(--text);text-align:left;border-radius:11px;padding:11px}.mobile-nav-links button:hover,.mobile-recent:hover{background:var(--sage-soft)}.mobile-recents-title{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:7px}.mobile-recent{width:100%}.mobile-recent small{display:block;color:var(--muted);font-size:9px;margin-top:3px}.mobile-menu{display:none}@media(max-width:900px){.mobile-menu{display:grid;place-items:center;border:1px solid var(--line);background:var(--card);color:var(--text);width:36px;height:36px;border-radius:10px;font-size:18px}.topbar{padding:0 12px}.status{margin-left:auto}.mobile-brand{margin-right:auto}}`}</style>
    <aside className="sidebar"><div className="brand"><img src="/ambi-logo.png" alt="Ambi"/><div><strong>Ambi</strong><small>Calm AI workspace</small></div></div><button className="new-chat" onClick={createChat}>＋ New chat</button><div className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats"/><kbd>⌘K</kbd></div><nav className="nav"><button onClick={() => setHistoryOpen(true)}>▤ History · {conversations.length}</button><button onClick={() => setMemoryOpen(true)}>◈ Memory</button><button onClick={openSettings}>⚙ Settings</button></nav><div className="section-title">Recent conversations</div><div className="conversation-list">{visibleConversations.filter((c) => !c.archived).slice(0, 30).map((c) => <div key={c.id} className={`conversation ${c.id === activeId ? "active" : ""}`}><button onClick={() => setActiveId(c.id)}><span>{c.title}</span><small>{c.messages.length} messages</small></button><button className="delete" onClick={() => deleteChat(c.id)} aria-label="Delete chat">×</button></div>)}</div><div className="sidebar-foot"><span><strong>●</strong> Groq AI</span><span>{health.network === "online" ? "Online" : "Offline"}</span></div></aside>
    <main className="main"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" type="button">☰</button><div className="mobile-brand"><img src="/ambi-logo.png" alt="Ambi"/><strong>Ambi</strong></div><button className="model-button" onClick={openSettings} title={activeModel.description}><span className="provider-dot"/>{activeModel.name} ▾</button><div className="status"><span className="online-dot"/><span>{health.inference === "ready" ? "AI connected" : health.inference === "error" ? "AI needs attention" : "Checking AI…"}</span><button className="settings-btn" onClick={openSettings} aria-label="Settings" type="button">⚙</button></div></header>{health.safeMode && <div style={{ padding: "10px 24px", color: "#7a423d", fontSize: 11, textAlign: "center" }}>Groq connection needs attention. Open Settings → Diagnostics.</div>}<div className="content"><section className="messages">{active?.messages.length ? active.messages.map((message) => <MessageBubble key={message.id} message={message}/>) : <EmptyState onSuggestion={send}/>}</section></div><Composer onSend={send} onStop={stop} busy={busy} webSearch={settings.webSearch} onToggleResearch={() => { setSettings((s) => ({ ...s, webSearch: !s.webSearch })); }} /></main>
    {mobileNavOpen && <><div className="mobile-nav-backdrop" onMouseDown={() => setMobileNavOpen(false)} /><aside className="mobile-nav"><div className="mobile-nav-head"><div className="mobile-nav-brand"><img src="/ambi-logo.png" alt="Ambi"/><strong>Ambi</strong></div><button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" type="button">×</button></div><button className="new-chat" onClick={createChat}>＋ New chat</button><nav className="mobile-nav-links"><button onClick={() => setHistoryOpen(true)}>▤ Chats · {conversations.length}</button><button onClick={() => setHistoryOpen(true)}>◷ History</button><button onClick={() => { setMemoryOpen(true); setMobileNavOpen(false); }}>◈ Memory</button><button onClick={openSettings}>⚙ Settings</button></nav><div className="mobile-recents-title">Recents</div><div>{visibleConversations.filter((c) => !c.archived).slice(0, 20).map((c) => <button className="mobile-recent" key={c.id} onClick={() => { setActiveId(c.id); setMobileNavOpen(false); }}><span>{c.title}</span><small>{c.messages.length} messages</small></button>)}</div></aside></>}
    {historyOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}><section className="modal"><div className="modal-header"><div><span className="eyebrow">WORKSPACE</span><h2>Chats</h2></div><button className="close" onClick={() => setHistoryOpen(false)} aria-label="Close chats" type="button">×</button></div><div className="history-tools"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats…" aria-label="Search chats"/><button className="primary" onClick={createChat} type="button">＋ New</button></div>{visibleConversations.map((c) => <div className="row" key={c.id}><div><strong>{c.pinned ? "★ " : ""}{c.title}</strong><p>{c.messages.length} messages · {new Date(c.updatedAt).toLocaleString()}</p></div><button className="secondary" onClick={() => { setActiveId(c.id); setHistoryOpen(false); }} type="button">Open</button></div>)}</section></div>}
    {memoryOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setMemoryOpen(false); }}><section className="modal"><div className="modal-header"><div><span className="eyebrow">PRIVACY</span><h2>Memory Center</h2></div><button className="close" onClick={() => setMemoryOpen(false)} aria-label="Close memory" type="button">×</button></div><MemoryPanel/></section></div>}
    {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} capabilities={caps} health={health} onClose={() => setSettingsOpen(false)} onRefreshHealth={() => refreshAiHealth(true)}/>} 
  </div>;
}
