import type { Conversation, MemoryItem, Message } from "@/types/chat";

export function buildContext(conversation: Conversation, systemPrompt: string, memories: MemoryItem[] = []): Message[] {
  const now = Date.now();
  const activeMemories = memories.filter((memory) => memory.approved && (!memory.expiresAt || memory.expiresAt > now)).slice(-20);
  const memoryText = activeMemories.length ? `\nApproved memory (use only when relevant):\n${activeMemories.map((m) => `- ${m.text}`).join("\n")}` : "";
  const system: Message = { id: "system", role: "system", content: `${systemPrompt}${memoryText}`, createdAt: now };
  const history = conversation.messages.filter((m) => m.role !== "system").slice(-80).map((message) => message.role === "tool" ? ({ ...message, role: "user", content: `[Trusted tool envelope containing untrusted external data]\n${message.content}` } satisfies Message) : message);
  return [system, ...history];
}
