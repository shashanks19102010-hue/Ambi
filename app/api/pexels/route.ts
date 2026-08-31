import { NextResponse } from "next/server";
import { checkSharedRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { originError, sameOriginAllowed } from "@/lib/security/request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!sameOriginAllowed(request)) return originError();
  const rate = await checkSharedRateLimit(request, { limit: 20, windowMs: 60_000 }, "pexels");
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  const type = url.searchParams.get("type") === "video" ? "video" : "photo";
  const page = Math.min(Math.max(Number(url.searchParams.get("page") ?? "1") || 1, 1), 100);
  const orientation = url.searchParams.get("orientation") ?? "";
  const token = process.env.PEXELS_API_KEY?.trim() ?? "";

  if (!token) return NextResponse.json({ ok: false, error: "Pexels is not configured on this deployment." }, { status: 503 });
  if (!query || query.length > 180) return NextResponse.json({ ok: false, error: "Enter a valid search query." }, { status: 400 });

  const endpoint = type === "video" ? "https://api.pexels.com/v1/videos/search" : "https://api.pexels.com/v1/search";
  const target = new URL(endpoint);
  target.searchParams.set("query", query);
  target.searchParams.set("page", String(page));
  target.searchParams.set("per_page", "12");
  if (["landscape", "portrait", "square"].includes(orientation)) target.searchParams.set("orientation", orientation);

  try {
    const response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(9000), headers: { Authorization: token, Accept: "application/json" } });
    const data = await response.json().catch(() => ({})) as {
      total_results?: number;
      photos?: Array<{ id:number; url:string; width:number; height:number; photographer?:string; photographer_url?:string; alt?:string; src?:{medium?:string;large?:string} }>;
      videos?: Array<{ id:number; url:string; width:number; height:number; image?:string; duration?:number; user?:{name?:string;url?:string}; video_files?:Array<{file_type?:string;width?:number|null;link?:string}> }>;
    };
    if (!response.ok) return NextResponse.json({ ok:false, error: response.status === 401 ? "Pexels credentials are invalid." : response.status === 429 ? "Pexels rate limit reached. Please try again later." : `Pexels returned HTTP ${response.status}.` }, { status: response.status >= 500 ? 502 : response.status });

    const results = type === "video"
      ? (data.videos ?? []).map((item) => ({
          id:item.id, type:"video", title:"Pexels video", url:item.url, preview:item.image ?? "",
          media:(item.video_files ?? []).filter((file) => file.file_type === "video/mp4" && typeof file.link === "string").sort((a,b)=>(a.width ?? 99999)-(b.width ?? 99999))[0]?.link ?? "",
          photographer:item.user?.name ?? "Pexels contributor", photographerUrl:item.user?.url ?? "",
          width:item.width, height:item.height, duration:item.duration ?? 0,
        }))
      : (data.photos ?? []).map((item) => ({
          id:item.id, type:"photo", title:item.alt ?? "Pexels photo", url:item.url,
          preview:item.src?.large ?? item.src?.medium ?? "", media:item.src?.large ?? item.src?.medium ?? "",
          photographer:item.photographer ?? "Pexels contributor", photographerUrl:item.photographer_url ?? "",
          width:item.width, height:item.height,
        }));

    return NextResponse.json({ ok:true, provider:"pexels", type, page, total_results:data.total_results ?? results.length, results, attribution:"Photos and videos provided by Pexels" }, {
      headers: { "Cache-Control":"private, max-age=300" },
    });
  } catch {
    return NextResponse.json({ ok:false, provider:"pexels", error:"Pexels search timed out. Please try again." }, { status:504 });
  }
}
