import type { Conversation, MemoryItem, Message } from "@/types/chat";

const MAX_HISTORY_MESSAGES = 48;
const MAX_HISTORY_CHARS = 48_000;
const MAX_MESSAGE_CHARS = 6_000;
const MAX_TOOL_CHARS = 4_000;
const MAX_MEMORY_CHARS = 6_000;

function clamp(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max)}\n[context truncated]`;
}

export function buildContext(conversation: Conversation, systemPrompt: string, memories: MemoryItem[] = []): Message[] {
  const now = Date.now();
  const activeMemories = memories.filter((memory) => memory.approved && (!memory.expiresAt || memory.expiresAt > now)).slice(-20);
  const memoryText = activeMemories.length
    ? `\nApproved memory (use only when relevant):\n${clamp(activeMemories.map((m) => `- ${m.text}`).join("\n"), MAX_MEMORY_CHARS)}`
    : "";
  const system: Message = { id: "system", role: "system", content: clamp(`${systemPrompt}${memoryText}`, 8_000), createdAt: now };
  const source = conversation.messages.filter((m) => m.role !== "system").slice(-MAX_HISTORY_MESSAGES);
  const history: Message[] = [];
  let totalChars = 0;

  for (let index = source.length - 1; index >= 0; index -= 1) {
    const message = source[index];
    const converted = message.role === "tool"
      ? { ...message, role: "user", content: `[Trusted tool envelope containing untrusted external data]\n${clamp(message.content, MAX_TOOL_CHARS)}` } satisfies Message
      : { ...message, content: clamp(message.content, MAX_MESSAGE_CHARS) } satisfies Message;
    const nextSize = totalChars + converted.content.length;
    if (history.length > 0 && nextSize > MAX_HISTORY_CHARS) break;
    history.unshift(converted);
    totalChars = nextSize;
  }

  return [system, ...history];
}
