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
    return part.replace(/`([^`]+)`/g, "<code class=\"inline-code\">$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/^###\s+(.+)$/gm, "<strong class=\"md-heading md-h3\">$1</strong>").replace(/^##\s+(.+)$/gm, "<strong class=\"md-heading md-h2\">$1</strong>").replace(/^#\s+(.+)$/gm, "<strong class=\"md-heading md-h1\">$1</strong>").replace(/(^|\n)(\s*[-*])\s/g, "$1<span class=\"list-marker\">•</span> ").replace(/(^|\n)(\s*\d+\.)\s/g, "$1<span class=\"list-marker\">$2</span> ").replace(/\n/g, "<br />");
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
function safeExternalUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.href : ""; } catch { return ""; } }
function chunkForSpeech(text: string, size = 2600) {
  const chunks: string[] = []; let remaining = text.trim();
  while (remaining.length > size) { let cut = remaining.lastIndexOf(" ", size); if (cut < size * 0.65) cut = size; chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart(); }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export default function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false); const [speaking, setSpeaking] = useState(false);
  const parts = message.content.split(/(```[\s\S]*?```)/g);
  const source = message.source === "cloud" ? "GROQ AI" : message.source === "web" ? "WEB RESEARCH" : message.source === "local" ? "LOCAL" : null;
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { setCopied(false); } }
  function readAloud() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const chunks = chunkForSpeech(message.content);
    if (!chunks.length) return;
    let index = 0; setSpeaking(true);
    const speakNext = () => { if (index >= chunks.length) { setSpeaking(false); return; } const utterance = new SpeechSynthesisUtterance(chunks[index++]); utterance.onend = speakNext; utterance.onerror = () => setSpeaking(false); window.speechSynthesis.speak(utterance); };
    speakNext();
  }

  return <article className={`message ${message.role}`}>
    <div className={`avatar ${message.role}`}>{message.role === "user" ? "You" : "A"}</div>
    <div className="message-body"><div className="meta"><span>{message.role === "user" ? "You" : "Ambi"}</span>{source && <span className="source">{source}</span>}{message.status === "streaming" && <span className="streaming"><span/><span/><span/></span>}</div>
      {message.generation && message.status === "streaming" && <div className="generation-status" role="status" aria-live="polite"><div className="generation-orb"/><div><strong>{message.generation.phase === "preparing" ? "Preparing your " + message.generation.type : message.generation.phase === "creating" ? "Creating your " + message.generation.type : "Finishing your " + message.generation.type}</strong><span>Ambi is generating this directly through the configured media provider…</span></div></div>}
      {message.media?.type === "image" && <div className={`message-media-card ${message.role === "user" ? "attached-image-card" : "generated-image-card"}`}><img src={message.media.dataUrl} alt={message.media.alt} loading="lazy"/><div className="generated-image-actions"><button type="button" onClick={() => void copy(message.media?.type === "image" ? message.media.dataUrl : "")}>{copied ? "Copied" : "Copy"}</button>{message.role === "assistant" && <a href={message.media.dataUrl} download="ambi-image.png">Save image</a>}</div></div>}
      {message.media?.type === "video" && <div className="generated-video-card"><video controls playsInline preload="metadata" src={message.media.url} aria-label={message.media.alt}/><div className="generated-image-actions"><a href={message.media.url} target="_blank" rel="noreferrer">Open video</a></div></div>}
      {parts.map((part, i) => part.startsWith("```") ? <div className="code-wrap" key={i}><pre className="code"><code>{part.replace(/^```[\w-]*\n?/, "").replace(/```$/, "")}</code></pre><button className="code-copy" onClick={() => void copy(part.replace(/^```[\w-]*\n?/, "").replace(/```$/, ""))} type="button">Copy code</button></div> : part.trim() ? <div className={message.role === "user" ? "bubble user-bubble" : "bubble"} key={i}>{renderBlock(part, String(i))}</div> : null)}
      {message.pexels?.length ? <div className="pexels-results"><div className="sources-title">Pexels</div><div className="pexels-grid">{message.pexels.slice(0,12).map((item) => item.type === "photo" ? <a className="pexels-card" href={safeExternalUrl(item.pexelsUrl) || "#"} target="_blank" rel="noreferrer" key={item.id}><img src={item.previewUrl} alt={item.title} loading="lazy"/><div><strong>{item.title}</strong><span>Photo by {item.photographer}</span></div></a> : <a className="pexels-card pexels-video-card" href={item.pexelsUrl} target="_blank" rel="noreferrer" key={item.id}>{item.mediaUrl ? <video muted playsInline preload="metadata" src={item.mediaUrl}/> : <img src={item.previewUrl} alt={item.title} loading="lazy"/>}<div><strong>{item.title}</strong><span>Video by {item.photographer}</span></div></a>)}</div><small className="pexels-attribution">Photos and videos provided by Pexels · Open a card to view the original.</small></div> : null}
      {message.citations?.length ? <div className="sources"><div className="sources-title">Sources</div>{message.citations.slice(0, 6).map((citation, i) => <a className="source-link" key={`${citation.url}-${i}`} href={safeExternalUrl(citation.url) || "#"} target="_blank" rel="noreferrer"><span>[{i + 1}]</span><span>{citation.title}</span></a>)}</div> : null}
      {message.role === "assistant" && message.status !== "streaming" && <div className="message-actions"><button onClick={() => void copy(message.content)} type="button">{copied ? "Copied" : "Copy"}</button><button onClick={readAloud} type="button">{speaking ? "Stop voice" : "Read aloud"}</button><button onClick={() => { if (typeof navigator !== "undefined" && "share" in navigator && navigator.share) void navigator.share({ text: message.content }).catch(() => undefined); }} type="button">Share</button></div>}
    </div>
  </article>;
}
