"use client";

import { useEffect, useRef, useState } from "react";

type RecognitionEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type Recognition = { start: () => void; stop: () => void; onresult: ((event: RecognitionEvent) => void) | null; onend: (() => void) | null };

export default function Composer({ onSend, onStop, busy, webSearch, onToggleResearch }: { onSend: (value: string) => void; onStop: () => void; busy: boolean; webSearch: boolean; onToggleResearch: () => void }) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);
  const autoSize = () => { const element = inputRef.current; if (!element) return; element.style.height = "0px"; element.style.height = `${Math.min(element.scrollHeight, 190)}px`; };
  const send = () => { const text = value.trim(); if (!text || busy) return; onSend(text); setValue(""); requestAnimationFrame(autoSize); };
  const voice = () => {
    const RecognitionConstructor = (window as Window & { SpeechRecognition?: new () => Recognition }).SpeechRecognition;
    if (!RecognitionConstructor) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const recognition = new RecognitionConstructor();
    recognition.onresult = (event) => setValue((current) => `${current}${current ? " " : ""}${event.results[0][0].transcript}`);
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return <div className="composer-wrap"><div className="composer" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) setValue((current) => `${current}${current ? "\n" : ""}[Attached: ${file.name}]`); }}>
    <textarea ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); autoSize(); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Message Ambi…" aria-label="Message Ambi" rows={1} disabled={busy} />
    <div className="composer-row"><div className="composer-actions"><button className={`tool-btn ${webSearch ? "active" : ""}`} onClick={onToggleResearch} type="button" aria-pressed={webSearch}>⌁ Research</button><label className="tool-btn">＋ File<input type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) setValue((current) => `${current}${current ? "\n" : ""}[Attached: ${file.name}]`); }} /></label><button className={`tool-btn ${listening ? "active" : ""}`} onClick={voice} type="button" aria-pressed={listening}>{listening ? "◉ Listening" : "◉ Voice"}</button></div><span className="composer-hint">{webSearch ? "External research enabled" : "Local-first"} · Shift+Enter for a new line</span>{busy ? <button className="send stop" onClick={onStop} type="button">Stop</button> : <button className="send" onClick={send} disabled={!value.trim()} type="button">Send</button>}</div>
  </div></div>;
}
