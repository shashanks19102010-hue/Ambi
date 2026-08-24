"use client";

import { useState } from "react";
import type { Message } from "@/types/chat";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function renderMath(source: string) {
  let value = escapeHtml(source.trim());
  value = value.replace(/\\text\{([^{}]*)\}/g, "$1");
  value = value.replace(/\\(?:left|right)/g, "");
  value = value.replace(/\\xrightarrow\{([^{}]*)\}/g, "<span class=\"math-arrow\">$1 →</span>");
  value = value.replace(/\\(?:longrightarrow|rightarrow)/g, "→");
  value = value.replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\\pm/g, "±");
  value = value.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "<span class=\"fraction\"><span>$1</span><span>$2</span></span>");
  value = value.replace(/([A-Za-z0-9)])_\{([^{}]+)\}/g, "$1<sub>$2</sub>");
  value = value.replace(/([A-Za-z0-9)]+)_([A-Za-z0-9]+)/g, "$1<sub>$2</sub>");
  value = value.replace(/([A-Za-z0-9)]+)\^\{([^{}]+)\}/g, "$1<sup>$2</sup>");
  value = value.replace(/([A-Za-z0-9)]+)\^([A-Za-z0-9]+)/g, "$1<sup>$2</sup>");
  value = value.replace(/[{}]/g, "");
  return `<span class=\"math-block\">${value}</span>`;
}

function renderRichText(source: string) {
  const escaped = escapeHtml(source);
  const parts = escaped.split(/(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\))/g);
  return parts.map((part) => {
    if (part.startsWith("\\[") && part.endsWith("\\]")) return renderMath(part.slice(2, -2));
    if (part.startsWith("$$") && part.endsWith("$$")) return renderMath(part.slice(2, -2));
    if (part.startsWith("\\(") && part.endsWith("\\)")) return `<span class=\"math-inline\">${renderMath(part.slice(2, -2))}</span>`;
    let html = part.replace(/`([^`]+)`/g, "<code class=\"inline-code\">$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/(^|\n)(\s*\d+\.)\s/g, "$1<span class=\"list-marker\">$2</span> ");
    html = html.replace(/\n/g, "<br />");
    return html;
  }).join("");
}

export default function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const parts = message.content.split(/(```[\s\S]*?```)/g);
  const source = message.source === "cloud" ? "GROQ AI" : message.source === "web" ? "WEB RESEARCH" : message.source === "local" ? "LOCAL" : null;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return <article className={`message ${message.role}`}>
    <div className={`avatar ${message.role}`}>{message.role === "user" ? "You" : "A"}</div>
    <div><div className="meta"><span>{message.role === "user" ? "You" : "Ambi"}</span>{source && <span className="source">{source}</span>}{message.status === "streaming" && <span className="streaming"><span/><span/><span/></span>}</div>
      <div className={message.role === "user" ? "bubble user-bubble" : "bubble"}>{parts.map((part, i) => part.startsWith("```") ? <div className="code-wrap" key={i}><pre className="code"><code>{part.replace(/^```[\w-]*\n?/, "").replace(/```$/, "")}</code></pre><button className="code-copy" onClick={() => void copy(part.replace(/^```[\w-]*\n?/, "").replace(/```$/, ""))} type="button">Copy code</button></div> : <span key={i} dangerouslySetInnerHTML={{ __html: renderRichText(part) }} />)}</div>
      {message.citations?.length ? <div className="sources"><div className="sources-title">Sources</div>{message.citations.slice(0, 6).map((citation, i) => <a className="source-link" key={`${citation.url}-${i}`} href={citation.url} target="_blank" rel="noreferrer"><span>[{i + 1}]</span><span>{citation.title}</span></a>)}</div> : null}
      {message.role === "assistant" && <div className="message-actions"><button onClick={() => void copy(message.content)} type="button">{copied ? "Copied" : "Copy"}</button><button onClick={() => { if (typeof navigator !== "undefined" && "share" in navigator && navigator.share) void navigator.share({ text: message.content }).catch(() => undefined); }} type="button">Share</button></div>}
    </div>
  </article>;
}
