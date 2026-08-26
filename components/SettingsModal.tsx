"use client";
import { useEffect, useState } from "react";
import type { AppSettings, CapabilityState, HealthState } from "@/types/chat";
import { CLOUD_MODEL_CATALOG } from "@/lib/constants";

function healthTone(health: HealthState) {
  if (health.recovery === "recovering") return "recovering";
  if (health.inference === "error" && health.network === "offline") return "down";
  if (health.inference === "error" || health.storage === "degraded" || health.safeMode || health.network === "offline" || health.recovery === "failed") return "degraded";
  return "healthy";
}
function healthLabel(health: HealthState) {
  const tone = healthTone(health);
  return tone === "healthy" ? "Healthy" : tone === "recovering" ? "Recovering" : tone === "down" ? "Offline" : "Degraded";
}

export default function SettingsModal({ settings, onChange, capabilities, health, onClose, onRefreshHealth }: { settings: AppSettings; onChange: (value: AppSettings) => void; capabilities: CapabilityState | null; health: HealthState; onClose: () => void; onRefreshHealth: () => Promise<void> }) {
  const [imageReady, setImageReady] = useState<boolean | null>(null);
  const [imageModel, setImageModel] = useState("gpt-image-2");
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value });
  const model = CLOUD_MODEL_CATALOG.find((m) => m.id === settings.model) ?? CLOUD_MODEL_CATALOG[0];
  const tone = healthTone(health);

  useEffect(() => {
    void fetch("/api/health/image", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => ({})) as { configured?: boolean; model?: string };
      setImageReady(Boolean(response.ok && data.configured));
      if (data.model) setImageModel(data.model);
    }).catch(() => setImageReady(false));
  }, []);

  return <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Ambi settings">
    <div className="modal-header"><div><div className="eyebrow">AMBI CONTROL CENTER</div><h2>Settings</h2></div><button className="close" onClick={onClose} aria-label="Close settings" type="button">×</button></div>
    <div className="settings-grid">
      <div className="field"><label htmlFor="ambi-model">Groq model</label><select id="ambi-model" value={settings.model} onChange={(e) => set("model", e.target.value)}>{CLOUD_MODEL_CATALOG.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></div>
      <div className="field"><label htmlFor="ambi-style">Response style</label><select id="ambi-style" value={settings.responseStyle} onChange={(e) => set("responseStyle", e.target.value as AppSettings["responseStyle"])}><option value="concise">Concise</option><option value="normal">Normal</option><option value="detailed">Detailed</option><option value="expert">Expert</option></select></div>
      <div className="field"><label htmlFor="ambi-language">Language</label><select id="ambi-language" value={settings.language} onChange={(e) => set("language", e.target.value as AppSettings["language"])}><option value="auto">Auto</option><option value="en">English</option><option value="hi">Hindi</option><option value="hinglish">Hinglish</option></select></div>
      <div className="field"><label htmlFor="ambi-theme">Theme</label><select id="ambi-theme" value={settings.theme} onChange={(e) => set("theme", e.target.value as AppSettings["theme"])}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option><option value="oled">OLED Dark</option></select></div>
    </div>
    <div className="row"><div><strong>Ambi health</strong><p>Inference, storage and network recovery status.</p></div><span className={`connection-pill health-${tone}`}><span className="health-dot"/>{healthLabel(health)}</span></div>
    <div className="row"><div><strong>Groq AI connection</strong><p>{model.description} Your API key stays server-side.</p></div><button className="secondary status-action" onClick={() => void onRefreshHealth()} type="button">{health.inference === "ready" ? "Connected" : "Test connection"}</button></div>
    <div className="row"><div><strong>Web research</strong><p>Web research stays disabled unless explicitly enabled on the server and here.</p></div><input className="toggle" type="checkbox" checked={settings.webSearch} onChange={(e) => set("webSearch", e.target.checked)} aria-label="Enable web research" /></div>
    <div className="row"><div><strong>Image generation</strong><p>{imageReady ? `${imageModel} is configured. Create images from the composer.` : "Optional image provider is not configured."}</p></div><span className={`connection-pill ${imageReady ? "ready" : "disabled"}`}>{imageReady === null ? "Checking…" : imageReady ? "Ready" : "Not configured"}</span></div>
    <div className="row"><div><strong>Memory</strong><p>Approved memories are stored locally and can be managed from Memory Center.</p></div><button className="secondary" onClick={() => window.dispatchEvent(new Event("ambi:open-memory"))}>Open Memory</button></div>
    <div className="row"><div><strong>Temporary chat</strong><p>Do not persist this conversation normally.</p></div><input className="toggle" type="checkbox" checked={settings.temporaryChat} onChange={(e) => set("temporaryChat", e.target.checked)} aria-label="Temporary chat" /></div>
    <div className="diagnostics"><strong>Diagnostics</strong><div className="diag-grid"><div><span>Provider</span><b>Groq</b></div><div><span>Model</span><b>{model.name}</b></div><div><span>AI status</span><b>{health.inference}</b></div><div><span>Health</span><b>{healthLabel(health)}</b></div><div><span>Network</span><b>{health.network}</b></div><div><span>Recovery</span><b>{health.recovery}</b></div><div><span>Last recovery</span><b>{health.lastRecoveryAt ? new Date(health.lastRecoveryAt).toLocaleTimeString() : "Never"}</b></div><div><span>Research</span><b>{health.webSearch}</b></div><div><span>Device</span><b>{capabilities?.tier ?? "Detecting"}</b></div></div></div>
    <div className="modal-header settings-footer"><span className="settings-note">Cloud chat retries transient failures automatically; long chat history is bounded to avoid runaway context limits.</span><button className="primary" onClick={onClose}>Done</button></div>
  </section></div>;
}
