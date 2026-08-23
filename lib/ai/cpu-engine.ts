import type { Message } from "@/types/chat";
import { WASM_FALLBACK_MODEL_ID } from "@/lib/constants";

export type CpuWorkerMessage =
  | { type: "progress"; id: string; value?: number }
  | { type: "chunk"; id: string; text?: string }
  | { type: "done"; id: string }
  | { type: "error"; id: string; error?: string };

type Queue<T> = {
  push: (value: T) => void;
  next: () => Promise<T>;
};

function createQueue<T>(): Queue<T> {
  const values: T[] = [];
  const waiters: Array<(value: T) => void> = [];

  return {
    push(value) {
      const waiter = waiters.shift();
      if (waiter) waiter(value);
      else values.push(value);
    },
    next() {
      const value = values.shift();
      if (value !== undefined) return Promise.resolve(value);
      return new Promise<T>((resolve) => waiters.push(resolve));
    },
  };
}

export interface CpuEngineContract {
  model: string;
  chat(messages: Message[]): AsyncGenerator<string>;
  stop(): Promise<void>;
  unload(): Promise<void>;
}

export class CpuLocalEngine implements CpuEngineContract {
  model = WASM_FALLBACK_MODEL_ID;
  private worker: Worker | null = null;
  private activeQueue: Queue<CpuWorkerMessage> | null = null;
  private activeId: string | null = null;

  private ensureWorker() {
    if (typeof Worker === "undefined") {
      throw new Error("Web Workers are unavailable in this browser.");
    }
    if (!this.worker) {
      this.worker = new Worker(new URL("./transformers-worker.ts", import.meta.url), { type: "module" });
    }
    return this.worker;
  }

  async *chat(messages: Message[]): AsyncGenerator<string> {
    const worker = this.ensureWorker();
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const queue = createQueue<CpuWorkerMessage>();
    const onMessage = (event: MessageEvent<CpuWorkerMessage>) => {
      if (event.data.id === id || event.data.id === "__load__") queue.push(event.data);
    };

    worker.addEventListener("message", onMessage);
    this.activeQueue = queue;
    this.activeId = id;

    worker.postMessage({
      type: "generate",
      id,
      messages: messages
        .filter((message) => message.role === "system" || message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role, content: message.content })),
      maxNewTokens: 320,
    });

    try {
      while (true) {
        const event = await queue.next();
        if (event.id === "__load__" && event.type === "progress") {
          const progress = typeof event.value === "number" ? event.value : 0;
          window.dispatchEvent(new CustomEvent("ambi:model-progress", { detail: progress }));
          continue;
        }
        if (event.type === "chunk") {
          if (event.text) yield event.text;
          continue;
        }
        if (event.type === "error") {
          throw new Error(event.error || "Local CPU inference failed.");
        }
        if (event.type === "done") return;
      }
    } finally {
      worker.removeEventListener("message", onMessage);
      if (this.activeId === id) {
        this.activeId = null;
        this.activeQueue = null;
      }
    }
  }

  async stop() {
    const queue = this.activeQueue;
    const id = this.activeId;
    this.worker?.terminate();
    this.worker = null;
    this.activeQueue = null;
    this.activeId = null;
    if (queue && id) queue.push({ type: "done", id });
  }

  async unload() {
    await this.stop();
  }
}
