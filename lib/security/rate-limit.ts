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
