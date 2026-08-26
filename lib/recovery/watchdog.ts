import { memoryStore } from "@/lib/memory/store";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { HealthState } from "@/types/chat";

export const defaultHealth: HealthState = {
  inference: "unavailable",
  storage: "ready",
  network: "online",
  recovery: "idle",
  lastRecoveryAt: null,
  safeMode: false,
  webSearch: "disabled",
};

export interface WatchdogHooks {
  checkInference?: () => Promise<void>;
  checkNetwork?: () => Promise<void>;
  intervalMs?: number;
}

export function reportRecoveryEvent(name: string, details?: unknown) {
  console.info(`[Ambi recovery] ${name}`, details ?? "");
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ambi:recovery", { detail: { name, details, at: Date.now() } }));
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, attempts = 3, baseDelayMs = 350): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(5_000, baseDelayMs * 2 ** (attempt - 1));
      reportRecoveryEvent("retry", { attempt, nextDelayMs: delay, error: error instanceof Error ? error.message : String(error) });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function installWatchdog(onHealth: (health: HealthState) => void, hooks: WatchdogHooks = {}) {
  let health: HealthState = { ...defaultHealth };
  let timer = 0;
  let stopped = false;
  const intervalMs = hooks.intervalMs ?? 30_000;

  const publish = (next: HealthState) => {
    health = next;
    onHealth({ ...health });
  };

  const tick = async () => {
    if (stopped) return;
    publish({ ...health, recovery: "recovering" });
    try {
      await retryWithBackoff(async () => {
        if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
        await memoryStore.saveSnapshot([], (await memoryStore.loadSettings()) ?? DEFAULT_SETTINGS);
      });
      if (hooks.checkNetwork) await retryWithBackoff(hooks.checkNetwork);
      if (hooks.checkInference) await retryWithBackoff(hooks.checkInference);
      reportRecoveryEvent("healthy");
      publish({ ...health, storage: "ready", network: typeof navigator === "undefined" || navigator.onLine ? "online" : "offline", inference: hooks.checkInference ? "ready" : health.inference, recovery: "idle", safeMode: false });
    } catch (error) {
      reportRecoveryEvent("failed", error instanceof Error ? error.message : String(error));
      publish({ ...health, storage: "degraded", recovery: "failed", safeMode: true, lastRecoveryAt: Date.now(), network: typeof navigator === "undefined" || navigator.onLine ? health.network : "offline", inference: hooks.checkInference ? "error" : health.inference });
    }
    if (!stopped) timer = window.setTimeout(tick, intervalMs);
  };

  void tick();
  return () => { stopped = true; window.clearTimeout(timer); };
}
