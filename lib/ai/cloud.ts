import type { Message } from "@/types/chat";

export class CloudInferenceError extends Error {
  constructor(message: string, public readonly code = "CLOUD_INFERENCE_ERROR") {
    super(message);
    this.name = "CloudInferenceError";
  }
}

export interface CloudStreamOptions {
  messages: Message[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export async function streamCloudChat({ messages, signal, onDelta }: CloudStreamOptions): Promise<void> {
  let response: Response;

  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
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
    throw new CloudInferenceError(detail, "REMOTE_ERROR");
  }

  if (!response.body) throw new CloudInferenceError("Cloud AI returned an empty stream.", "EMPTY_STREAM");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) onDelta(decoder.decode(value, { stream: true }));
    }
    const tail = decoder.decode();
    if (tail) onDelta(tail);
  } finally {
    reader.releaseLock();
  }
}
