import { CLOUD_MODEL_CATALOG, DEFAULT_CLOUD_MODEL_ID, SYSTEM_PROMPT } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const encoder = new TextEncoder();
const MAX_MESSAGES = 40;
const MAX_CHARS = 12000;
const MAX_OUTPUT = 4096;
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function key() { return process.env.GROQ_API_KEY?.trim() || process.env.AI_GATEWAY_API_KEY?.trim() || ""; }
function modelOf(value: unknown) { return typeof value === "string" && CLOUD_MODEL_CATALOG.some((m) => m.id === value) ? value : DEFAULT_CLOUD_MODEL_ID; }
function normalize(input: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(input)) return [];
  return input.slice(-MAX_MESSAGES).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (typeof content !== "string") return [];
    const safe = content.slice(0, MAX_CHARS);
    if (role === "assistant") return [{ role: "assistant" as const, content: safe }];
    if (role === "tool" || role === "system") return [{ role: "user" as const, content: `[Untrusted reference data]\n${safe}` }];
    return [{ role: "user" as const, content: safe }];
  });
}
function sse(event: unknown) { return encoder.encode(`data: ${JSON.stringify(event)}\n\n`); }

async function callGroq(model: string, messages: ChatMessage[], stream: boolean, signal?: AbortSignal) {
  const apiKey = key();
  if (!apiKey) throw new Error("Groq API key is not configured on this deployment.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: stream ? "text/event-stream" : "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: MAX_OUTPUT, stream }),
    });
    const raw = response.ok && stream ? null : await response.text();
    if (!response.ok) {
      let detail = `Groq returned HTTP ${response.status}.`;
      if (raw) { try { const parsed = JSON.parse(raw) as { error?: { message?: unknown } }; if (typeof parsed.error?.message === "string") detail = parsed.error.message; } catch { detail = raw.slice(0, 400); } }
      const error = new Error(detail) as Error & { status?: number }; error.status = response.status; throw error;
    }
    return { response };
  } finally { clearTimeout(timeout); }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("probe") !== "1") return Response.json({ ok: true, provider: "groq", configured: Boolean(key()), model: modelOf(undefined), models: CLOUD_MODEL_CATALOG }, { headers: { "Cache-Control": "no-store" } });
  const started = Date.now();
  try {
    const selected = modelOf(undefined);
    const { response } = await callGroq(selected, [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: "Reply with exactly AMBI_OK" }], false);
    const raw = await response.text();
    const parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: unknown } }> };
    const text = parsed.choices?.[0]?.message?.content;
    return Response.json({ ok: true, provider: "groq", model: selected, status: 200, latencyMs: Date.now() - started, reply: typeof text === "string" ? text : "" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? Number((error as { status?: number }).status) : 502;
    return Response.json({ ok: false, provider: "groq", configured: Boolean(key()), latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "Groq probe failed." }, { status: status >= 500 ? 502 : status });
  }
}

export async function POST(request: Request) {
  if (!key()) return Response.json({ error: "Groq API key is not configured on this deployment." }, { status: 503 });
  try {
    const body = await request.json() as { messages?: unknown; model?: unknown };
    const selected = modelOf(body.model);
    const history = normalize(body.messages);
    if (!history.length) return Response.json({ error: "No chat messages were provided." }, { status: 400 });
    const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
    const { response } = await callGroq(selected, messages, true, request.signal);
    if (!response.body) return Response.json({ error: "Groq returned no response stream." }, { status: 502 });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sentText = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim(); if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim(); if (!payload || payload === "[DONE]") continue;
              try {
                const data = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: unknown } }> };
                const text = data.choices?.[0]?.delta?.content;
                if (typeof text === "string" && text) { sentText = true; controller.enqueue(sse({ type: "delta", text })); }
              } catch { /* ignore malformed provider frame */ }
            }
          }
          if (!sentText) controller.enqueue(sse({ type: "error", code: "EMPTY_RESPONSE", message: "Groq returned an empty response." }));
          else controller.enqueue(sse({ type: "done" }));
          controller.close();
        } catch (error) {
          if (!request.signal.aborted) { controller.enqueue(sse({ type: "error", code: "STREAM", message: error instanceof Error ? error.message : "Groq stream failed." })); controller.close(); }
        } finally { reader.releaseLock(); }
      },
      cancel() { void reader.cancel(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store, must-revalidate", Connection: "keep-alive", "X-Content-Type-Options": "nosniff", "X-Ambi-Provider": "groq", "X-Ambi-Model": selected } });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const status = typeof (error as { status?: unknown }).status === "number" ? Number((error as { status?: number }).status) : 502;
    return Response.json({ error: error instanceof Error ? error.message : "Groq request failed." }, { status: status >= 500 ? 502 : status });
  }
}
