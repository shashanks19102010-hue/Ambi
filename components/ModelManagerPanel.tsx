"use client";

import { CLOUD_MODEL_CATALOG, DEFAULT_CLOUD_MODEL_ID } from "@/lib/constants";
import type { AppSettings, CapabilityState } from "@/types/chat";

export default function ModelManagerPanel({ settings, capabilities, onChange }: { settings: AppSettings; capabilities: CapabilityState | null; onChange: (value: AppSettings) => void }) {
  const recommended = CLOUD_MODEL_CATALOG.find((model) => model.id === DEFAULT_CLOUD_MODEL_ID) ?? CLOUD_MODEL_CATALOG[0];

  return <section className="model-manager" aria-labelledby="model-manager-title">
    <div className="panel-toolbar">
      <div>
        <span className="eyebrow">GROQ CLOUD</span>
        <h3 id="model-manager-title">Model Manager</h3>
        <p className="panel-copy">Choose which Groq model Ambi sends your messages to. Your API key remains server-side.</p>
      </div>
      <span className="model-recommendation">Recommended: {recommended.name}</span>
    </div>
    {capabilities && <div className="model-device-note">Device tier: <strong>{capabilities.tier}</strong> · Cloud model choice is independent of local hardware.</div>}
    <div className="model-list">
      {CLOUD_MODEL_CATALOG.map((model) => {
        const active = settings.model === model.id;
        const isRecommended = model.id === recommended.id;
        return <button key={model.id} className={`model-option${active ? " active" : ""}`} onClick={() => onChange({ ...settings, model: model.id })} aria-pressed={active}>
          <span className="model-option-main">
            <strong>{model.name}</strong>
            <small>{model.description}</small>
            <small>{Math.round(model.contextWindow / 1024)}K context · {model.maxOutputTokens.toLocaleString()} max output</small>
          </span>
          <span className="model-option-meta"><span>{model.tier}</span>{isRecommended && <b>Recommended</b>}{active && <b>Active</b>}</span>
        </button>;
      })}
    </div>
  </section>;
}
