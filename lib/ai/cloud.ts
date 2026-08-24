import type { Message } from "@/types/chat";

export class CloudInferenceError extends Error {
  constructor(message: string, public readonly code = "CLOUD_ERROR") { super(message); this.name = "CloudInferenceError"; }
}

type Event = { type: "delta"; text: string } | { type: "done" } | { type: "error"; message: string; code?: string };
function processEvent(event: Event, onDelta: (text: string) => void) { if (event.type === "delta" && event.text) onDelta(event.text); if (event.type === "error") throw new CloudInferenceError(event.message, event.code || "REMOTE"); return event.type === "done"; }

export async function streamCloudChat({ messages, model, signal, onDelta, imageDataUrl }: { messages: Message[]; model: string; signal?: AbortSignal; onDelta: (text: string) => void; imageDataUrl?: string }) {
  if (signal?.aborted) throw new CloudInferenceError("Generation stopped.", "ABORTED");
  let attachedImage = imageDataUrl;
  if (!attachedImage && typeof window !== "undefined") {
    try { attachedImage = sessionStorage.getItem("ambi:vision-image") || undefined; sessionStorage.removeItem("ambi:vision-image"); } catch { attachedImage = undefined; }
  }

  let response: Response;
  try {
    response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, cache: "no-store", body: JSON.stringify({ model, messages, imageDataUrl: attachedImage }), signal });
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
}
