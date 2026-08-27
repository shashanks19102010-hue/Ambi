"use client";
import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "@/types/chat";
import { PUTER_IMAGE_MODELS, PUTER_VIDEO_MODELS } from "@/lib/media/puter-models";

type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error?: string }) => void) | null };
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
type MediaMode = "chat" | "image" | "video";

function mediaIntent(text: string): MediaMode {
  const normalized = text.trim().toLowerCase();
  const image = /\b(?:generate|create|make|draw|design|imagine|visualize)\b[\s\S]{0,48}\b(?:image|picture|photo|illustration|art|poster|wallpaper|logo|icon|portrait)\b/.test(normalized)
    || /\b(?:image|picture|photo|illustration|art|poster|wallpaper|logo|icon|portrait)\s+(?:of|for|showing)\b/.test(normalized)
    || /^(?:image|picture|photo|illustration|art|poster|wallpaper|logo|icon|portrait)\s*[:,-]/.test(normalized);
  const video = /\b(?:generate|create|make|produce|animate|render)\b[\s\S]{0,48}\b(?:video|clip|movie|animation|reel|short)\b/.test(normalized)
    || /\b(?:video|clip|movie|animation|reel|short)\s+(?:of|about|showing)\b/.test(normalized)
    || /^(?:video|clip|movie|animation|reel|short)\s*[:,-]/.test(normalized);
  if (image && !video) return "image";
  if (video && !image) return "video";
  if (video) return "video";
  if (image) return "image";
  return "chat";
}

function mediaPrompt(text: string, mode: "image" | "video") {
  const normalized = text.trim();
  const pattern = mode === "image"
    ? /^(?:please\s+)?(?:generate|create|make|draw|design|imagine|visualize)\s+(?:an?\s+)?(?:image|picture|photo|illustration|art|poster|wallpaper|logo|icon|portrait)\s*(?:of|showing|depicting|with|for)?\s*/i
    : /^(?:please\s+)?(?:generate|create|make|produce|animate|render)\s+(?:a\s+)?(?:video|clip|movie|animation|reel|short)\s*(?:of|showing|depicting|with|about|for)?\s*/i;
  return normalized.replace(pattern, "").trim() || normalized;
}

export default function Composer({ onSend, onStop, busy, webSearch, onToggleResearch, imageModel, videoModel }: { onSend: (text: string, imageDataUrl?: string) => void; onStop: () => void; busy: boolean; webSearch: boolean; onToggleResearch: () => void; imageModel: string; videoModel: string }) {
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
    const start = () => setMediaBusy(true); const end = () => setMediaBusy(false);
    ["image", "video"].forEach((kind) => { window.addEventListener(`ambi:${kind}-start`, start); window.addEventListener(`ambi:${kind}-end`, end); });
    return () => { recognitionRef.current?.stop(); ["image", "video"].forEach((kind) => { window.removeEventListener(`ambi:${kind}-start`, start); window.removeEventListener(`ambi:${kind}-end`, end); }); };
  }, []);
  function resize() { const el = inputRef.current; if (!el) return; el.style.height = "0px"; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; }
  function submit() {
    const text = value.trim(); if (!text || busy || mediaBusy) return;
    const detected = mediaMode === "chat" ? mediaIntent(text) : mediaMode;
    const effective = detected === "chat" ? "chat" : detected;
    if (effective === "image") window.dispatchEvent(new CustomEvent("ambi:generate-image", { detail: { prompt: mediaPrompt(text, "image"), model: imageModel } }));
    else if (effective === "video") window.dispatchEvent(new CustomEvent("ambi:generate-video", { detail: { prompt: mediaPrompt(text, "video"), model: videoModel } }));
    else {
      onSend(text, imageDataUrl || undefined);
    }
    setValue(""); setImageDataUrl(""); setImageName(""); setMediaMode("chat"); requestAnimationFrame(resize);
  }
  async function attachImage(file?: File) {
    const selected = file ?? fileRef.current?.files?.[0]; if (!selected) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(selected.type)) { setVoiceError("Use PNG, JPG, JPEG, or WebP."); return; }
    if (selected.size > 12 * 1024 * 1024) { setVoiceError("Image must be 12 MB or smaller."); return; }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(reader.error || new Error("Could not read image."));
        reader.readAsDataURL(selected);
      });
      const optimized = await new Promise<string>((resolve) => {
        const image = new Image();
        image.onload = () => {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
          const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
          const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(data); return; }
          ctx.drawImage(image, 0, 0, width, height);
          const output = canvas.toDataURL("image/webp", 0.82);
          resolve(output.startsWith("data:image/webp") ? output : data);
        };
        image.onerror = () => resolve(data);
        image.src = data;
      });
      setImageDataUrl(optimized); setImageName(selected.name); setMediaMode("chat"); setVoiceError("");
    } catch (error) { setVoiceError(error instanceof Error ? error.message : "Could not attach image."); }
  }
  function voice() {
    const speechWindow = window as SpeechWindow; const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition; setVoiceError("");
    if (!Recognition) { setVoiceError("Voice input is not supported in this browser."); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    const recognition = new Recognition(); recognition.lang = navigator.language || "en-IN"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event) => { const text = event.results[0]?.[0]?.transcript ?? ""; if (text) setValue((v) => `${v}${v ? " " : ""}${text}`); requestAnimationFrame(resize); };
    recognition.onerror = (event) => { setListening(false); recognitionRef.current = null; setVoiceError(event.error === "not-allowed" ? "Microphone permission was denied." : "Voice input could not start. Try again."); };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition; setListening(true); try { recognition.start(); } catch { setListening(false); recognitionRef.current = null; setVoiceError("Voice input could not start. Try again."); }
  }
  const disabled = !value.trim() || busy || mediaBusy;
  const placeholder = mediaMode === "image" ? "Describe the image…" : mediaMode === "video" ? "Describe the video…" : busy ? "Ambi is responding…" : "Message Ambi…";
  const activeImage = PUTER_IMAGE_MODELS.find((m) => m.id === imageModel) ?? PUTER_IMAGE_MODELS[0];
  const activeVideo = PUTER_VIDEO_MODELS.find((m) => m.id === videoModel) ?? PUTER_VIDEO_MODELS[0];
  const label = mediaMode === "image" ? `Image generation · ${activeImage.name}` : mediaMode === "video" ? `Video generation · ${activeVideo.name}` : "";

  return <div className="composer-wrap"><div className={`composer ${mediaMode !== "chat" ? "composer-image-mode" : ""}`}>
    {mediaMode !== "chat" && <div className="composer-mode-label"><span className="image-mode-dot"/> {label}</div>}
    {imageDataUrl && <div className="attachment-chip"><img src={imageDataUrl} alt="Attached image preview"/><span>{imageName || "Image attached"}</span><button type="button" aria-label="Remove attached image" onClick={() => { setImageDataUrl(""); setImageName(""); }}>×</button></div>}
    <textarea ref={inputRef} value={value} onChange={(e) => { setValue(e.target.value); setVoiceError(""); requestAnimationFrame(resize); }} onInput={resize} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} placeholder={placeholder} rows={1} aria-label={placeholder} />
    <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void attachImage(e.target.files?.[0])} />
    <div className="composer-row"><div className="composer-tools">
      <button className={`tool ${webSearch ? "active" : ""}`} onClick={onToggleResearch} type="button" aria-pressed={webSearch}>⌁ Research</button>
      <button className={`tool ${listening ? "active" : ""}`} onClick={voice} type="button" aria-pressed={listening}>◉ {listening ? "Listening" : "Voice"}</button>
      <button className="tool" onClick={() => fileRef.current?.click()} type="button">⌕ Attach</button>
      <button className={`tool ${mediaMode === "image" ? "active" : ""}`} onClick={() => setMediaMode((m) => m === "image" ? "chat" : "image")} type="button" aria-pressed={mediaMode === "image"}>✦ Image</button>
      <button className={`tool ${mediaMode === "video" ? "active" : ""}`} onClick={() => setMediaMode((m) => m === "video" ? "chat" : "video")} type="button" aria-pressed={mediaMode === "video"}>▹ Video</button>
    </div><span className="hint">{mediaMode === "image" ? activeImage.provider : mediaMode === "video" ? activeVideo.provider : imageDataUrl ? "Attached image will be shown in your message" : "Shift+Enter for a new line"}</span>{busy ? <button className="send stop" onClick={onStop} type="button">Stop</button> : <button className="send" onClick={submit} type="button" disabled={disabled}>{mediaMode === "image" || mediaMode === "video" ? "Generate" : "Send"}</button>}</div>
    {voiceError && <div className="composer-error" role="status">{voiceError}</div>}
  </div></div>;
}
