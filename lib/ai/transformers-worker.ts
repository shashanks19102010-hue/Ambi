import { pipeline, TextStreamer } from "@huggingface/transformers";

type ChatRole = "system" | "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };
type GenerateRequest = {
  type: "generate";
  id: string;
  messages: ChatMessage[];
  maxNewTokens: number;
};
type WorkerResponse = {
  type: "progress" | "chunk" | "done" | "error";
  id: string;
  value?: number;
  text?: string;
  error?: string;
};
type WorkerScope = {
  onmessage: ((event: MessageEvent<GenerateRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

type ProgressReport = {
  status?: string;
  progress?: number;
};

const scope = globalThis as unknown as WorkerScope;
let generatorPromise: ReturnType<typeof createGenerator> | null = null;

function createGenerator() {
  return pipeline("text-generation", "HuggingFaceTB/SmolLM2-360M-Instruct", {
    device: "wasm",
    dtype: "q4",
    progress_callback: (report) => {
      const info = report as ProgressReport;
      if ((info.status === "progress" || info.status === "progress_total") && typeof info.progress === "number") {
        const progress = Math.max(0, Math.min(100, info.progress));
        scope.postMessage({ type: "progress", id: "__load__", value: progress / 100 });
      }
    },
  });
}

async function getGenerator() {
  generatorPromise ??= createGenerator();
  return generatorPromise;
}

scope.onmessage = (event) => {
  void (async () => {
    const request = event.data;
    if (request.type !== "generate") return;

    try {
      const generator = await getGenerator();
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => {
          if (text) scope.postMessage({ type: "chunk", id: request.id, text });
        },
      });

      await generator(request.messages, {
        max_new_tokens: request.maxNewTokens,
        do_sample: false,
        streamer,
      });

      scope.postMessage({ type: "done", id: request.id });
    } catch (error) {
      scope.postMessage({
        type: "error",
        id: request.id,
        error: error instanceof Error ? error.message : "Local CPU inference failed.",
      });
    }
  })();
};
