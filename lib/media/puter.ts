export type MediaKind = "image" | "video";

type MediaElementLike = { src?: string; currentSrc?: string };
type PuterResult = string | MediaElementLike | unknown;

export async function getPuter() {
  const module = await import("@heyputer/puter.js");
  return module.puter;
}

export function getMediaSource(result: PuterResult, kind: MediaKind) {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (!result || typeof result !== "object") return "";
  const value = result as MediaElementLike;
  if (typeof value.src === "string" && value.src.trim()) return value.src.trim();
  if (typeof value.currentSrc === "string" && value.currentSrc.trim()) return value.currentSrc.trim();
  if (kind === "image" && typeof HTMLImageElement !== "undefined" && result instanceof HTMLImageElement) return result.src;
  if (kind === "video" && typeof HTMLVideoElement !== "undefined" && result instanceof HTMLVideoElement) return result.currentSrc || result.src;
  return "";
}

export async function withRetries<T>(operation: () => Promise<T>, retries = 2, delays = [700, 1600]) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, delays[Math.min(attempt, delays.length - 1)] ?? 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Media generation failed.");
}
