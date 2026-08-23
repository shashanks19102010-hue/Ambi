import { memoryStore } from "@/lib/memory/store";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { HealthState } from "@/types/chat";

const defaultHealth: HealthState = {
  inference: "unavailable",
  storage: "ready",
  network: "online",
  recovery: "idle",
  lastRecoveryAt: null,
  safeMode: false,
  webSearch: "disabled",
};

export function installWatchdog(onHealth: (health: HealthState) => void) {
  let health: HealthState = { ...defaultHealth };
  let timer = 0;

  const tick = async () => {
    health = { ...health, recovery: "recovering" };
    try {
      if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
      await memoryStore.saveSnapshot([], (await memoryStore.loadSettings()) ?? DEFAULT_SETTINGS);
      health = { ...health, storage: "ready", recovery: "idle", safeMode: false };
    } catch {
      health = { ...health, storage: "degraded", recovery: "safe", safeMode: true, lastRecoveryAt: Date.now() };
    }
    onHealth(health);
    timer = window.setTimeout(tick, 30_000);
  };

  void tick();
  return () => window.clearTimeout(timer);
}
