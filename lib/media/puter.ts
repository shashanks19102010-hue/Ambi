export type MediaKind = "image" | "video";

type MediaElementLike = { src?: string; currentSrc?: string };
type PuterApi = {
  auth?: { isSignedIn?: () => boolean };
  ai: {
    txt2img: (prompt: string, options?: Record<string, unknown>) => Promise<unknown>;
    txt2vid: (prompt: string, options?: Record<string, unknown>) => Promise<unknown>;
  };
};

declare global {
  interface Window { puter?: PuterApi; }
}

function waitForPuter(timeoutMs = 8000): Promise<PuterApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Puter media tools are only available in the browser."));
  if (window.puter?.ai) return Promise.resolve(window.puter);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (window.puter?.ai) return resolve(window.puter);
      if (Date.now() - started >= timeoutMs) return reject(new Error("Puter media tools could not load. Please refresh the page and try again."));
      window.setTimeout(check, 100);
    };
    check();
  });
}

export async function getPuter() {
  const puter = await waitForPuter();
  if (puter.auth?.isSignedIn && !puter.auth.isSignedIn()) {
    throw new Error("Puter is not connected for this browser. Sign in to Puter first, then retry image or video generation.");
  }
  return puter;
}

export function getMediaSource(result: unknown, kind: MediaKind) {
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
