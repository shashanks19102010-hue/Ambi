import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PIXAZO = "https://gateway.pixazo.ai/flux/text-to-image";
const STATUS = "https://gateway.pixazo.ai/v2/requests/status";
const MAX_PROMPT = 4000;

async function poll(requestId: string, apiKey: string, signal: AbortSignal) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await fetch(`${STATUS}/${encodeURIComponent(requestId)}`, { headers: { "Ocp-Apim-Subscription-Key": apiKey, Accept: "application/json" }, cache: "no-store", signal });
    const payload = await response.json().catch(() => ({})) as { status?: string; error?: string | { message?: string }; output?: { media_url?: string[]; media_type?: string } };
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || `Pixazo status failed (${response.status}).`);
    const state = (payload.status || "").toUpperCase();
    const url = payload.output?.media_url?.[0];
    if (state === "COMPLETED" && url) return { url, mediaType: payload.output?.media_type || "image/png" };
    if (["FAILED", "ERROR", "CANCELLED"].includes(state)) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || `Pixazo image generation ${state.toLowerCase()}.`);
  }
  throw new Error("Pixazo image generation timed out. Please try again.");
}

export async function POST(request: Request) {
  const apiKey = process.env.PIXAZO_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Image generation is not configured. Add PIXAZO_API_KEY in Vercel." }, { status: 503 });
  const rate = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);

  let body: { prompt?: string };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid image generation request." }, { status: 400 }); }
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return NextResponse.json({ error: "Describe the image you want to create." }, { status: 400 });
  if (prompt.length > MAX_PROMPT) return NextResponse.json({ error: `Image prompt is too long. Keep it under ${MAX_PROMPT} characters.` }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetch(PIXAZO, { method: "POST", headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": apiKey }, body: JSON.stringify({ prompt }), cache: "no-store", signal: controller.signal });
    const payload = await response.json().catch(() => ({})) as { request_id?: string; status?: string; output?: { media_url?: string[]; media_type?: string }; error?: string | { message?: string } };
    if (!response.ok) return NextResponse.json({ error: typeof payload.error === "string" ? payload.error : payload.error?.message || `Pixazo image generation failed (${response.status}).` }, { status: response.status });
    if (payload.output?.media_url?.[0]) return NextResponse.json({ ok: true, provider: "pixazo", model: "flux", url: payload.output.media_url[0], mediaType: payload.output.media_type || "image/png" });
    if (!payload.request_id) return NextResponse.json({ error: "Pixazo returned no image job." }, { status: 502 });
    const result = await poll(payload.request_id, apiKey, controller.signal);
    return NextResponse.json({ ok: true, provider: "pixazo", model: "flux", url: result.url, mediaType: result.mediaType }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (controller.signal.aborted) return NextResponse.json({ error: "Image generation timed out or was cancelled." }, { status: 504 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image generation request failed." }, { status: 502 });
  } finally { clearTimeout(timeout); }
}
