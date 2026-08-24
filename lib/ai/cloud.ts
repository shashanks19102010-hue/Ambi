import type { Message } from "@/types/chat";

export class CloudInferenceError extends Error {
  constructor(message: string, public readonly code = "CLOUD_ERROR") { super(message); this.name = "CloudInferenceError"; }
}

type Event = { type: "delta"; text: string } | { type: "done" } | { type: "error"; message: string; code?: string };

export async function streamCloudChat({ messages, model, signal, onDelta }: { messages: Message[]; model: string; signal?: AbortSignal; onDelta: (text: string) => void }) {
  if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
  let response: Response;
  try {
    response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, cache: "no-store", body: JSON.stringify({ model, messages }), signal });
  } catch (error) {
    if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
    throw new CloudInferenceError(error instanceof Error ? error.message : "Network request failed.", "NETWORK");
  }
  if (!response.ok) {
    let detail = `AI request failed (${response.status}).`;
    try { const body = await response.json() as { error?: string; message?: string }; detail = body.error || body.message || detail; } catch { /* keep status */ }
    throw new CloudInferenceError(detail, response.status === 401 || response.status === 403 ? "AUTH" : response.status === 429 ? "RATE_LIMIT" : "REMOTE");
  }
  if (!response.body) throw new CloudInferenceError("AI returned an empty stream.", "EMPTY_STREAM");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        let event: Event;
        try { event = JSON.parse(payload) as Event; } catch { continue; }
        if (event.type === "delta") onDelta(event.text);
        if (event.type === "error") throw new CloudInferenceError(event.message, event.code || "REMOTE");
        if (event.type === "done") return;
      }
    }
    const tail = decoder.decode();
    if (tail.trim().startsWith("data:")) {
      try { const event = JSON.parse(tail.trim().slice(5).trim()) as Event; if (event.type === "delta") onDelta(event.text); if (event.type === "error") throw new CloudInferenceError(event.message, event.code || "REMOTE"); } catch (error) { if (error instanceof CloudInferenceError) throw error; }
    }
  } catch (error) {
    if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
    if (error instanceof CloudInferenceError) throw error;
    throw new CloudInferenceError(error instanceof Error ? error.message : "Stream failed.", "STREAM");
  } finally { reader.releaseLock(); }
}
