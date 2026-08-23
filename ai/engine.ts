import type { Message } from "@/types/chat";
import { MODEL_CATALOG } from "@/lib/constants";

export interface LocalEngine { load(onProgress?: (value: number) => void): Promise<void>; chat(messages: Message[]): AsyncGenerator<string>; unload(): Promise<void>; model: string; }
const engines = new Map<string, Promise<LocalEngine>>();

export async function getLocalEngine(model: string): Promise<LocalEngine> {
  const existing = engines.get(model);
  if (existing) return existing;
  const promise = createEngine(model).catch(async (error) => {
    engines.delete(model);
    const fallback = MODEL_CATALOG.find((item) => item.id !== model)?.id;
    if (!fallback) throw error;
    const fallbackExisting = engines.get(fallback);
    if (fallbackExisting) return fallbackExisting;
    const fallbackPromise = createEngine(fallback);
    engines.set(fallback, fallbackPromise);
    return fallbackPromise;
  });
  engines.set(model, promise);
  return promise;
}

async function createEngine(model: string): Promise<LocalEngine> {
  if (typeof window === "undefined") throw new Error("Local inference is browser-only.");
  if (!("gpu" in navigator) && typeof WebAssembly === "undefined") throw new Error("No supported local inference backend is available.");
  const webllm = await import("@mlc-ai/web-llm");
  const created = await webllm.CreateMLCEngine(model, { initProgressCallback: (report) => { const pct = typeof report.progress === "number" ? report.progress : 0; window.dispatchEvent(new CustomEvent("ambi:model-progress", { detail: pct })); } });
  return {
    model,
    async load() {},
    async *chat(messages) {
      const response = await created.chat.completions.create({ messages: messages.map(({ role, content }) => ({ role, content })), stream: true, temperature: 0.3, max_tokens: 1400 });
      for await (const chunk of response) { const delta = chunk.choices[0]?.delta?.content ?? ""; if (delta) yield delta; }
    },
    async unload() { await created.unload(); engines.delete(model); }
  };
}
