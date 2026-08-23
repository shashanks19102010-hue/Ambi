import type { MemoryItem } from "@/types/chat";
import { uid } from "@/lib/id";
import { memoryStore } from "@/lib/memory/store";

export async function addMemory(text: string, kind: MemoryItem["kind"], sourceConversationId?: string, temporary = false) {
  const item: MemoryItem = { id: uid("mem"), kind, text: text.trim(), createdAt: Date.now(), updatedAt: Date.now(), sourceConversationId, expiresAt: temporary ? Date.now() + 24 * 60 * 60 * 1000 : undefined, approved: true };
  const memories = await memoryStore.loadMemories();
  memories.push(item);
  await memoryStore.saveMemories(memories.slice(-200));
  return item;
}

export async function forgetMemory(id: string) {
  await memoryStore.saveMemories((await memoryStore.loadMemories()).filter((memory) => memory.id !== id));
}
