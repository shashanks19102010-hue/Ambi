import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function ddgResults(data: { AbstractText?: string; AbstractURL?: string; Heading?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string; FirstURL?: string }> }> }) {
  const items: Array<{ title: string; url: string; content: string }> = [];
  if (data.AbstractText && data.AbstractURL) items.push({ title: data.Heading || "DuckDuckGo result", url: data.AbstractURL, content: data.AbstractText });
  for (const item of data.RelatedTopics ?? []) {
    const list = "Topics" in item && Array.isArray(item.Topics) ? item.Topics : [item as { Text?: string; FirstURL?: string }];
    for (const entry of list) {
      if (entry.Text && entry.FirstURL) items.push({ title: entry.Text.split(" - ")[0].slice(0, 120), url: entry.FirstURL, content: entry.Text });
      if (items.length >= 6) break;
    }
    if (items.length >= 6) break;
  }
  return items.slice(0, 6);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") === "1";
  const enabled = process.env.AMBI_WEB_SEARCH_ENABLED === "1";
  const tavilyConfigured = enabled && Boolean(process.env.TAVILY_API_KEY?.trim());

  if (probe) return NextResponse.json({ ok: true, enabled, provider: tavilyConfigured ? "tavily" : enabled ? "duckduckgo" : "disabled", configured: enabled }, { headers: { "Cache-Control": "no-store" } });
  if (!enabled) return NextResponse.json({ results: [], disabled: true }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const rate = checkRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 300) return NextResponse.json({ results: [], error: "A valid research query is required." }, { status: 400 });

  if (tavilyConfigured) {
    try {
      const result = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json", "X-Ambi-Request": "research" }, body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY!.trim(), query, max_results: 6, search_depth: "basic", include_answer: false }), cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (result.ok) return NextResponse.json(await result.json(), { headers: { "Cache-Control": "no-store" } });
    } catch { /* Explicitly enabled research may use the documented fallback. */ }
  }

  try {
    const fallback = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!fallback.ok) return NextResponse.json({ results: [], disabled: false }, { status: 502 });
    const data = await fallback.json() as Parameters<typeof ddgResults>[0];
    return NextResponse.json({ results: ddgResults(data), provider: "duckduckgo" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ results: [], disabled: false }, { status: 504 }); }
}
