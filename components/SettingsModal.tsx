"use client";
import { useState } from "react";
import type { AppSettings, CapabilityState, HealthState } from "@/types/chat";
import { CLOUD_MODEL_CATALOG } from "@/lib/constants";
import MemoryPanel from "@/components/MemoryPanel";
import ModelManagerPanel from "@/components/ModelManagerPanel";
import ControlPanelStyles from "@/components/ControlPanelStyles";

export default function SettingsModal({ settings, onChange, capabilities, health, onClose }: { settings: AppSettings; onChange: (value: AppSettings) => void; capabilities: CapabilityState | null; health: HealthState; onClose: () => void }) {
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value });
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const activeModel = CLOUD_MODEL_CATALOG.find((model) => model.id === settings.model) ?? CLOUD_MODEL_CATALOG[0];

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <ControlPanelStyles />
    <div className="modal-head"><div><span className="eyebrow">AMBI CONTROL CENTER</span><h2 id="settings-title">Settings &amp; Privacy</h2></div><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div>
    <div className="settings-grid">
      <label className="field"><span>Groq AI model</span><select value={settings.model} onChange={(e) => set("model", e.target.value)}>{CLOUD_MODEL_CATALOG.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
      <label className="field"><span>Response style</span><select value={settings.responseStyle} onChange={(e) => set("responseStyle", e.target.value as AppSettings["responseStyle"])}><option value="concise">Concise</option><option value="normal">Normal</option><option value="detailed">Detailed</option><option value="expert">Expert</option></select></label>
      <label className="field"><span>Language</span><select value={settings.language} onChange={(e) => set("language", e.target.value as AppSettings["language"])}><option value="auto">Auto</option><option value="en">English</option><option value="hi">Hindi</option><option value="hinglish">Hinglish</option></select></label>
      <label className="field"><span>Theme</span><select value={settings.theme} onChange={(e) => set("theme", e.target.value as AppSettings["theme"])}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option><option value="oled">OLED Dark</option></select></label>
    </div>
    <div className="settings-card"><div><strong>Groq Cloud AI</strong><p>{activeModel.description} Ambi sends chat to Groq through the server; the API key never reaches the browser.</p></div><span className="status-chip">{health.inference === "error" ? "Needs attention" : "Connected"}</span></div>
    <div className="settings-card"><div><strong>Web research</strong><p>Tavily research is optional. When enabled, Ambi automatically searches when a question needs fresh information and keeps the source data clearly marked as untrusted.</p></div><input className="toggle" type="checkbox" checked={settings.webSearch} onChange={(e) => set("webSearch", e.target.checked)} aria-label="Enable web research" /></div>
    <div className="settings-card"><div><strong>Memory</strong><p>Approved memories remain in local IndexedDB. Review, edit, or clear them in Memory Center.</p></div><button className="secondary-btn" onClick={() => setMemoryOpen((open) => !open)}>{memoryOpen ? "Hide Memory Center" : "Manage Memory"}</button></div>
    {memoryOpen && <MemoryPanel />}
    <div className="settings-card"><div><strong>Temporary Chat</strong><p>Skips normal conversation persistence for this mode.</p></div><input className="toggle" type="checkbox" checked={settings.temporaryChat} onChange={(e) => set("temporaryChat", e.target.checked)} aria-label="Enable temporary chat" /></div>
    <div className="settings-card"><div><strong>Safety mode</strong><p>Strict keeps the strongest guardrails for risky requests, external data, and consequential actions.</p></div><select className="inline-select" value={settings.safetyMode} onChange={(e) => set("safetyMode", e.target.value as AppSettings["safetyMode"])}><option value="strict">Strict</option><option value="balanced">Balanced</option></select></div>
    <div className="settings-card"><div><strong>Model Manager</strong><p>See all supported Groq models, context size, output limits, and the current selection.</p></div><button className="secondary-btn" onClick={() => setModelsOpen((open) => !open)}>{modelsOpen ? "Hide Models" : "Open Models"}</button></div>
    {modelsOpen && <ModelManagerPanel settings={settings} capabilities={capabilities} onChange={onChange} />}
    <div className="diagnostics"><div className="diag-header"><strong>Ambi Diagnostics</strong><span>{health.safeMode ? "Recovery active" : "Healthy"}</span></div><div className="diag-grid"><span>Groq API <b>{health.inference === "error" ? "Error" : "Server-side"}</b></span><span>Active model <b>{activeModel.name}</b></span><span>WebGPU <b>{capabilities?.webgpu ? "Available" : "Unavailable"}</b></span><span>Device <b>{capabilities?.tier ?? "Detecting"}</b></span><span>Network <b>{health.network}</b></span><span>Storage <b>{health.storage}</b></span><span>Recovery <b>{health.recovery}</b></span><span>Research <b>{settings.webSearch ? "Enabled" : "Off"}</b></span></div></div>
    <div className="modal-footer"><span className="small">Ambi chat uses Groq Cloud AI. Your API key stays on the server. Other external features are used only when enabled.</span><button className="primary-btn" onClick={onClose}>Done</button></div>
  </section></div>;
}
