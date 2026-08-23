import type { MemoryItem } from "@/types/chat";
import { uid } from "@/lib/id";
import { memoryStore } from "@/lib/memory/store";

export async function addMemory(text: string, kind: MemoryItem["kind"], sourceConversationId?: string, temporary = false) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Memory text cannot be empty.");
  const item: MemoryItem = { id: uid("mem"), kind, text: trimmed, createdAt: Date.now(), updatedAt: Date.now(), sourceConversationId, expiresAt: temporary ? Date.now() + 24 * 60 * 60 * 1000 : undefined, approved: true };
  const memories = await memoryStore.loadMemories();
  memories.push(item);
  await memoryStore.saveMemories(memories.slice(-200));
  return item;
}

export async function updateMemory(id: string, text: string, kind?: MemoryItem["kind"]) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Memory text cannot be empty.");
  const memories = await memoryStore.loadMemories();
  const existing = memories.find((memory) => memory.id === id);
  if (!existing) return null;
  const updated: MemoryItem = { ...existing, text: trimmed, kind: kind ?? existing.kind, updatedAt: Date.now() };
  await memoryStore.saveMemories(memories.map((memory) => memory.id === id ? updated : memory));
  return updated;
}

export async function forgetMemory(id: string) {
  await memoryStore.saveMemories((await memoryStore.loadMemories()).filter((memory) => memory.id !== id));
}

export async function clearMemories() {
  await memoryStore.saveMemories([]);
}
