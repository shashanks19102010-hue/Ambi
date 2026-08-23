import type { Message } from "@/types/chat";
import { DEFAULT_MODEL_ID, MODEL_CATALOG } from "@/lib/constants";

export class LocalInferenceError extends Error {
  constructor(message: string, public readonly code = "LOCAL_INFERENCE_ERROR") {
    super(message);
    this.name = "LocalInferenceError";
  }
}

export interface LocalEngine {
  model: string;
  chat(messages: Message[]): AsyncGenerator<string>;
  unload(): Promise<void>;
}

const engines = new Map<string, Promise<LocalEngine>>();

function supportedModelId(requested: string): string {
  return MODEL_CATALOG.some((item) => item.id === requested) ? requested : DEFAULT_MODEL_ID;
}

export async function getLocalEngine(requestedModel: string): Promise<LocalEngine> {
  const selected = supportedModelId(requestedModel);
  const existing = engines.get(selected);
  if (existing) return existing;

  const pending = createEngine(selected).catch((error) => {
    engines.delete(selected);
    throw error;
  });

  engines.set(selected, pending);
  return pending;
}

async function createEngine(model: string): Promise<LocalEngine> {
  if (typeof window === "undefined") {
    throw new LocalInferenceError("Local AI can only run in the browser.", "SSR_CONTEXT");
  }

  if (!("gpu" in navigator)) {
    throw new LocalInferenceError(
      "WebGPU is unavailable in this browser. Use a current browser with WebGPU enabled for local AI.",
      "WEBGPU_UNAVAILABLE",
    );
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new LocalInferenceError(
      "No compatible GPU adapter was found for local AI on this device.",
      "GPU_ADAPTER_UNAVAILABLE",
    );
  }

  const webllm = await import("@mlc-ai/web-llm");
  const availableIds = new Set(webllm.prebuiltAppConfig.model_list.map((item) => item.model_id));
  const actualModel = availableIds.has(model) ? model : DEFAULT_MODEL_ID;

  if (!availableIds.has(actualModel)) {
    throw new LocalInferenceError(
      "No supported local model is available in the installed WebLLM build.",
      "MODEL_UNAVAILABLE",
    );
  }

  const created = await webllm.CreateMLCEngine(actualModel, {
    initProgressCallback: (report) => {
      const progress = typeof report.progress === "number" ? report.progress : 0;
      window.dispatchEvent(new CustomEvent("ambi:model-progress", { detail: progress }));
    },
  });

  return {
    model: actualModel,
    async *chat(messages: Message[]) {
      type CompletionRequest = Parameters<typeof created.chat.completions.create>[0];
      type CompletionMessages = CompletionRequest["messages"];

      const modelMessages = messages
        .filter((message) =>
          message.role === "system" ||
          message.role === "user" ||
          message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        })) as CompletionMessages;

      const response = await created.chat.completions.create({
        messages: modelMessages,
        stream: true,
        temperature: 0.25,
        max_tokens: 1400,
      });

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) yield delta;
      }
    },
    async unload() {
      await created.unload();
      engines.delete(actualModel);
    },
  };
}
