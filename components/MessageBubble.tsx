import type { Message } from "@/types/chat";

export default function MessageBubble({
  message
}: {
  message: Message;
}) {
  const user = message.role === "user";

  return (
    <article className="message">
      <div
        className={`avatar ${
          user ? "user" : ""
        }`}
      >
        {user ? "U" : "A"}
      </div>

      <div className="bubble">
        {message.content ||
          (message.status === "streaming"
            ? "Thinking…"
            : "")}
      </div>
    </article>
  );
}