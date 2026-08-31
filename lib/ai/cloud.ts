import type { Message } from "@/types/chat";
import { chatWithRecovery } from "@/lib/ai/engine";

export class CloudInferenceError extends Error {
  constructor(message: string, public readonly code = "CLOUD_ERROR") { super(message); this.name = "CloudInferenceError"; }
}

type Event = { type: "delta"; text: string } | { type: "done" } | { type: "error"; message: string; code?: string };
function processEvent(event: Event, onDelta: (text: string) => void) {
  if (event.type === "delta" && event.text) onDelta(event.text);
  if (event.type === "error") throw new CloudInferenceError(event.message, event.code || "REMOTE");
  return event.type === "done";
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const LOCAL_FALLBACK_MODEL = "SmolLM2-360M-Instruct-q4f32_1-MLC";

function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new CloudInferenceError("Generation stopped.", "ABORTED"));
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new CloudInferenceError("Generation stopped.", "ABORTED")); }, { once: true });
  });
}

async function requestWithRetry(body: string, signal?: AbortSignal): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, cache: "no-store", body, signal });
      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) return response;
      const retryAfter = Number(response.headers.get("Retry-After"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 500 * 2 ** (attempt - 1), signal);
    } catch (error) {
      if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(400 * 2 ** (attempt - 1), signal);
    }
  }
  throw new CloudInferenceError(lastError instanceof Error ? lastError.message : "Network request failed after automatic retries.", "NETWORK");
}

async function runLocalFallback(messages: Message[], signal: AbortSignal | undefined, onDelta: (text: string) => void) {
  if (signal.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
  try {
    for await (const delta of chatWithRecovery(LOCAL_FALLBACK_MODEL, messages)) {
      if (signal.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
      onDelta(delta);
    }
  } catch (error) {
    throw new CloudInferenceError(
      `Cloud AI is temporarily unavailable, and local fallback could not recover. ${error instanceof Error ? error.message : "Try again after reconnecting or opening a fresh chat."}`,
      "FALLBACK_FAILED",
    );
  }
}

export async function streamCloudChat({ messages, model, signal, onDelta, imageDataUrl, systemExtras, memories, toolNotes }: { messages: Message[]; model: string; signal?: AbortSignal; onDelta: (text: string) => void; imageDataUrl?: string; systemExtras?: { language?: "auto" | "en" | "hi" | "hinglish"; responseStyle?: "concise" | "normal" | "detailed" | "expert" }; memories?: string[]; toolNotes?: string }) {
  if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
  let attachedImage = imageDataUrl;
  if (!attachedImage && typeof window !== "undefined") {
    try { attachedImage = sessionStorage.getItem("ambi:vision-image") || undefined; sessionStorage.removeItem("ambi:vision-image"); } catch { attachedImage = undefined; }
  }
  try {
    const response = await requestWithRetry(JSON.stringify({ model, messages, imageDataUrl: attachedImage, systemExtras, memories, toolNotes }), signal);
    if (!response.ok) {
      let detail = `AI request failed (${response.status}).`;
      try { const body = await response.json() as { error?: string; message?: string }; detail = body.error || body.message || detail; } catch { /* keep status */ }
      const code = response.status === 401 || response.status === 403 ? "AUTH" : response.status === 429 ? "RATE_LIMIT" : response.status >= 500 ? "REMOTE_RETRY_EXHAUSTED" : "REMOTE";
      throw new CloudInferenceError(detail, code);
    }
    if (!response.body) throw new CloudInferenceError("AI returned an empty stream.", "EMPTY_STREAM");

    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let completed = false;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim(); if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim(); if (!payload || payload === "[DONE]") continue;
          try { const event = JSON.parse(payload) as Event; completed = processEvent(event, onDelta) || completed; if (completed) return; }
          catch (error) { if (error instanceof CloudInferenceError) throw error; }
        }
      }
      buffer += decoder.decode();
      const tailLines = buffer.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("data:"));
      for (const line of tailLines) { const payload = line.slice(5).trim(); if (!payload || payload === "[DONE]") continue; try { const event = JSON.parse(payload) as Event; if (processEvent(event, onDelta)) completed = true; } catch (error) { if (error instanceof CloudInferenceError) throw error; } }
    } catch (error) {
      if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
      if (error instanceof CloudInferenceError) throw error;
      throw new CloudInferenceError(error instanceof Error ? error.message : "Stream failed.", "STREAM");
    } finally { reader.releaseLock(); }
    if (!completed) throw new CloudInferenceError("The AI stream ended before completion.", "INCOMPLETE_STREAM");
  } catch (error) {
    if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
    if (error instanceof CloudInferenceError && ["RATE_LIMIT", "REMOTE_RETRY_EXHAUSTED", "NETWORK", "STREAM", "INCOMPLETE_STREAM"].includes(error.code)) {
      console.warn("[Ambi recovery] switching to local fallback", error.code);
      await runLocalFallback(messages, signal, onDelta);
      return;
    }
    throw error;
  }
}
