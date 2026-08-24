import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Image generation is not configured. Add OPENAI_API_KEY in Vercel." }, { status: 503 });

  let body: { prompt?: string };
  try {
    body = await request.json() as { prompt?: string };
  } catch {
    return NextResponse.json({ error: "Invalid image generation request." }, { status: 400 });
  }

  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return NextResponse.json({ error: "Describe the image you want to create." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Image prompt is too long. Keep it under 4,000 characters." }, { status: 400 });

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt,
        size: "1024x1024",
        quality: "medium",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });

    const payload = await response.json().catch(() => ({})) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: payload.error?.message || `Image generation failed (${response.status}).` }, { status: response.status });
    const encoded = payload.data?.[0]?.b64_json;
    if (!encoded) return NextResponse.json({ error: "The image provider returned no image data." }, { status: 502 });

    return NextResponse.json({
      ok: true,
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      dataUrl: `data:image/png;base64,${encoded}`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation request failed.";
    return NextResponse.json({ error: message }, { status: 504 });
  }
}
