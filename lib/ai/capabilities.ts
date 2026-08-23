import type { CapabilityState } from "@/types/chat";
import { MODEL_CATALOG } from "@/lib/constants";

export function detectCapabilities(): CapabilityState {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const cores = nav?.hardwareConcurrency ?? 4;
  const memoryGb = (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory ?? null;
  const webgpu = !!(nav && "gpu" in nav);
  const wasm = typeof WebAssembly !== "undefined";
  const storageGb = null;
  const online = nav?.onLine ?? true;

  let tier: CapabilityState["tier"] = "Standard";
  if ((memoryGb ?? 2) <= 2 || cores <= 2) tier = "Basic";
  else if ((memoryGb ?? 4) >= 8 && cores >= 8) tier = "High Performance";
  else if ((memoryGb ?? 4) >= 6 && cores >= 6) tier = "Powerful";

  return { webgpu, wasm, cores, memoryGb, storageGb, tier, online };
}

export function recommendedModel(capabilities: CapabilityState): string {
  const candidates = MODEL_CATALOG;
  if (capabilities.tier === "High Performance") return candidates[2]?.id ?? candidates[0].id;
  if (capabilities.tier === "Powerful") return candidates[2]?.id ?? candidates[0].id;
  if (capabilities.tier === "Standard") return candidates[1]?.id ?? candidates[0].id;
  return candidates[0].id;
}
