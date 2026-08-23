export type DeviceClass =
  | "Basic"
  | "Standard"
  | "Powerful"
  | "High Performance";

export interface DeviceCapabilities {
  webgpu: boolean;
  wasm: boolean;
  cores: number;
  memoryGB: number | null;
  storage: boolean;
  device: DeviceClass;
}

export function detectCapabilities(): DeviceCapabilities {
  const nav =
    typeof navigator !== "undefined" ? navigator : undefined;

  const cores = nav?.hardwareConcurrency ?? 4;
  const memoryGB =
    (nav as Navigator & { deviceMemory?: number })?.deviceMemory ??
    null;

  const webgpu = !!(nav && "gpu" in nav);
  const wasm = typeof WebAssembly !== "undefined";
  const storage = typeof indexedDB !== "undefined";

  let device: DeviceClass = "Standard";

  if ((memoryGB ?? 2) <= 2 || cores <= 2) {
    device = "Basic";
  } else if ((memoryGB ?? 4) >= 8 && cores >= 8) {
    device = "High Performance";
  } else if ((memoryGB ?? 4) >= 6 && cores >= 6) {
    device = "Powerful";
  }

  return {
    webgpu,
    wasm,
    cores,
    memoryGB,
    storage,
    device,
  };
}
