import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENDPOINT = "https://gateway.pixazo.ai/ltx/text-to-video";
const STATUS = "https://gateway.pixazo.ai/v2/requests/status";
const allowedResolutions = new Set(["720p", "1080p"]);
const allowedAspectRatios = new Set(["16:9", "9:16", "1:1"]);
function authError() { return NextResponse.json({ error: "Video generation is not configured. Add PIXAZO_API_KEY in Vercel." }, { status: 503 }); }

async function getStatus(jobId: string, apiKey: string, signal?: AbortSignal) {
  const response = await fetch(`${STATUS}/${encodeURIComponent(jobId)}`, { headers: { "Ocp-Apim-Subscription-Key": apiKey, Accept: "application/json" }, cache: "no-store", signal });
  const payload = await response.json().catch(() => ({})) as { request_id?: string; status?: string; error?: string | { message?: string }; output?: { media_url?: string[]; media_type?: string } };
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || `Pixazo video status failed (${response.status}).`);
  const state = (payload.status || "PROCESSING").toUpperCase();
  if (["FAILED", "ERROR", "CANCELLED"].includes(state)) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || `Video generation ${state.toLowerCase()}.`);
  return { status: state.toLowerCase(), url: payload.output?.media_url?.[0] || null, mediaType: payload.output?.media_type || "video/mp4" };
}

export async function POST(request: Request) {
  const apiKey = process.env.PIXAZO_API_KEY?.trim();
  if (!apiKey) return authError();
  const rate = checkRateLimit(request, { limit: 3, windowMs: 60_000 });
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  let body: { prompt?: string; duration?: number; resolution?: string; aspectRatio?: string; generateAudio?: boolean };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid video request." }, { status: 400 }); }
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return NextResponse.json({ error: "Describe the video you want to create." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Video prompt is too long." }, { status: 400 });
  const resolution = typeof body.resolution === "string" && allowedResolutions.has(body.resolution) ? body.resolution : "720p";
  const aspectRatio = typeof body.aspectRatio === "string" && allowedAspectRatios.has(body.aspectRatio) ? body.aspectRatio : "16:9";
  const duration = Math.min(Math.max(Number.isFinite(body.duration) ? Number(body.duration) : 5, 5), 10);

  try {
    const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": apiKey }, body: JSON.stringify({ prompt, duration, resolution, aspect_ratio: aspectRatio, generate_audio: body.generateAudio !== false }), cache: "no-store", signal: AbortSignal.timeout(50_000) });
    const payload = await response.json().catch(() => ({})) as { request_id?: string; status?: string; output?: { media_url?: string[]; media_type?: string }; error?: string | { message?: string } };
    if (!response.ok) return NextResponse.json({ error: typeof payload.error === "string" ? payload.error : payload.error?.message || `Video generation failed (${response.status}).` }, { status: response.status });
    const directUrl = payload.output?.media_url?.[0];
    return NextResponse.json({ ok: true, provider: "pixazo", model: "ltx", jobId: payload.request_id || null, status: (payload.status || (directUrl ? "completed" : "queued")).toLowerCase(), url: directUrl || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Video generation request failed." }, { status: 504 }); }
}

export async function GET(request: Request) {
  const apiKey = process.env.PIXAZO_API_KEY?.trim();
  if (!apiKey) return authError();
  const rate = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  if (!jobId || jobId.length > 200) return NextResponse.json({ error: "Missing or invalid video job id." }, { status: 400 });
  try {
    const result = await getStatus(jobId, apiKey, AbortSignal.timeout(30_000));
    return NextResponse.json({ ok: true, jobId, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Video status request failed." }, { status: 504 }); }
}
