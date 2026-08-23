import type { Message } from "@/types/chat";
import { MODEL_CATALOG } from "@/lib/constants";

export interface LocalEngine {
  model: string;
  load(onProgress?: (value: number) => void): Promise<void>;
  chat(messages: Message[]): AsyncGenerator<string>;
  unload(): Promise<void>;
}

const engines = new Map<string, Promise<LocalEngine>>();

export async function getLocalEngine(model: string): Promise<LocalEngine> {
  const selected = MODEL_CATALOG.some((item) => item.id === model) ? model : MODEL_CATALOG[0]?.id;
  if (!selected) throw new Error("No local model is configured.");
  const existing = engines.get(selected);
  if (existing) return existing;

  const promise = createEngine(selected).catch(async (error) => {
    engines.delete(selected);
    const fallback = MODEL_CATALOG.find((item) => item.id !== selected)?.id;
    if (!fallback) throw error;
    const fallbackExisting = engines.get(fallback);
    if (fallbackExisting) return fallbackExisting;
    const fallbackPromise = createEngine(fallback);
    engines.set(fallback, fallbackPromise);
    return fallbackPromise;
  });

  engines.set(selected, promise);
  return promise;
}

async function createEngine(model: string): Promise<LocalEngine> {
  if (typeof window === "undefined") throw new Error("Local inference is browser-only.");
  const webllm = await import("@mlc-ai/web-llm");
  const created = await webllm.CreateMLCEngine(model, {
    initProgressCallback: (report) => {
      const progress = typeof report.progress === "number" ? report.progress : 0;
      window.dispatchEvent(new CustomEvent("ambi:model-progress", { detail: progress }));
    },
  });

  return {
    model,
    async load() {},
    async *chat(messages: Message[]) {
      const modelMessages = messages
        .filter((message) => message.role === "system" || message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role as "system" | "user" | "assistant",
          content: message.content,
        }));
      const response = await created.chat.completions.create({
        messages: modelMessages,
        stream: true,
        temperature: 0.3,
        max_tokens: 1400,
      });
      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) yield delta;
      }
    },
    async unload() {
      await created.unload();
      engines.delete(model);
    },
  } satisfies LocalEngine;
}
