export interface MediaModelOption {
  id: string;
  name: string;
  provider: string;
  note: string;
}

/**
 * Curated models documented by Puter for the current client APIs.
 * Keep this list conservative so the UI only offers known model IDs.
 */
export const PUTER_IMAGE_MODELS: readonly MediaModelOption[] = [
  { id: "openai/gpt-image-2", name: "GPT Image 2", provider: "OpenAI", note: "Strong general-purpose image generation." },
  { id: "google/gemini-3.1-flash-image-preview", name: "Gemini 3.1 Flash Image", provider: "Google", note: "Fast image generation and editing." },
  { id: "google/gemini-3-pro-image-preview", name: "Gemini 3 Pro Image", provider: "Google", note: "High-quality image creation and editing." },
  { id: "x-ai/grok-imagine-image", name: "Grok Imagine", provider: "xAI", note: "Fast creative image generation." },
  { id: "x-ai/grok-imagine-image-quality", name: "Grok Imagine Quality", provider: "xAI", note: "Higher-quality Grok image generation." },
  { id: "qwen/qwen-image-2.0", name: "Qwen Image 2.0", provider: "Qwen", note: "Flexible general image generation." },
  { id: "qwen/qwen-image-2.0-pro", name: "Qwen Image 2.0 Pro", provider: "Qwen", note: "Higher quality Qwen image generation." },
  { id: "bytedance-seed/seedream-4.0", name: "Seedream 4.0", provider: "ByteDance", note: "Detailed creative and photorealistic images." },
  { id: "google/imagen-4.0", name: "Imagen 4", provider: "Google", note: "High-quality text-to-image generation." },
  { id: "google/imagen-4.0-fast", name: "Imagen 4 Fast", provider: "Google", note: "Faster Imagen generation." },
  { id: "ideogram/ideogram-3.0", name: "Ideogram 3", provider: "Ideogram", note: "Strong typography and design-oriented images." },
  { id: "black-forest-labs/flux-2-pro", name: "FLUX.2 Pro", provider: "Black Forest Labs", note: "Premium FLUX generation." },
] as const;

export const PUTER_VIDEO_MODELS: readonly MediaModelOption[] = [
  { id: "sora-2", name: "Sora 2", provider: "OpenAI", note: "High-quality text-to-video clips." },
  { id: "sora-2-pro", name: "Sora 2 Pro", provider: "OpenAI", note: "Higher-end Sora video generation." },
  { id: "veo-3.1-generate-preview", name: "Veo 3.1", provider: "Google", note: "High-quality video generation with advanced controls." },
  { id: "veo-3.1-fast-generate-preview", name: "Veo 3.1 Fast", provider: "Google", note: "Faster Veo generation." },
  { id: "veo-3.1-lite-generate-preview", name: "Veo 3.1 Lite", provider: "Google", note: "Lighter Veo option for faster jobs." },
  { id: "vidu/vidu-q1", name: "Vidu Q1", provider: "Vidu", note: "Cinematic clips with integrated audio support." },
  { id: "vidu/vidu-2.0", name: "Vidu 2.0", provider: "Vidu", note: "Fast text/image-to-video generation." },
  { id: "pixverse/pixverse-v5", name: "PixVerse V5", provider: "PixVerse", note: "Cinematic text/image-to-video generation." },
  { id: "wan-ai/wan2.7-t2v", name: "Wan 2.7", provider: "Wan AI", note: "Flexible cinematic text-to-video generation." },
  { id: "wan-ai/wan2.2-t2v-a14b", name: "Wan 2.2 T2V 14B", provider: "Wan AI", note: "Open video generation with strong prompt control." },
] as const;

export const DEFAULT_PUTER_IMAGE_MODEL = PUTER_IMAGE_MODELS[0].id;
export const DEFAULT_PUTER_VIDEO_MODEL = PUTER_VIDEO_MODELS[0].id;

export function normalizeMediaModel(value: string | undefined, kind: "image" | "video") {
  const list = kind === "image" ? PUTER_IMAGE_MODELS : PUTER_VIDEO_MODELS;
  return list.some((item) => item.id === value) ? value! : list[0].id;
}
