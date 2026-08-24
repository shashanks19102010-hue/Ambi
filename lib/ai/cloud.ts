import type { Message } from "@/types/chat";

export class CloudInferenceError extends Error {
  constructor(message: string, public readonly code = "CLOUD_INFERENCE_ERROR") {
    super(message);
    this.name = "CloudInferenceError";
  }
}

export interface CloudStreamOptions {
  messages: Message[];
  model: string;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export async function streamCloudChat({ messages, model, signal, onDelta }: CloudStreamOptions): Promise<void> {
  if (signal?.aborted) throw new CloudInferenceError("Cloud generation stopped.", "ABORTED");

  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/plain" },
      cache: "no-store",
      body: JSON.stringify({ messages, model }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new CloudInferenceError("Cloud generation stopped.", "ABORTED");
    throw new CloudInferenceError(error instanceof Error ? error.message : "Network request failed.", "NETWORK_ERROR");
  }

  if (!response.ok) {
    let detail = `Cloud AI returned HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim()) detail = body.error;
    } catch {
      // Keep the generic HTTP error when the server did not return JSON.
    }
    throw new CloudInferenceError(detail, response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "REMOTE_ERROR");
  }

  if (!response.body) throw new CloudInferenceError("Cloud AI returned an empty stream.", "EMPTY_STREAM");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        throw new CloudInferenceError("Cloud generation stopped.", "ABORTED");
      }
      try {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) onDelta(decoder.decode(value, { stream: true }));
      } catch (error) {
        if (signal?.aborted) throw new CloudInferenceError("Cloud generation stopped.", "ABORTED");
        throw error;
      }
    }
    const tail = decoder.decode();
    if (tail) onDelta(tail);
  } finally {
    reader.releaseLock();
  }
}
