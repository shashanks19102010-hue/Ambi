import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ENDPOINT = "https://gateway.pixazo.ai/chatterbox-text-to-speech/v1/chatterbox-text-to-speech-request";
const STATUS = "https://gateway.pixazo.ai/v2/requests/status";

export async function POST(request: Request) {
  const apiKey = process.env.PIXAZO_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Audio generation is not configured. Add PIXAZO_API_KEY in Vercel." }, { status: 503 });
  const rate = checkRateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  let body: { text?: string };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid audio request." }, { status: 400 }); }
  const text = body.text?.trim() ?? "";
  if (!text) return NextResponse.json({ error: "Enter text to turn into speech." }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Audio text is too long. Keep it under 5,000 characters." }, { status: 400 });
  try {
    const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "Ocp-Apim-Subscription-Key": apiKey }, body: JSON.stringify({ text, exaggeration: 0.25, temperature: 0.7, cfg: 0.5 }), cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const payload = await response.json().catch(() => ({})) as { request_id?: string; status?: string; output?: { media_url?: string[]; media_type?: string }; error?: string | { message?: string } };
    if (!response.ok) return NextResponse.json({ error: typeof payload.error === "string" ? payload.error : payload.error?.message || `Audio generation failed (${response.status}).` }, { status: response.status });
    const url = payload.output?.media_url?.[0];
    if (url) return NextResponse.json({ ok: true, provider: "pixazo", model: "chatterbox", status: "completed", url, mediaType: payload.output?.media_type || "audio/wav" });
    if (!payload.request_id) return NextResponse.json({ error: "Pixazo returned no audio job." }, { status: 502 });
    return NextResponse.json({ ok: true, provider: "pixazo", model: "chatterbox", status: (payload.status || "queued").toLowerCase(), jobId: payload.request_id, pollUrl: `${STATUS}/${encodeURIComponent(payload.request_id)}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Audio generation request failed." }, { status: 504 }); }
}

export async function GET(request: Request) {
  const apiKey = process.env.PIXAZO_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Audio generation is not configured. Add PIXAZO_API_KEY in Vercel." }, { status: 503 });
  const rate = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  if (!jobId || jobId.length > 200) return NextResponse.json({ error: "Missing or invalid audio job id." }, { status: 400 });
  try {
    const response = await fetch(`${STATUS}/${encodeURIComponent(jobId)}`, { headers: { "Ocp-Apim-Subscription-Key": apiKey, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const payload = await response.json().catch(() => ({})) as { status?: string; output?: { media_url?: string[]; media_type?: string }; error?: string | { message?: string } };
    if (!response.ok) return NextResponse.json({ error: typeof payload.error === "string" ? payload.error : payload.error?.message || `Audio status failed (${response.status}).` }, { status: response.status });
    const state = (payload.status || "PROCESSING").toLowerCase();
    if (["failed", "error", "cancelled"].includes(state)) return NextResponse.json({ error: typeof payload.error === "string" ? payload.error : payload.error?.message || `Audio generation ${state}.`, status: state }, { status: 502 });
    return NextResponse.json({ ok: true, status: state, url: payload.output?.media_url?.[0] || null, mediaType: payload.output?.media_type || "audio/wav" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Audio status request failed." }, { status: 504 }); }
}
