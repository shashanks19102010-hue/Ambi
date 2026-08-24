"use client";
import type { AppSettings, CapabilityState, HealthState } from "@/types/chat";
import { CLOUD_MODEL_CATALOG } from "@/lib/constants";

export default function SettingsModal({ settings, onChange, capabilities, health, onClose, onRefreshHealth }: { settings: AppSettings; onChange: (value: AppSettings) => void; capabilities: CapabilityState | null; health: HealthState; onClose: () => void; onRefreshHealth: () => Promise<void> }) {
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value });
  const model = CLOUD_MODEL_CATALOG.find((m) => m.id === settings.model) ?? CLOUD_MODEL_CATALOG[0];
  return <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true">
    <div className="modal-header"><div><div className="eyebrow">AMBI CONTROL CENTER</div><h2>Settings</h2></div><button className="close" onClick={onClose}>×</button></div>
    <div className="settings-grid">
      <div className="field"><label>Groq model</label><select value={settings.model} onChange={(e) => set("model", e.target.value)}>{CLOUD_MODEL_CATALOG.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></div>
      <div className="field"><label>Response style</label><select value={settings.responseStyle} onChange={(e) => set("responseStyle", e.target.value as AppSettings["responseStyle"])}><option value="concise">Concise</option><option value="normal">Normal</option><option value="detailed">Detailed</option><option value="expert">Expert</option></select></div>
      <div className="field"><label>Language</label><select value={settings.language} onChange={(e) => set("language", e.target.value as AppSettings["language"])}><option value="auto">Auto</option><option value="en">English</option><option value="hi">Hindi</option><option value="hinglish">Hinglish</option></select></div>
      <div className="field"><label>Theme</label><select value={settings.theme} onChange={(e) => set("theme", e.target.value as AppSettings["theme"])}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option><option value="oled">OLED Dark</option></select></div>
    </div>
    <div className="row"><div><strong>Groq AI connection</strong><p>{model.description} Your API key stays server-side.</p></div><button className="secondary" onClick={() => void onRefreshHealth()}>{health.inference === "ready" ? "Connected" : "Test connection"}</button></div>
    <div className="row"><div><strong>Web research</strong><p>Enable when you want current web sources; research remains clearly labeled.</p></div><input className="toggle" type="checkbox" checked={settings.webSearch} onChange={(e) => set("webSearch", e.target.checked)}/></div>
    <div className="row"><div><strong>Memory</strong><p>Approved memories are stored locally and can be managed from Memory Center.</p></div><button className="secondary" onClick={() => window.dispatchEvent(new Event("ambi:open-memory"))}>Open Memory</button></div>
    <div className="row"><div><strong>Temporary chat</strong><p>Do not persist this conversation normally.</p></div><input className="toggle" type="checkbox" checked={settings.temporaryChat} onChange={(e) => set("temporaryChat", e.target.checked)}/></div>
    <div className="diagnostics"><strong>Diagnostics</strong><div className="diag-grid"><div><span>Provider</span><b>Groq</b></div><div><span>Model</span><b>{model.name}</b></div><div><span>AI status</span><b>{health.inference}</b></div><div><span>Network</span><b>{health.network}</b></div><div><span>Device</span><b>{capabilities?.tier ?? "Detecting"}</b></div><div><span>WebGPU</span><b>{capabilities?.webgpu ? "Yes" : "No"}</b></div></div></div>
    <div className="modal-header" style={{ marginTop: 16 }}><span style={{ color: "var(--muted)", fontSize: 10 }}>Ambi always uses Groq Cloud AI for chat.</span><button className="primary" onClick={onClose}>Done</button></div>
  </section></div>;
}
