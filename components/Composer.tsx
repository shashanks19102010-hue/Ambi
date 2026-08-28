"use client";

import { useEffect, useRef, useState } from "react";
import { wantsWebSearch } from "@/lib/tools/intents";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};
type MediaMode = "chat" | "image" | "video";

const IMAGE_WORDS = /\b(image|picture|photo|illustration|art|poster|wallpaper|logo|icon|portrait)\b/i;
const VIDEO_WORDS = /\b(video|clip|movie|animation|reel|short|footage)\b/i;
const ACTION_WORDS = /\b(create|generate|make|draw|design|produce|animate|render|visualize|imagine)\b/i;

function detectMediaMode(text: string): MediaMode {
  const normalized = text.trim();
  if (!ACTION_WORDS.test(normalized)) return "chat";
  const hasVideo = VIDEO_WORDS.test(normalized);
  const hasImage = IMAGE_WORDS.test(normalized);
  if (hasVideo && !hasImage) return "video";
  if (hasImage && !hasVideo) return "image";
  if (hasVideo) return "video";
  return "image";
}

function cleanMediaPrompt(text: string, mode: "image" | "video") {
  const words = text.trim().split(/\s+/);
  if (!words.length) return text.trim();
  const stopWords = new Set(["please", "an", "a", "the", "of", "showing", "depicting", "with", "about", "for"]);
  const mediaWords = mode === "image" ? IMAGE_WORDS : VIDEO_WORDS;
  let start = 0;
  while (start < words.length && (stopWords.has(words[start].toLowerCase().replace(/[^a-z]/g, "")) || ACTION_WORDS.test(words[start]))) {
    start += 1;
  }
  if (start < words.length && mediaWords.test(words[start])) start += 1;
  while (start < words.length && stopWords.has(words[start].toLowerCase().replace(/[^a-z]/g, ""))) start += 1;
  const result = words.slice(start).join(" ").trim();
  return result || text.trim();
}

function isPexelsSearch(text: string) {
  const normalized = text.trim().toLowerCase();
  const lookup = normalized.includes("pexels") || /\b(find|search|show|browse|get|give me|look for)\b/.test(normalized);
  return lookup && (IMAGE_WORDS.test(normalized) || VIDEO_WORDS.test(normalized));
}

export default function Composer({
  onSend,
  onStop,
  busy,
  webSearch,
  onToggleResearch,
}: {
  onSend: (text: string, imageDataUrl?: string) => void;
  onStop: () => void;
  busy: boolean;
  webSearch: boolean;
  onToggleResearch: () => void;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);


  function resize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  async function submit() {
    const text = value.trim();
    if (!text || busy) return;

    const detected = detectMediaMode(text);
    if (detected === "image" || detected === "video") {
      window.dispatchEvent(new CustomEvent("ambi:generate-media", {
        detail: { type: detected, prompt: cleanMediaPrompt(text, detected) },
      }));
    } else if (isPexelsSearch(text)) {
      window.dispatchEvent(new CustomEvent("ambi:search-pexels", {
        detail: { query: text, type: VIDEO_WORDS.test(text) ? "video" : "photo" },
      }));
    } else {
      onSend(text, imageDataUrl || undefined);
    }

    setValue("");
    setImageDataUrl("");
    setImageName("");
     requestAnimationFrame(resize);
  }

  async function attachImage(file?: File) {
    const selected = file ?? fileRef.current?.files?.[0];
    if (!selected) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(selected.type)) {
      setVoiceError("Use PNG, JPG, JPEG, or WebP.");
      return;
    }
    if (selected.size > 12 * 1024 * 1024) {
      setVoiceError("Image must be 12 MB or smaller.");
      return;
    }

    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(reader.error || new Error("Could not read image."));
        reader.readAsDataURL(selected);
      });

      const preview = await new Promise<string>((resolve) => {
        const image = new Image();
        image.onload = () => {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
          const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
          const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(data);
            return;
          }
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/webp", 0.82));
        };
        image.onerror = () => resolve(data);
        image.src = data;
      });

      setImageDataUrl(preview);
      setImageName(selected.name);
      setVoiceError("");
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Could not attach image.");
    }
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
      if (text) setValue((value) => value + (value ? " " : "") + text);
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

  const disabled = !value.trim() || busy;
  const mediaMode = value.trim() ? detectMediaMode(value) : "chat";
  const researchActive = webSearch || wantsWebSearch(value);
  const modeLabel = mediaMode === "image" ? "Image creation detected" : mediaMode === "video" ? "Video creation detected" : researchActive ? "Research detected" : "";

  return (
    <div className="composer-wrap">
      <div className="composer">
        {(imageDataUrl || modeLabel) && (
          <div className="attachment-chip">
            {imageDataUrl && <img src={imageDataUrl} alt="Attached image preview" />}
            <span>{imageName || modeLabel}</span>
            {imageDataUrl && <button type="button" aria-label="Remove attached image" onClick={() => { setImageDataUrl(""); setImageName(""); }}>×</button>}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => { setValue(event.target.value); setVoiceError(""); requestAnimationFrame(resize); }}
          onInput={resize}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={mediaMode === "image" ? "Describe the image…" : mediaMode === "video" ? "Describe the video…" : busy ? "Ambi is responding…" : "Message Ambi…"}
          rows={1}
          aria-label="Message Ambi"
        />
        <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void attachImage(event.target.files?.[0])} />
        <div className="composer-row">
          <div className="composer-tools">
            <button className={`tool ${researchActive ? "active" : ""}`} onClick={onToggleResearch} type="button" aria-pressed={researchActive}>⌁ Research</button>
            <button className={`tool ${listening ? "active" : ""}`} onClick={voice} type="button">{listening ? "◉ Listening" : "◉ Voice"}</button>
            <button className="tool" onClick={() => fileRef.current?.click()} type="button">⌕ Attach</button>
          </div>
          <span className="hint">{modeLabel || (imageDataUrl ? "Attached image ready" : "Shift+Enter for a new line")}</span>
          {busy ? <button className="send stop" onClick={onStop} type="button">Stop</button> : <button className="send" onClick={() => void submit()} type="button" disabled={disabled}>{mediaMode === "image" ? "Create image" : mediaMode === "video" ? "Create video" : "Send"}</button>}
        </div>
        {voiceError && <div className="composer-error" role="status">{voiceError}</div>}
      </div>
    </div>
  );
}
