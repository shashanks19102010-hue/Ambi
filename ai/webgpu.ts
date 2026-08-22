export interface DeviceCapabilities {
  webgpu: boolean;
  cores: number;
  memoryGb: number | null;
}

export function detectCapabilities(): DeviceCapabilities {
  const nav =
    navigator as Navigator & {
      deviceMemory?: number;
      gpu?: unknown;
    };

  return {
    webgpu: Boolean(nav.gpu),
    cores:
      navigator.hardwareConcurrency ?? 2,
    memoryGb:
      nav.deviceMemory ?? null
  };
}