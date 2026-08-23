import type { CapabilityState } from "@/types/chat";

export function detectCapabilities(): CapabilityState {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const cores = nav?.hardwareConcurrency ?? 2;
  const memoryGb = typeof (nav as Navigator & { deviceMemory?: number })?.deviceMemory === "number" ? (nav as Navigator & { deviceMemory?: number }).deviceMemory! : null;
  const webgpu = Boolean(nav && "gpu" in nav);
  const wasm = typeof WebAssembly !== "undefined";
  const tier: CapabilityState["tier"] = cores >= 12 && (memoryGb ?? 0) >= 16 ? "High Performance" : cores >= 8 && (memoryGb ?? 0) >= 8 ? "Powerful" : cores >= 4 ? "Standard" : "Basic";
  return { webgpu, wasm, cores, memoryGb, storageGb: null, tier, online: nav?.onLine ?? true };
}

export function recommendedModel(caps: CapabilityState) {
  if (caps.tier === "High Performance") return "Llama-3.2-3B-Instruct-q4f16_1-MLC";
  if (caps.tier === "Powerful") return "Llama-3.2-1B-Instruct-q4f32_1-MLC";
  return "LFM2.5-350M-Instruct-q4f16_1-MLC";
}
