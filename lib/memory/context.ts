import type {
  Conversation,
  Message
} from "@/types/chat";

const MAX_CONTEXT_MESSAGES = 24;

const MAX_CONTEXT_CHARS = 28000;

export function buildContext(
  conversation: Conversation,
  systemPrompt: string
): Message[] {
  const selected: Message[] = [
    {
      id: "system",
      role: "system",
      content: systemPrompt,
      createdAt: 0
    }
  ];

  let chars =
    systemPrompt.length;

  for (const message of [
    ...conversation.messages
  ].reverse()) {
    const next =
      chars + message.content.length;

    if (
      selected.length >=
        MAX_CONTEXT_MESSAGES + 1 ||
      next > MAX_CONTEXT_CHARS
    ) {
      break;
    }

    selected.push(message);

    chars = next;
  }

  return selected
    .slice(0, 1)
    .concat(
      selected.slice(1).reverse()
    );
}