"use client";

import { useEffect, useRef } from "react";

function blobToObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

export default function MediaGenerationBridge() {
  const busyRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const generate = async (event: Event) => {
      if (busyRef.current) return;
      const detail = (event as CustomEvent<{ chatId?: string; messageId?: string; type?: "image" | "video"; prompt?: string }>).detail;
      const chatId = detail?.chatId?.trim() ?? "";
      const messageId = detail?.messageId?.trim() ?? "";
      const type = detail?.type;
      const prompt = detail?.prompt?.trim() ?? "";
      if (!chatId || !messageId || !type || !prompt) return;

      busyRef.current = true;
      window.dispatchEvent(new Event("ambi:media-start"));
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (controller.signal.aborted) return;
          try {
            const response = await fetch("/api/media/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type, prompt }),
              cache: "no-store",
              signal: controller.signal,
            });
            if (!response.ok) {
              const data = await response.json().catch(() => ({})) as { error?: string };
              throw new Error(data.error || "Media generation failed.");
            }
            const blob = await response.blob();
            if (!blob.size) throw new Error("Generated media was empty.");
            const url = blobToObjectUrl(blob);
            window.dispatchEvent(new CustomEvent("ambi:media-result", {
              detail: { chatId, messageId, type, prompt, url },
            }));
            return;
          } catch (error) {
            if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
            lastError = error;
            if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
          }
        }
        window.dispatchEvent(new CustomEvent("ambi:media-result", {
          detail: {
            chatId,
            messageId,
            type,
            prompt,
            error: lastError instanceof Error ? lastError.message : "Media generation failed.",
          },
        }));
      } finally {
        controllerRef.current = null;
        window.dispatchEvent(new Event("ambi:media-end"));
        busyRef.current = false;
      }
    };

    const stop = () => controllerRef.current?.abort();
    window.addEventListener("ambi:media-job", generate);
    window.addEventListener("ambi:media-stop", stop);
    return () => {
      window.removeEventListener("ambi:media-job", generate);
      window.removeEventListener("ambi:media-stop", stop);
      controllerRef.current?.abort();
    };
  }, []);

  return null;
}
