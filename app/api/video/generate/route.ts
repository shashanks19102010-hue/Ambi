import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENDPOINT = "https://openrouter.ai/api/v1/videos";

function authError() { return NextResponse.json({ error: "Video generation is not configured. Add OPENROUTER_API_KEY in Vercel." }, { status: 503 }); }

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return authError();
  let body: { prompt?: string; model?: string; duration?: number; resolution?: string; aspectRatio?: string; generateAudio?: boolean };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid video request." }, { status: 400 }); }
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return NextResponse.json({ error: "Describe the video you want to create." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Video prompt is too long." }, { status: 400 });

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://ambi-ai.vercel.app", "X-Title": "Ambi AI" },
      body: JSON.stringify({ model: body.model || process.env.OPENROUTER_VIDEO_MODEL || "bytedance/seedance-2.0", prompt, duration: Math.min(Math.max(body.duration || 5, 4), 15), resolution: body.resolution || "720p", aspect_ratio: body.aspectRatio || "16:9", audio: body.generateAudio !== false }),
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; status?: string; url?: string; error?: { message?: string } | string };
    if (!response.ok) {
      const detail = typeof payload.error === "string" ? payload.error : payload.error?.message;
      return NextResponse.json({ error: detail || `Video generation failed (${response.status}).` }, { status: response.status });
    }
    return NextResponse.json({ ok: true, provider: "openrouter", jobId: payload.id, status: payload.status || "queued", url: payload.url || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video generation request failed." }, { status: 504 });
  }
}
