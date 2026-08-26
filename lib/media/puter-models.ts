export interface MediaModelOption {
  id: string;
  name: string;
  provider: string;
  note: string;
}

/**
 * Conservative catalog of media models explicitly documented by Puter.
 * Keeping only documented IDs reduces provider-model mismatch errors.
 */
export const PUTER_IMAGE_MODELS: readonly MediaModelOption[] = [
  { id: "gpt-image-2", name: "GPT Image 2", provider: "OpenAI", note: "Strong general-purpose image generation." },
  { id: "gpt-image-1.5", name: "GPT Image 1.5", provider: "OpenAI", note: "High-quality image generation and editing." },
  { id: "gpt-image-1", name: "GPT Image 1", provider: "OpenAI", note: "General image generation and editing." },
  { id: "gpt-image-1-mini", name: "GPT Image 1 Mini", provider: "OpenAI", note: "Lighter image generation option." },
  { id: "grok-imagine-image", name: "Grok Imagine", provider: "xAI", note: "Fast creative image generation." },
  { id: "grok-imagine-image-quality", name: "Grok Imagine Quality", provider: "xAI", note: "Higher-quality Grok image generation." },
] as const;

export const PUTER_VIDEO_MODELS: readonly MediaModelOption[] = [
  { id: "sora-2", name: "Sora 2", provider: "OpenAI", note: "High-quality short video generation." },
  { id: "sora-2-pro", name: "Sora 2 Pro", provider: "OpenAI", note: "Higher-end Sora video generation." },
  { id: "veo-2.0-generate-001", name: "Veo 2", provider: "Google", note: "Google video generation model." },
  { id: "veo-3.0-generate-001", name: "Veo 3", provider: "Google", note: "Advanced Google video generation." },
  { id: "veo-3.1-generate-preview", name: "Veo 3.1", provider: "Google", note: "Latest documented Veo preview model." },
] as const;

export const DEFAULT_PUTER_IMAGE_MODEL = PUTER_IMAGE_MODELS[0].id;
export const DEFAULT_PUTER_VIDEO_MODEL = PUTER_VIDEO_MODELS[0].id;

export function normalizeMediaModel(value: string | undefined, kind: "image" | "video") {
  const list = kind === "image" ? PUTER_IMAGE_MODELS : PUTER_VIDEO_MODELS;
  return list.some((item) => item.id === value) ? value! : list[0].id;
}
