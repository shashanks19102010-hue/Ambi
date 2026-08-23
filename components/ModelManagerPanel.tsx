"use client";

import { MODEL_CATALOG } from "@/lib/constants";
import { getRecommendedModel } from "@/lib/ai/model-manager";
import type { AppSettings, CapabilityState } from "@/types/chat";

export default function ModelManagerPanel({ settings, capabilities, onChange }: { settings: AppSettings; capabilities: CapabilityState | null; onChange: (value: AppSettings) => void }) {
  const recommended = capabilities ? getRecommendedModel(capabilities) : MODEL_CATALOG[0];

  return <section className="model-manager" aria-labelledby="model-manager-title">
    <div className="panel-toolbar">
      <div>
        <span className="eyebrow">AI RUNTIME</span>
        <h3 id="model-manager-title">Model Manager</h3>
        <p className="panel-copy">Choose the local model Ambi should initialize. The recommendation is based on detected device capability.</p>
      </div>
      <span className="model-recommendation">Recommended: {recommended.name}</span>
    </div>
    <div className="model-list">
      {MODEL_CATALOG.map((model) => {
        const active = settings.model === model.id;
        const isRecommended = model.id === recommended.id;
        return <button key={model.id} className={`model-option${active ? " active" : ""}`} onClick={() => onChange({ ...settings, model: model.id })} aria-pressed={active}>
          <span className="model-option-main"><strong>{model.name}</strong><small>{model.sizeLabel} · {model.quantization}</small></span>
          <span className="model-option-meta"><span>{model.tier}</span>{isRecommended && <b>Recommended</b>}{active && <b>Active</b>}</span>
        </button>;
      })}
    </div>
  </section>;
}
