"use client";

import { useEffect, useRef, useState } from "react";
import { detectRequestIntent, type RequestIntent } from "@/lib/tools/intents";

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

const IMAGE_ACTION_RE = /\b(?:create|generate|make|draw|design|visualize|imagine)\s+(?:an?\s+)?(?:image|picture|photo|illustration|artwork|poster|wallpaper|logo|icon|portrait)\b/i;
const VIDEO_ACTION_RE = /\b(?:create|generate|make|produce|animate|render)\s+(?:a\s+)?(?:video|clip|movie|animation|reel|short)\b(?!\s+game\b)/i;

function mediaModeForIntent(intent: RequestIntent): MediaMode {
  return intent === "image" ? "image" : intent === "video" ? "video" : "chat";
}
function cleanMediaPrompt(text: string, mode: "image" | "video") {
  const pattern = mode === "image" ? IMAGE_ACTION_RE : VIDEO_ACTION_RE;
  const cleaned = text.replace(pattern, "").trim();
  return cleaned || text.trim();
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
  const [manualMode, setManualMode] = useState<MediaMode>("chat");
  const [mediaBusy, setMediaBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const start = () => setMediaBusy(true);
    const end = () => setMediaBusy(false);
    window.addEventListener("ambi:media-start", start);
    window.addEventListener("ambi:media-end", end);
    return () => {
      window.removeEventListener("ambi:media-start", start);
      window.removeEventListener("ambi:media-end", end);
    };
  }, []);

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
    if (!text || busy || mediaBusy) return;

    const detected = manualMode !== "chat" ? manualMode : detectRequestIntent(text);
    if (detected === "image" || detected === "video") {
      window.dispatchEvent(new CustomEvent("ambi:generate-media", {
        detail: { type: detected, prompt: cleanMediaPrompt(text, detected) },
      }));
    } else if (detected === "pexels-photo" || detected === "pexels-video") {
      window.dispatchEvent(new CustomEvent("ambi:search-pexels", {
        detail: { query: text, type: detected === "pexels-video" ? "video" : "photo" },
      }));
    } else {
      onSend(text, imageDataUrl || undefined);
    }

    setValue("");
    setImageDataUrl("");
    setImageName("");
     setManualMode("chat");
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

  const intent = detectRequestIntent(value);
  const mediaMode = mediaModeForIntent(intent);
  const disabled = !value.trim() || busy || mediaBusy;
  const researchActive = webSearch || intent === "research";
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
            <button className="tool" onClick={() => fileRef.current?.click()} type="button">⌕ Attach</button><button className={`tool ${mediaMode === "image" ? "active" : ""}`} onClick={() => setManualMode((mode) => mode === "image" ? "chat" : "image")} type="button" aria-pressed={mediaMode === "image"}>✦ Image</button><button className={`tool ${mediaMode === "video" ? "active" : ""}`} onClick={() => setManualMode((mode) => mode === "video" ? "chat" : "video")} type="button" aria-pressed={mediaMode === "video"}>▷ Video</button>
          </div>
          <span className="hint">{modeLabel || (imageDataUrl ? "Attached image ready" : "Shift+Enter for a new line")}</span>
          {busy ? <button className="send stop" onClick={onStop} type="button">Stop</button> : mediaBusy ? <button className="send stop" onClick={() => window.dispatchEvent(new Event("ambi:media-stop"))} type="button">Stop</button> : <button className="send" onClick={() => void submit()} type="button" disabled={disabled}>{mediaMode === "image" ? "Create image" : mediaMode === "video" ? "Create video" : "Send"}</button>}
        </div>
        {voiceError && <div className="composer-error" role="status">{voiceError}</div>}
      </div>
    </div>
  );
}
