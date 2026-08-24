"use client";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error?: string }) => void) | null };
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };

type MediaMode = "chat" | "image" | "video";

export default function Composer({ onSend, onStop, busy, webSearch, onToggleResearch }: { onSend: (text: string, imageDataUrl?: string) => void; onStop: () => void; busy: boolean; webSearch: boolean; onToggleResearch: () => void }) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [mediaMode, setMediaMode] = useState<MediaMode>("chat");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const start = () => setMediaBusy(true);
    const end = () => setMediaBusy(false);
    window.addEventListener("ambi:image-start", start); window.addEventListener("ambi:image-end", end);
    window.addEventListener("ambi:video-start", start); window.addEventListener("ambi:video-end", end);
    return () => { recognitionRef.current?.stop(); window.removeEventListener("ambi:image-start", start); window.removeEventListener("ambi:image-end", end); window.removeEventListener("ambi:video-start", start); window.removeEventListener("ambi:video-end", end); };
  }, []);

  function resize() { const el = inputRef.current; if (!el) return; el.style.height = "0px"; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; }

  function submit() {
    const text = value.trim();
    if (!text || busy || mediaBusy) return;
    if (mediaMode === "image") window.dispatchEvent(new CustomEvent("ambi:generate-image", { detail: { prompt: text } }));
    else if (mediaMode === "video") window.dispatchEvent(new CustomEvent("ambi:generate-video", { detail: { prompt: text } }));
    else onSend(text, imageDataUrl || undefined);
    setValue(""); setImageDataUrl(""); setImageName(""); setMediaMode("chat"); requestAnimationFrame(resize);
  }

  async function attachImage(file?: File) {
    const selected = file ?? fileRef.current?.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setVoiceError("Choose an image file."); return; }
    if (selected.size > 6 * 1024 * 1024) { setVoiceError("Image must be 6 MB or smaller."); return; }
    try {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => { reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image.")); reader.onerror = () => reject(reader.error || new Error("Could not read image.")); reader.readAsDataURL(selected); });
      setImageDataUrl(data); setImageName(selected.name); setMediaMode("chat"); setVoiceError("");
    } catch (error) { setVoiceError(error instanceof Error ? error.message : "Could not attach image."); }
  }

  function voice() {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    setVoiceError("");
    if (!Recognition) { setVoiceError("Voice input is not supported in this browser."); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    const recognition = new Recognition(); recognition.lang = navigator.language || "en-IN"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event) => { const text = event.results[0]?.[0]?.transcript ?? ""; if (text) setValue((v) => `${v}${v ? " " : ""}${text}`); requestAnimationFrame(resize); };
    recognition.onerror = (event) => { setListening(false); recognitionRef.current = null; setVoiceError(event.error === "not-allowed" ? "Microphone permission was denied." : "Voice input could not start. Try again."); };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition; setListening(true);
    try { recognition.start(); } catch { setListening(false); recognitionRef.current = null; setVoiceError("Voice input could not start. Try again."); }
  }

  const disabled = !value.trim() || busy || mediaBusy;
  const placeholder = mediaMode === "image" ? "Describe the image…" : mediaMode === "video" ? "Describe the video…" : busy ? "Ambi is responding…" : "Message Ambi…";
  return <div className="composer-wrap"><div className={`composer ${mediaMode !== "chat" ? "composer-image-mode" : ""}`}>
    {mediaMode !== "chat" && <div className="composer-mode-label"><span className="image-mode-dot"/> {mediaMode === "image" ? "Image generation · text to image" : "Video generation · text to video"}</div>}
    {imageDataUrl && <div className="attachment-chip"><img src={imageDataUrl} alt="Attached image preview"/><span>{imageName || "Image attached"}</span><button type="button" aria-label="Remove attached image" onClick={() => { setImageDataUrl(""); setImageName(""); }}>×</button></div>}
    <textarea ref={inputRef} value={value} onChange={(e) => { setValue(e.target.value); setVoiceError(""); requestAnimationFrame(resize); }} onInput={resize} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} placeholder={placeholder} rows={1} aria-label={placeholder} />
    <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void attachImage(e.target.files?.[0])} />
    <div className="composer-row"><div className="composer-tools">
      <button className={`tool ${webSearch ? "active" : ""}`} onClick={onToggleResearch} type="button" aria-pressed={webSearch}>⌁ Research</button>
      <button className={`tool ${listening ? "active" : ""}`} onClick={voice} type="button" aria-pressed={listening}>◉ {listening ? "Listening" : "Voice"}</button>
      <button className="tool" onClick={() => fileRef.current?.click()} type="button">⌕ Attach</button>
      <button className={`tool ${mediaMode === "image" ? "active" : ""}`} onClick={() => setMediaMode((m) => m === "image" ? "chat" : "image")} type="button" aria-pressed={mediaMode === "image"}>✦ Image</button>
      <button className={`tool ${mediaMode === "video" ? "active" : ""}`} onClick={() => setMediaMode((m) => m === "video" ? "chat" : "video")} type="button" aria-pressed={mediaMode === "video"}>▹ Video</button>
    </div><span className="hint">{mediaMode === "image" ? "OpenRouter · Recraft" : mediaMode === "video" ? "OpenRouter · Seedance" : imageDataUrl ? "Groq Vision · Qwen 3.6 27B" : "Groq AI · Shift+Enter for a new line"}</span>{busy ? <button className="send stop" onClick={onStop} type="button">Stop</button> : <button className="send" onClick={submit} type="button" disabled={disabled}>{mediaMode === "image" ? "Generate" : mediaMode === "video" ? "Create" : "Send"}</button>}</div>
    {voiceError && <div className="composer-error" role="status">{voiceError}</div>}
  </div></div>;
}
