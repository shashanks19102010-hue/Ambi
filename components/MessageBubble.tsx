import type { Message } from "@/types/chat";

export default function MessageBubble({ message }: { message: Message }) {
  const renderContent = (content: string) => content.split(/(```[\s\S]*?```)/g).map((part, index) => part.startsWith("```")
    ? <pre className="code-block" key={index}><code>{part.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/```$/, "")}</code></pre>
    : <span key={index}>{part}</span>);

  const sourceLabel = message.source === "cloud"
    ? "CLOUD AI"
    : message.source === "web"
      ? "WEB RESEARCH"
      : null;

  return (
    <article className={`message ${message.role}`}>
      <div className={`avatar ${message.role}`}>{message.role === "user" ? "You" : "A"}</div>
      <div className="message-body">
        <div className="message-meta">
          <span>{message.role === "user" ? "You" : "Ambi"}</span>
          {sourceLabel && <span className="source-badge">{sourceLabel}</span>}
          {message.status === "streaming" && <span className="typing">● ● ●</span>}
        </div>
        <div className="bubble">{renderContent(message.content)}</div>
        {message.citations?.length ? (
          <div className="citations">
            <div className="citations-title">Sources</div>
            {message.citations.slice(0, 6).map((citation, index) => (
              <a key={`${citation.url}-${index}`} href={citation.url} target="_blank" rel="noreferrer" className="citation">
                <span>[{index + 1}]</span><span>{citation.title}</span>
              </a>
            ))}
          </div>
        ) : null}
        {message.role === "assistant" && (
          <div className="message-actions">
            <button onClick={() => void navigator.clipboard?.writeText(message.content)}>Copy</button>
            <button onClick={() => void navigator.share?.({ text: message.content })}>Share</button>
          </div>
        )}
      </div>
    </article>
  );
}
