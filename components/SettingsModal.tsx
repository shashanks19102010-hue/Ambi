"use client";
import { useState } from "react";
import type { AppSettings, CapabilityState, HealthState } from "@/types/chat";
import { MODEL_CATALOG } from "@/lib/constants";
import MemoryPanel from "@/components/MemoryPanel";
import ModelManagerPanel from "@/components/ModelManagerPanel";
import ControlPanelStyles from "@/components/ControlPanelStyles";

export default function SettingsModal({ settings, onChange, capabilities, health, onClose }: { settings: AppSettings; onChange: (value: AppSettings) => void; capabilities: CapabilityState | null; health: HealthState; onClose: () => void }) {
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value });
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <ControlPanelStyles />
    <div className="modal-head"><div><span className="eyebrow">AMBI CONTROL CENTER</span><h2 id="settings-title">Settings &amp; Privacy</h2></div><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div>
    <div className="settings-grid">
      <label className="field"><span>Local AI runtime</span><select value={settings.model} onChange={(e) => set("model", e.target.value)}>{MODEL_CATALOG.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.sizeLabel}</option>)}</select></label>
      <label className="field"><span>Response style</span><select value={settings.responseStyle} onChange={(e) => set("responseStyle", e.target.value as AppSettings["responseStyle"])}><option value="concise">Concise</option><option value="normal">Normal</option><option value="detailed">Detailed</option><option value="expert">Expert</option></select></label>
      <label className="field"><span>Language</span><select value={settings.language} onChange={(e) => set("language", e.target.value as AppSettings["language"])}><option value="auto">Auto</option><option value="en">English</option><option value="hi">Hindi</option><option value="hinglish">Hinglish</option></select></label>
      <label className="field"><span>Theme</span><select value={settings.theme} onChange={(e) => set("theme", e.target.value as AppSettings["theme"])}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option><option value="oled">OLED Dark</option></select></label>
    </div>
    <div className="settings-card"><div><strong>How Ambi runs</strong><p>Ambi uses the user&apos;s own device. It prefers WebGPU when available and automatically falls back to a small WebAssembly CPU model when GPU inference cannot start. No cloud AI endpoint is required.</p></div></div>
    <div className="settings-card"><div><strong>Web research</strong><p>Uses Tavily through Ambi&apos;s server route only when you enable research. Results are treated as untrusted data.</p></div><input className="toggle" type="checkbox" checked={settings.webSearch && !settings.localOnly} onChange={(e) => set("webSearch", e.target.checked)} aria-label="Enable web research" /></div>
    <div className="settings-card"><div><strong>Local Only Mode</strong><p>Disables network-dependent tools. Local device inference can still work from the cached/downloaded model.</p></div><input className="toggle" type="checkbox" checked={settings.localOnly} onChange={(e) => set("localOnly", e.target.checked)} aria-label="Enable local-only mode" /></div>
    <div className="settings-card"><div><strong>Memory</strong><p>Approved memories are stored locally. Review or remove saved items in Memory Center.</p></div><button className="secondary-btn" onClick={() => setMemoryOpen((open) => !open)}>{memoryOpen ? "Hide Memory Center" : "Manage Memory"}</button></div>
    {memoryOpen && <MemoryPanel />}
    <div className="settings-card"><div><strong>Temporary Chat</strong><p>Skips normal conversation persistence and project memory for this mode.</p></div><input className="toggle" type="checkbox" checked={settings.temporaryChat} onChange={(e) => set("temporaryChat", e.target.checked)} aria-label="Enable temporary chat" /></div>
    <div className="settings-card"><div><strong>Strict safety</strong><p>Prefers safer handling of risky requests, external data, and consequential actions.</p></div><select className="inline-select" value={settings.safetyMode} onChange={(e) => set("safetyMode", e.target.value as AppSettings["safetyMode"])}><option value="strict">Strict</option><option value="balanced">Balanced</option></select></div>
    <div className="settings-card"><div><strong>Model Manager</strong><p>Inspect all available local models, their tiers, quantization, and the device-specific recommendation.</p></div><button className="secondary-btn" onClick={() => setModelsOpen((open) => !open)}>{modelsOpen ? "Hide Models" : "Open Models"}</button></div>
    {modelsOpen && <ModelManagerPanel settings={settings} capabilities={capabilities} onChange={onChange} />}
    <div className="diagnostics"><div className="diag-header"><strong>Ambi Diagnostics</strong><span>{health.safeMode ? "Recovery active" : "Healthy"}</span></div><div className="diag-grid"><span>WebGPU <b>{capabilities?.webgpu ? "Available" : "Unavailable"}</b></span><span>WebAssembly <b>{capabilities?.wasm ? "Available" : "Unavailable"}</b></span><span>CPU <b>{capabilities?.cores ?? "—"} cores</b></span><span>Device <b>{capabilities?.tier ?? "Detecting"}</b></span><span>Network <b>{health.network}</b></span><span>Storage <b>{health.storage}</b></span><span>Recovery <b>{health.recovery}</b></span><span>Mode <b>{settings.localOnly ? "Local Only" : "Hybrid AI"}</b></span></div></div>
    <div className="modal-footer"><span className="small">Local AI runs on this device. External services are used only for explicitly enabled features.</span><button className="primary-btn" onClick={onClose}>Done</button></div>
  </section></div>;
}
