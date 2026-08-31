"use client";

import { useEffect, useRef, useState } from "react";

type ResultItem = {
  id: number;
  type: "photo" | "video";
  title: string;
  url: string;
  preview: string;
  media?: string;
  photographer: string;
  photographerUrl: string;
  width: number;
  height: number;
  duration?: number;
};

export default function PexelsSearchBridge() {
  const busy = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = async (event: Event) => {
      if (busy.current) return;
      const detail = (event as CustomEvent<{ chatId?: string; messageId?: string; query?: string; type?: "photo" | "video" }>).detail;
      const chatId = detail?.chatId?.trim() ?? "";
      const query = detail?.query?.trim() ?? "";
      const type = detail?.type === "video" ? "video" : "photo";
      if (!chatId || !query) return;

      busy.current = true;
      setLoading(true);
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await fetch(`/api/pexels?q=${encodeURIComponent(query)}&type=${type}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({})) as { results?: ResultItem[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Pexels search failed.");

        const results = (data.results ?? []).slice(0, 12);
        window.dispatchEvent(new CustomEvent("ambi:pexels-result", {
          detail: {
            chatId,
            messageId: detail?.messageId,
            query,
            type,
            results,
          },
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        window.dispatchEvent(new CustomEvent("ambi:pexels-result", {
          detail: {
            chatId,
            messageId: detail?.messageId,
            query,
            type,
            error: error instanceof Error ? error.message : "Pexels search failed.",
          },
        }));
      } finally {
        controllerRef.current = null;
        window.dispatchEvent(new Event("ambi:pexels-end"));
        busy.current = false;
        setLoading(false);
      }
    };

    const stop = () => controllerRef.current?.abort();
    window.addEventListener("ambi:search-pexels-job", search);
    window.addEventListener("ambi:pexels-stop", stop);
    return () => {
      window.removeEventListener("ambi:search-pexels-job", search);
      window.removeEventListener("ambi:pexels-stop", stop);
      controllerRef.current?.abort();
    };
  }, []);

  if (!loading) return null;
  return <div className="pexels-search-status" role="status" aria-live="polite">Searching Pexels…</div>;
}
