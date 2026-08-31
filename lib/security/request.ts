export function sameOriginAllowed(request: Request): boolean {
  const configured = process.env.AMBI_ALLOWED_ORIGIN?.trim().replace(/\/$/, "");
  const origin = request.headers.get("origin")?.trim().replace(/\/$/, "");
  if (configured) return !origin || origin === configured;
  if (!origin) return true;
  try {
    const url = new URL(request.url);
    return origin === `${url.protocol}//${url.host}`;
  } catch {
    return false;
  }
}

export function originError() {
  return Response.json({ error: "Request origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
