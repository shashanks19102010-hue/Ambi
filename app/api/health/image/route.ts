import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json({
    ok: configured,
    provider: "openai",
    configured,
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    status: configured ? "ready" : "disabled",
  }, { headers: { "Cache-Control": "no-store" } });
}
