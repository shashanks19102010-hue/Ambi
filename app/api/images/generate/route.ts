import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const OPENROUTER = "https://openrouter.ai/api/v1/images";
const MAX_PROMPT = 4000;

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Image generation is not configured. Add OPENROUTER_API_KEY in Vercel." }, { status: 503 });

  let body: { prompt?: string; model?: string; aspectRatio?: string; resolution?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid image generation request." }, { status: 400 }); }

  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return NextResponse.json({ error: "Describe the image you want to create." }, { status: 400 });
  if (prompt.length > MAX_PROMPT) return NextResponse.json({ error: `Image prompt is too long. Keep it under ${MAX_PROMPT} characters.` }, { status: 400 });

  const model = typeof body.model === "string" && body.model.length > 0 ? body.model : (process.env.OPENROUTER_IMAGE_MODEL || "recraft/recraft-v4.1-pro:free");

  try {
    const response = await fetch(OPENROUTER, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ambi-ai.vercel.app",
        "X-Title": "Ambi AI",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(110000),
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        aspect_ratio: body.aspectRatio || "1:1",
        resolution: body.resolution || "2K",
      }),
    });

    const payload = await response.json().catch(() => ({})) as {
      data?: Array<{ b64_json?: string; mime_type?: string; url?: string }>;
      error?: { message?: string } | string;
    };
    if (!response.ok) {
      const detail = typeof payload.error === "string" ? payload.error : payload.error?.message;
      return NextResponse.json({ error: detail || `Image generation failed (${response.status}).` }, { status: response.status });
    }

    const item = payload.data?.[0];
    if (!item) return NextResponse.json({ error: "The image provider returned no image data." }, { status: 502 });
    const mime = item.mime_type || "image/png";
    if (item.b64_json) return NextResponse.json({ ok: true, provider: "openrouter", model, dataUrl: `data:${mime};base64,${item.b64_json}` }, { headers: { "Cache-Control": "no-store" } });
    if (item.url) return NextResponse.json({ ok: true, provider: "openrouter", model, dataUrl: item.url }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "The image provider returned an unsupported image format." }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image generation request failed." }, { status: 504 });
  }
}
