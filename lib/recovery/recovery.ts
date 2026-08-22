import { memoryStore } from "@/lib/memory/store";

export async function recoverState() {
  try {
    const snapshot =
      await memoryStore.loadSnapshot();

    if (!snapshot) {
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
}