"use client";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) => void;
  onerror: ((event: { error?: string }) => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };

export default function Composer({ onSend, onStop, busy, webSearch, onToggleResearch }: { onSend: (text: string) => void; onStop: () => void; busy: boolean; webSearch: boolean; onToggleResearch: () => void }) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const onImageStart = () => setImageBusy(true);
    const onImageEnd = () => setImageBusy(false);
    window.addEventListener("ambi:image-start", onImageStart);
    window.addEventListener("ambi:image-end", onImageEnd);
    return () => {
      recognitionRef.current?.stop();
      window.removeEventListener("ambi:image-start", onImageStart);
      window.removeEventListener("ambi:image-end", onImageEnd);
    };
  }, []);

  function resize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  function send() {
    const text = value.trim();
    if (!text || busy || imageBusy) return;
    if (imageMode) {
      window.dispatchEvent(new CustomEvent("ambi:generate-image", { detail: { prompt: text } }));
    } else {
      onSend(text);
    }
    setValue("");
    requestAnimationFrame(resize);
  }

  function voice() {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    setVoiceError("");
    if (!Recognition) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      if (text) setValue((v) => `${v}${v ? " " : ""}${text}`);
      requestAnimationFrame(resize);
    };
    recognition.onerror = (event) => {
      setListening(false);
      recognitionRef.current = null;
      setVoiceError(event.error === "not-allowed" ? "Microphone permission was denied." : "Voice input could not start. Try again.");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
      setVoiceError("Voice input could not start. Try again.");
    }
  }

  const disabled = !value.trim() || busy || imageBusy;
  return <div className="composer-wrap"><div className={`composer ${imageMode ? "composer-image-mode" : ""}`}>
    {imageMode && <div className="composer-mode-label"><span className="image-mode-dot"/> Image generation · describe what you want</div>}
    <textarea ref={inputRef} value={value} onChange={(e) => { setValue(e.target.value); setVoiceError(""); requestAnimationFrame(resize); }} onInput={resize} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder={imageMode ? "Describe the image…" : busy ? "Ambi is responding…" : "Message Ambi…"} rows={1} aria-label={imageMode ? "Describe image" : "Message Ambi"} />
    <div className="composer-row"><div className="composer-tools">
      <button className={`tool ${webSearch ? "active" : ""}`} onClick={onToggleResearch} type="button" aria-pressed={webSearch}>⌁ Research</button>
      <button className={`tool ${listening ? "active" : ""}`} onClick={voice} type="button" aria-pressed={listening}>◉ {listening ? "Listening" : "Voice"}</button>
      <button className={`tool ${imageMode ? "active" : ""}`} onClick={() => setImageMode((v) => !v)} type="button" aria-pressed={imageMode}>✦ {imageMode ? "Image mode" : "Create image"}</button>
    </div><span className="hint">{imageMode ? "Image API · OpenAI" : "Groq AI · Shift+Enter for a new line"}</span>{busy ? <button className="send stop" onClick={onStop} type="button">Stop</button> : <button className="send" onClick={send} type="button" disabled={disabled}>{imageMode ? "Generate" : "Send"}</button>}</div>
    {voiceError && <div className="composer-error" role="status">{voiceError}</div>}
  </div></div>;
}
