import { CLOUD_MODEL_CATALOG, DEFAULT_CLOUD_MODEL_ID } from "@/lib/constants";
import { checkSharedRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { originError, sameOriginAllowed } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function getKey() {
  return process.env.GROQ_API_KEY?.trim() || "";
}

export async function GET(request: Request) {
  const key = getKey();
  const model = DEFAULT_CLOUD_MODEL_ID;
  const probe = new URL(request.url).searchParams.get("probe") === "1";
  if (!probe) return Response.json({ ok: true, provider: "groq", model, probeRequired: true }, { headers: { "Cache-Control": "no-store" } });
  if (!sameOriginAllowed(request)) return originError();
  const rate = await checkSharedRateLimit(request, { limit: 3, windowMs: 60_000 }, "health-groq");
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  if (!key) return Response.json({ ok: false, provider: "groq", model, error: "Groq connection is not configured." }, { status: 503 });

  const started = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly OK." }],
        max_tokens: 4,
        temperature: 0,
        stream: false,
      }),
    });

    const raw = await response.text();
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
      if (typeof parsed.error?.message === "string") detail = parsed.error.message;
    } catch {
      detail = raw.slice(0, 300);
    }

    return Response.json(
      {
        ok: response.ok,
        provider: "groq",
        model,
        status: response.status,
        latencyMs: Date.now() - started,
        detail: response.ok ? "Groq connection and authentication succeeded." : detail || "Groq rejected the request.",
      },
      { status: response.ok ? 200 : response.status >= 500 ? 502 : response.status },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        provider: "groq",
        model,
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : "Groq connection failed.",
      },
      { status: 502 },
    );
  }
}
