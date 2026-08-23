import type { Message } from "@/types/chat";
import { DEFAULT_MODEL_ID, MODEL_CATALOG, WASM_FALLBACK_MODEL_ID } from "@/lib/constants";
import { CpuLocalEngine, type CpuEngineContract } from "@/lib/ai/cpu-engine";

export class LocalInferenceError extends Error {
  constructor(message: string, public readonly code = "LOCAL_INFERENCE_ERROR") {
    super(message);
    this.name = "LocalInferenceError";
  }
}

interface WebGPUBridge {
  requestAdapter: () => Promise<unknown>;
}

function getWebGPU(): WebGPUBridge | null {
  if (typeof navigator === "undefined") return null;
  const candidate = (navigator as Navigator & { gpu?: WebGPUBridge }).gpu;
  return candidate ?? null;
}

export interface LocalEngine {
  model: string;
  runtime: "webgpu" | "wasm";
  chat(messages: Message[]): AsyncGenerator<string>;
  stop(): Promise<void>;
  unload(): Promise<void>;
}

const engines = new Map<string, Promise<LocalEngine>>();

function isWasmModel(model: string) {
  return model === WASM_FALLBACK_MODEL_ID;
}

function supportedModelId(requested: string): string {
  if (isWasmModel(requested)) return requested;
  return MODEL_CATALOG.some((item) => item.id === requested) ? requested : DEFAULT_MODEL_ID;
}

function announceRuntime(runtime: LocalEngine["runtime"]) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ambi:runtime", { detail: runtime }));
  }
}

export async function getLocalEngine(requestedModel: string): Promise<LocalEngine> {
  const selected = supportedModelId(requestedModel);
  const key = isWasmModel(selected) ? WASM_FALLBACK_MODEL_ID : selected;
  const existing = engines.get(key);
  if (existing) return existing;

  const pending = createPreferredEngine(selected).catch((error) => {
    engines.delete(key);
    throw error;
  });

  engines.set(key, pending);
  return pending;
}

async function createPreferredEngine(model: string): Promise<LocalEngine> {
  if (isWasmModel(model)) return createCpuEngine();

  try {
    return await createWebGpuEngine(model);
  } catch (webGpuError) {
    try {
      return await createCpuEngine();
    } catch (cpuError) {
      const webMessage = webGpuError instanceof Error ? webGpuError.message : "WebGPU local inference failed.";
      const cpuMessage = cpuError instanceof Error ? cpuError.message : "CPU local inference failed.";
      throw new LocalInferenceError(
        `Ambi could not start local AI. GPU: ${webMessage} CPU: ${cpuMessage}`,
        "LOCAL_RUNTIME_UNAVAILABLE",
      );
    }
  }
}

async function createWebGpuEngine(model: string): Promise<LocalEngine> {
  if (typeof window === "undefined") {
    throw new LocalInferenceError("Local AI can only run in the browser.", "SSR_CONTEXT");
  }

  const gpu = getWebGPU();
  if (!gpu) {
    throw new LocalInferenceError("WebGPU is unavailable on this browser.", "WEBGPU_UNAVAILABLE");
  }

  let adapter: unknown;
  try {
    adapter = await gpu.requestAdapter();
  } catch {
    throw new LocalInferenceError("WebGPU could not initialize on this device.", "WEBGPU_INITIALIZATION_FAILED");
  }

  if (!adapter) {
    throw new LocalInferenceError("No compatible GPU adapter was found.", "GPU_ADAPTER_UNAVAILABLE");
  }

  const webllm = await import("@mlc-ai/web-llm");
  const availableIds = new Set(webllm.prebuiltAppConfig.model_list.map((item) => item.model_id));
  const actualModel = availableIds.has(model) ? model : DEFAULT_MODEL_ID;
  if (!availableIds.has(actualModel)) {
    throw new LocalInferenceError("The selected local GPU model is unavailable.", "MODEL_UNAVAILABLE");
  }

  let created;
  try {
    created = await webllm.CreateMLCEngine(actualModel, {
      initProgressCallback: (report) => {
        const progress = typeof report.progress === "number" ? report.progress : 0;
        window.dispatchEvent(new CustomEvent("ambi:model-progress", { detail: progress }));
      },
    });
  } catch {
    throw new LocalInferenceError(`Ambi could not load ${actualModel}.`, "MODEL_LOAD_FAILED");
  }

  announceRuntime("webgpu");

  return {
    model: actualModel,
    runtime: "webgpu",
    async *chat(messages: Message[]) {
      type CompletionRequest = Parameters<typeof created.chat.completions.create>[0];
      type CompletionMessages = CompletionRequest["messages"];
      const modelMessages = messages
        .filter((message) => message.role === "system" || message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role, content: message.content })) as CompletionMessages;
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
    async stop() {
      const candidate = created as typeof created & { interruptGenerate?: () => Promise<void> };
      if (typeof candidate.interruptGenerate === "function") await candidate.interruptGenerate();
    },
    async unload() {
      await created.unload();
      engines.delete(actualModel);
    },
  };
}

async function createCpuEngine(): Promise<LocalEngine> {
  const cpu = new CpuLocalEngine() as CpuEngineContract;
  announceRuntime("wasm");
  return {
    model: WASM_FALLBACK_MODEL_ID,
    runtime: "wasm",
    chat: cpu.chat.bind(cpu),
    stop: cpu.stop.bind(cpu),
    unload: cpu.unload.bind(cpu),
  };
}
