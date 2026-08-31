import { NextResponse } from "next/server";
import { checkSharedRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { checkUserMessage } from "@/lib/security/safety";
import { originError, sameOriginAllowed } from "@/lib/security/request";
export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_PROMPT = 2400;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 18 * 1024 * 1024;
function errorResponse(message: string, status = 400) { return NextResponse.json({ ok:false, error:message }, { status, headers:{ "Cache-Control":"no-store" } }); }
function normalizeType(value: unknown): "image"|"video"|null { return value === "image" || value === "video" ? value : null; }
export async function POST(request: Request) {
  if (!sameOriginAllowed(request)) return originError();
  const rate = await checkSharedRateLimit(request, { limit: 6, windowMs: 60_000 }, "media");
  if (!rate.ok) return rateLimitResponse(rate.retryAfterSeconds);
  const key = process.env.POLLINATIONS_API_KEY?.trim() || "";
  if (!key) return errorResponse("Image/video generation is not configured. Add POLLINATIONS_API_KEY in Vercel.", 503);
  const body = await request.json().catch(() => null) as { type?: unknown; prompt?: unknown; model?: unknown } | null;
  const type = normalizeType(body?.type);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().replace(/\s+/g, " ") : "";
  if (!type) return errorResponse("Choose image or video generation.");
  if (!prompt || prompt.length > MAX_PROMPT) return errorResponse("Prompt must be between 1 and " + MAX_PROMPT + " characters.");
  const safety = checkUserMessage(prompt);
  if (!safety.allowed) return errorResponse(safety.reason ?? "This media request was blocked.", 400);
  const model = type === "image" ? (process.env.POLLINATIONS_IMAGE_MODEL?.trim() || "zimage") : (process.env.POLLINATIONS_VIDEO_MODEL?.trim() || "veo");
  const encoded = encodeURIComponent(prompt);
  const target = type === "image"
    ? "https://gen.pollinations.ai/image/" + encoded + "?model=" + encodeURIComponent(model) + "&width=1024&height=1024"
    : "https://gen.pollinations.ai/video/" + encoded + "?model=" + encodeURIComponent(model) + "&duration=4";
  try {
    const upstream = await fetch(target, { cache:"no-store", signal:AbortSignal.timeout(type === "video" ? 120000 : 60000), headers:{ Authorization:"Bearer " + key, Accept:type === "image" ? "image/*" : "video/mp4,*/*" } });
    if (!upstream.ok) {
      const detail = (await upstream.text().catch(() => "")).slice(0, 500);
      const message = upstream.status === 401 ? "Media generation credentials are invalid." : upstream.status === 402 ? "Media generation credits are exhausted." : upstream.status === 429 ? "Media generation is temporarily rate-limited. Try again shortly." : "Media provider returned HTTP " + upstream.status + "." + (detail ? " " + detail : "");
      return errorResponse(message, upstream.status >= 500 ? 502 : upstream.status);
    }
    const contentType = upstream.headers.get("content-type") || (type === "image" ? "image/png" : "video/mp4");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const limit = type === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (!buffer.byteLength) return errorResponse("The media provider returned an empty file.", 502);
    if (buffer.byteLength > limit) return errorResponse("The generated media is too large to return safely. Try a shorter or simpler prompt.", 502);
    return new NextResponse(buffer, { status:200, headers:{ "Content-Type":contentType, "Cache-Control":"private, no-store", "X-Ambi-Media-Provider":"pollinations" } });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "Media generation timed out. Please retry." : error instanceof Error ? error.message : "Media generation failed.";
    return errorResponse(message, 504);
  }
}