import type { Message } from "@/types/chat";

export default function MessageBubble({ message }: { message: Message }) {
  const parts = message.content.split(/(```[\s\S]*?```)/g);
  const source = message.source === "cloud" ? "GROQ AI" : message.source === "web" ? "WEB RESEARCH" : message.source === "local" ? "LOCAL" : null;
  return <article className={`message ${message.role}`}>
    <div className={`avatar ${message.role}`}>{message.role === "user" ? "You" : "A"}</div>
    <div><div className="meta"><span>{message.role === "user" ? "You" : "Ambi"}</span>{source && <span className="source">{source}</span>}{message.status === "streaming" && <span className="streaming"><span/><span/><span/></span>}</div>
      <div className={message.role === "user" ? "bubble user-bubble" : "bubble"}>{parts.map((part, i) => part.startsWith("```") ? <pre className="code" key={i}><code>{part.replace(/^```[\w-]*\n?/, "").replace(/```$/, "")}</code></pre> : <span key={i}>{part}</span>)}</div>
      {message.citations?.length ? <div className="sources"><div className="sources-title">Sources</div>{message.citations.slice(0, 6).map((citation, i) => <a className="source-link" key={`${citation.url}-${i}`} href={citation.url} target="_blank" rel="noreferrer"><span>[{i + 1}]</span><span>{citation.title}</span></a>)}</div> : null}
      {message.role === "assistant" && <div className="message-actions"><button onClick={() => void navigator.clipboard?.writeText(message.content)}>Copy</button><button onClick={() => { if (typeof navigator !== "undefined" && "share" in navigator) void navigator.share?.({ text: message.content }); }}>Share</button></div>}
    </div>
  </article>;
}
