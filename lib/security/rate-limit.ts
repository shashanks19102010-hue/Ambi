type Bucket = { startedAt: number; count: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

function now() { return Date.now(); }

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

export function checkRateLimit(request: Request, options: RateLimitOptions): { ok: boolean; retryAfterSeconds: number } {
  const key = `${getClientKey(request)}:${options.limit}:${options.windowMs}`;
  const current = now();
  const existing = buckets.get(key);

  if (!existing || current - existing.startedAt >= options.windowMs) {
    buckets.set(key, { startedAt: current, count: 1 });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (existing.count < options.limit) {
    existing.count += 1;
    return { ok: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((options.windowMs - (current - existing.startedAt)) / 1000));
  return { ok: false, retryAfterSeconds };
}


export async function checkSharedRateLimit(request: Request, options: RateLimitOptions, scope = "default"): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!redisUrl || !redisToken) return checkRateLimit(request, options);
  const rawClient = getClientKey(request);
  const safeClient = rawClient.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 100) || "unknown";
  const key = encodeURIComponent(`ambi:rl:${scope}:${safeClient}:${options.limit}:${options.windowMs}`);
  try {
    const response = await fetch(`${redisUrl}/incr/${key}`, { method: "POST", headers: { Authorization: `Bearer ${redisToken}`, Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Upstash HTTP ${response.status}`);
    const payload = await response.json() as { result?: number | string };
    const count = Number(payload.result);
    if (!Number.isFinite(count)) throw new Error("Invalid Upstash rate-limit result.");
    if (count === 1) {
      await fetch(`${redisUrl}/expire/${key}/${Math.max(1, Math.ceil(options.windowMs / 1000))}`, { method: "POST", headers: { Authorization: `Bearer ${redisToken}` }, cache: "no-store" });
    }
    if (count > options.limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(options.windowMs / 1000)) };
    return { ok: true, retryAfterSeconds: 0 };
  } catch {
    return checkRateLimit(request, options);
  }
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests. Please wait a moment and try again.", retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}

// Keep the in-memory map bounded in long-lived Node processes.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = now() - 10 * 60_000;
    for (const [key, bucket] of buckets) if (bucket.startedAt < cutoff) buckets.delete(key);
  }, 10 * 60_000).unref?.();
}
