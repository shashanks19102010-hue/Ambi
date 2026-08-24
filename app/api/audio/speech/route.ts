import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Audio generation is not configured. Add OPENROUTER_API_KEY in Vercel." }, { status: 503 });

  let body: { input?: string; voice?: string; model?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid audio request." }, { status: 400 }); }

  const input = body.input?.trim() ?? "";
  if (!input) return NextResponse.json({ error: "Enter some text to synthesize." }, { status: 400 });
  if (input.length > 8000) return NextResponse.json({ error: "Audio text is too long. Keep it under 8,000 characters." }, { status: 400 });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://ambi-ai.vercel.app", "X-Title": "Ambi AI" },
      body: JSON.stringify({ model: body.model || process.env.OPENROUTER_TTS_MODEL || "openai/gpt-4o-mini-tts-2025-12-15", voice: body.voice || process.env.OPENROUTER_TTS_VOICE || "alloy", input, response_format: "mp3" }),
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json({ error: text.slice(0, 500) || `Audio generation failed (${response.status}).` }, { status: response.status });
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const base64 = Buffer.from(bytes).toString("base64");
    return NextResponse.json({ ok: true, provider: "openrouter", mimeType: "audio/mpeg", dataUrl: `data:audio/mpeg;base64,${base64}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio generation failed." }, { status: 504 });
  }
}
