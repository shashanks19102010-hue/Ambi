import { MODEL_CATALOG } from "@/lib/constants";
import type { CapabilityState } from "@/types/chat";
import { recommendedModel } from "@/lib/ai/capabilities";

export function getRecommendedModel(caps: CapabilityState) {
  const id = recommendedModel(caps);
  return MODEL_CATALOG.find((model) => model.id === id) ?? MODEL_CATALOG[0];
}

export function modelCatalog() {
  return MODEL_CATALOG;
}
