import { memoryStore } from "@/lib/memory/store";
import type { HealthState } from "@/types/chat";

const defaultHealth: HealthState = {
  inference: "unavailable",
  storage: "ready",
  lastRecoveryAt: null,
  safeMode: false
};

export function installWatchdog(
  onHealth: (health: HealthState) => void
) {
  let health = {
    ...defaultHealth
  };

  let timer = 0;

  const tick = async () => {
    try {
      if (
        typeof indexedDB ===
        "undefined"
      ) {
        throw new Error(
          "IndexedDB unavailable"
        );
      }

      await memoryStore.saveSnapshot(
        [],
        (await memoryStore.loadSettings()) ??
          {
            model:
              "LFM2.5-350M-Instruct-q4f16_1-MLC",
            webSearch: false,
            safetyMode: "strict",
            memoryEnabled: true,
            autoRecover: true
          }
      );

      health = {
        ...health,
        storage: "ready"
      };
    } catch {
      health = {
        ...health,
        storage: "degraded",
        safeMode: true,
        lastRecoveryAt: Date.now()
      };
    }

    onHealth(health);

    timer = window.setTimeout(
      tick,
      30_000
    );
  };

  void tick();

  return () =>
    window.clearTimeout(timer);
}