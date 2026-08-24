"use client";

import { useState, type ReactNode } from "react";
import type { Message } from "@/types/chat";

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
function renderMath(source: string) {
  let value = escapeHtml(source.trim());
  value = value.replace(/\\text\{([^{}]*)\}/g, "$1").replace(/\\(?:left|right)/g, "").replace(/\\xrightarrow\{([^{}]*)\}/g, "<span class=\"math-arrow\">$1 →</span>").replace(/\\(?:longrightarrow|rightarrow|to)/g, "→").replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\\pm/g, "±").replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "<span class=\"fraction\"><span>$1</span><span>$2</span></span>").replace(/([A-Za-z0-9)])_\{([^{}]+)\}/g, "$1<sub>$2</sub>").replace(/([A-Za-z0-9)]+)_([A-Za-z0-9]+)/g, "$1<sub>$2</sub>").replace(/([A-Za-z0-9)]+)\^\{([^{}]+)\}/g, "$1<sup>$2</sup>").replace(/([A-Za-z0-9)]+)\^([A-Za-z0-9]+)/g, "$1<sup>$2</sup>").replace(/[{}]/g, "");
  return `<span class="math-block">${value}</span>`;
}
function renderRichText(source: string) {
  const escaped = escapeHtml(source); const parts = escaped.split(/(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\))/g);
  return parts.map((part) => {
    if (part.startsWith("\\[") && part.endsWith("\\]")) return renderMath(part.slice(2, -2));
    if (part.startsWith("$$") && part.endsWith("$$")) return renderMath(part.slice(2, -2));
    if (part.startsWith("\\(") && part.endsWith("\\)")) return `<span class="math-inline">${renderMath(part.slice(2, -2))}</span>`;
    let html = part.replace(/`([^`]+)`/g, "<code class=\"inline-code\">$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/^###\s+(.+)$/gm, "<strong class=\"md-heading md-h3\">$1</strong>").replace(/^##\s+(.+)$/gm, "<strong class=\"md-heading md-h2\">$1</strong>").replace(/^#\s+(.+)$/gm, "<strong class=\"md-heading md-h1\">$1</strong>").replace(/(^|\n)(\s*[-*])\s/g, "$1<span class=\"list-marker\">•</span> ").replace(/(^|\n)(\s*\d+\.)\s/g, "$1<span class=\"list-marker\">$2</span> ").replace(/\n/g, "<br />");
    return html;
  }).join("");
}
function isTableSeparator(line: string) { const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, ""); const cells = trimmed.split("|").map((cell) => cell.trim()); return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)); }
function splitTableRow(line: string) { const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, ""); return trimmed.split("|").map((cell) => cell.trim()); }
function renderBlock(block: string, keyPrefix: string) {
  const lines = block.replace(/^\n+|\n+$/g, "").split("\n"); const nodes: ReactNode[] = []; let normalLines: string[] = [];
  const flushNormal = () => { if (!normalLines.length) return; nodes.push(<span key={`${keyPrefix}-text-${nodes.length}`} dangerouslySetInnerHTML={{ __html: renderRichText(normalLines.join("\n")) }} />); normalLines = []; };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (i + 1 < lines.length && line.includes("|") && isTableSeparator(lines[i + 1])) {
      flushNormal(); const headers = splitTableRow(line); const rows: string[][] = []; let j = i + 2;
      while (j < lines.length && lines[j].trim() && lines[j].includes("|")) { rows.push(splitTableRow(lines[j])); j += 1; }
      nodes.push(<div className="table-scroll" key={`${keyPrefix}-table-${nodes.length}`}><table className="markdown-table"><thead><tr>{headers.map((header, index) => <th key={index} dangerouslySetInnerHTML={{ __html: renderRichText(header) }} />)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, colIndex) => <td key={colIndex} dangerouslySetInnerHTML={{ __html: renderRichText(row[colIndex] ?? "") }} />)}</tr>)}</tbody></table></div>); i = j - 1; continue;
    }
    normalLines.push(line);
  }
  flushNormal(); return nodes;
}

export default function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false); const [speaking, setSpeaking] = useState(false);
  const parts = message.content.split(/(```[\s\S]*?```)/g);
  const source = message.source === "cloud" ? "GROQ AI" : message.source === "web" ? "WEB RESEARCH" : message.source === "local" ? "LOCAL" : null;
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { setCopied(false); } }
  async function readAloud() {
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return; }
    try {
      const response = await fetch("/api/audio/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: message.content }), cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { dataUrl?: string; error?: string };
      if (!response.ok || !payload.dataUrl) throw new Error(payload.error || "Speech generation is unavailable.");
      const audio = new Audio(payload.dataUrl); setSpeaking(true); audio.onended = () => setSpeaking(false); audio.onerror = () => setSpeaking(false); await audio.play();
    } catch {
      if ("speechSynthesis" in window) { const utterance = new SpeechSynthesisUtterance(message.content); utterance.onend = () => setSpeaking(false); setSpeaking(true); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); } else setSpeaking(false);
    }
  }

  return <article className={`message ${message.role}`}>
    <div className={`avatar ${message.role}`}>{message.role === "user" ? "You" : "A"}</div>
    <div className="message-body"><div className="meta"><span>{message.role === "user" ? "You" : "Ambi"}</span>{source && <span className="source">{source}</span>}{message.status === "streaming" && !message.generation && <span className="streaming"><span/><span/><span/></span>}</div>
      {message.generation?.type === "image" && message.status === "streaming" && <div className="image-generation-card"><div className="image-generation-art"><div className="generation-orb"/><div className="generation-grid"/></div><div><strong>{message.generation.phase === "preparing" ? "Preparing image" : message.generation.phase === "creating" ? "Creating image" : "Finishing image"}</strong><span>{message.generation.phase === "preparing" ? "Turning your request into a visual prompt…" : message.generation.phase === "creating" ? "Generating the artwork…" : "Almost ready…"}</span></div></div>}
      {message.media?.type === "image" && <div className="generated-image-card"><img src={message.media.dataUrl} alt={message.media.alt} loading="lazy"/><div className="generated-image-actions"><button type="button" onClick={() => void copy(message.media?.type === "image" ? message.media.dataUrl : "")}>{copied ? "Copied" : "Copy"}</button><a href={message.media.dataUrl} download="ambi-image.png">Save image</a></div></div>}
      {message.media?.type === "video" && <div className="generated-video-card"><video controls playsInline preload="metadata" src={message.media.url} aria-label={message.media.alt}/><div className="generated-image-actions"><a href={message.media.url} target="_blank" rel="noreferrer">Open video</a></div></div>}
      {parts.map((part, i) => part.startsWith("```") ? <div className="code-wrap" key={i}><pre className="code"><code>{part.replace(/^```[\w-]*\n?/, "").replace(/```$/, "")}</code></pre><button className="code-copy" onClick={() => void copy(part.replace(/^```[\w-]*\n?/, "").replace(/```$/, ""))} type="button">Copy code</button></div> : part.trim() ? <div className={message.role === "user" ? "bubble user-bubble" : "bubble"} key={i}>{renderBlock(part, String(i))}</div> : null)}
      {message.citations?.length ? <div className="sources"><div className="sources-title">Sources</div>{message.citations.slice(0, 6).map((citation, i) => <a className="source-link" key={`${citation.url}-${i}`} href={citation.url} target="_blank" rel="noreferrer"><span>[{i + 1}]</span><span>{citation.title}</span></a>)}</div> : null}
      {message.role === "assistant" && message.status !== "streaming" && !message.media && <div className="message-actions"><button onClick={() => void copy(message.content)} type="button">{copied ? "Copied" : "Copy"}</button><button onClick={() => void readAloud()} type="button">{speaking ? "Stop voice" : "Read aloud"}</button><button onClick={() => { if (typeof navigator !== "undefined" && "share" in navigator && navigator.share) void navigator.share({ text: message.content }).catch(() => undefined); }} type="button">Share</button></div>}
    </div>
  </article>;
}
