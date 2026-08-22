import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (
    process.env.AMBI_WEB_SEARCH_ENABLED !== "1" ||
    !process.env.TAVILY_API_KEY
  ) {
    return NextResponse.json(
      {
        results: [],
        disabled: true
      },
      {
        status: 503
      }
    );
  }

  const query =
    new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query || query.length > 300) {
    return NextResponse.json(
      {
        results: []
      },
      {
        status: 400
      }
    );
  }

  const result = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
      search_depth: "basic"
    }),
    cache: "no-store"
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        results: []
      },
      {
        status: 502
      }
    );
  }

  const data = await result.json();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}