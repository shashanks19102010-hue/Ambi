"use client";

import { useEffect, useRef, useState } from "react";

type RecognitionEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type Recognition = { start: () => void; stop: () => void; onresult: ((event: RecognitionEvent) => void) | null; onend: (() => void) | null };

export default function Composer({ onSend, onStop, busy, webSearch, onToggleResearch }: { onSend: (value: string) => void; onStop: () => void; busy: boolean; webSearch: boolean; onToggleResearch: () => void }) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const autoSize = () => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 190)}px`;
  };

  const send = () => {
    const text = value.trim();
    if (!text || composing) return;
    onSend(text);
    setValue("");
    setSelectedFileName(null);
    requestAnimationFrame(autoSize);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const voice = () => {
    const RecognitionConstructor = (window as Window & { SpeechRecognition?: new () => Recognition }).SpeechRecognition;
    if (!RecognitionConstructor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new RecognitionConstructor();
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) setValue((current) => `${current}${current ? " " : ""}${transcript}`);
      requestAnimationFrame(autoSize);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const attachFile = (file: File | undefined) => {
    if (!file) return;
    setSelectedFileName(file.name);
    setValue((current) => {
      const attachment = `[Attached file: ${file.name}]`;
      return current.includes(attachment) ? current : `${current}${current ? "\n" : ""}${attachment}`;
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return <div className="composer-wrap">
    <div className={`composer ${busy ? "composer-busy" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); attachFile(event.dataTransfer.files[0]); }}>
      {selectedFileName ? <div className="attachment-chip" role="status"><span aria-hidden="true">📎</span><span>{selectedFileName}</span><button type="button" onClick={() => { setValue((current) => current.replace(`\n[Attached file: ${selectedFileName}]`, "").replace(`[Attached file: ${selectedFileName}]`, "").trimStart()); setSelectedFileName(null); requestAnimationFrame(autoSize); }} aria-label="Remove attachment">×</button></div> : null}
      <textarea ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); requestAnimationFrame(autoSize); }} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !composing && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} onInput={autoSize} placeholder={busy ? "Type while Ambi is responding…" : "Message Ambi…"} aria-label="Message Ambi" aria-busy={busy} rows={1} spellCheck autoComplete="off" autoCorrect="on" enterKeyHint="send" />
      <div className="composer-row">
        <div className="composer-actions">
          <button className={`tool-btn ${webSearch ? "active" : ""}`} onClick={onToggleResearch} type="button" aria-pressed={webSearch}>⌁ Research</button>
          <label className="tool-btn">＋ File<input type="file" hidden onChange={(event) => { attachFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          <button className={`tool-btn ${listening ? "active" : ""}`} onClick={voice} type="button" aria-pressed={listening}>{listening ? "◉ Listening" : "◉ Voice"}</button>
        </div>
        <span className="composer-hint">{busy ? "Ambi is responding · you can keep typing" : webSearch ? "External research enabled" : "Secure Groq AI"} · Shift+Enter for a new line</span>
        {busy ? <button className="send stop" onClick={onStop} type="button" aria-label="Stop generating">Stop</button> : <button className="send" onClick={send} disabled={!value.trim()} type="button" aria-label="Send message">Send</button>}
      </div>
    </div>
  </div>;
}
