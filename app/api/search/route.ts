import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.AMBI_WEB_SEARCH_ENABLED !== "1" || !process.env.TAVILY_API_KEY) {
    return NextResponse.json({ results: [], disabled: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 300) return NextResponse.json({ results: [] }, { status: 400 });

  try {
    const result = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ambi-Request": "research" },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: 6, search_depth: "basic", include_answer: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!result.ok) return NextResponse.json({ results: [] }, { status: 502 });
    const data = await result.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ results: [] }, { status: 504 });
  }
}
