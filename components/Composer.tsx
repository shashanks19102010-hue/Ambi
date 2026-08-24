"use client";
import { useEffect, useRef, useState } from "react";

export default function Composer({ onSend, onStop, busy, webSearch, onToggleResearch }: { onSend: (text: string) => void; onStop: () => void; busy: boolean; webSearch: boolean; onToggleResearch: () => void }) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  useEffect(() => () => recognitionRef.current?.stop(), []);
  function resize() { const el = inputRef.current; if (!el) return; el.style.height = "0px"; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; }
  function send() { const text = value.trim(); if (!text || busy) return; onSend(text); setValue(""); requestAnimationFrame(resize); }
  function voice() {
    const Recognition = (window as Window & { SpeechRecognition?: new () => { start: () => void; stop: () => void; onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null; onend: (() => void) | null } }).SpeechRecognition;
    if (!Recognition) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const recognition = new Recognition();
    recognition.onresult = (event) => { const text = event.results[0]?.[0]?.transcript ?? ""; if (text) setValue((v) => `${v}${v ? " " : ""}${text}`); requestAnimationFrame(resize); };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition; setListening(true); recognition.start();
  }
  return <div className="composer-wrap"><div className="composer">
    <textarea ref={inputRef} value={value} onChange={(e) => { setValue(e.target.value); requestAnimationFrame(resize); }} onInput={resize} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder={busy ? "Ambi is responding…" : "Message Ambi…"} rows={1} aria-label="Message Ambi" />
    <div className="composer-row"><div className="composer-tools">
      <button className={`tool ${webSearch ? "active" : ""}`} onClick={onToggleResearch} type="button">⌁ Research</button>
      <button className={`tool ${listening ? "active" : ""}`} onClick={voice} type="button">◉ {listening ? "Listening" : "Voice"}</button>
    </div><span className="hint">Groq AI · Shift+Enter for a new line</span>{busy ? <button className="send stop" onClick={onStop} type="button">Stop</button> : <button className="send" onClick={send} type="button" disabled={!value.trim()}>Send</button>}</div>
  </div></div>;
}
