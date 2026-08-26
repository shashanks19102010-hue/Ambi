"use client";

import { useEffect, useRef, useState } from "react";
import { memoryStore } from "@/lib/memory/store";
import { uid } from "@/lib/id";
import type { Conversation, Message } from "@/types/chat";

function newConversation(title: string): Conversation { const now = Date.now(); return { id: uid("chat"), title, messages: [], createdAt: now, updatedAt: now }; }

export default function VideoGenerationBridge() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"preparing" | "creating" | "finishing">("preparing");
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    const generate = async (event: Event) => {
      if (busyRef.current) return;
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim() ?? "";
      if (!prompt) return;
      busyRef.current = true; setVisible(true); setError(""); setPhase("preparing"); window.dispatchEvent(new Event("ambi:video-start"));
      try {
        await new Promise((resolve) => setTimeout(resolve, 400)); setPhase("creating");
        const response = await fetch("/api/video/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }), cache: "no-store" });
        const first = await response.json().catch(() => ({})) as { jobId?: string; url?: string; error?: string };
        if (!response.ok || (!first.jobId && !first.url)) throw new Error(first.error || "Video generation could not be started.");
        let videoUrl = first.url || "";
        if (!videoUrl && first.jobId) {
          for (let attempt = 0; attempt < 24; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const statusResponse = await fetch(`/api/video/generate?jobId=${encodeURIComponent(first.jobId)}`, { cache: "no-store" });
            const status = await statusResponse.json().catch(() => ({})) as { status?: string; url?: string; error?: string };
            if (!statusResponse.ok) throw new Error(status.error || "Video status check failed.");
            if (status.url) { videoUrl = status.url; break; }
            if (["failed", "error", "cancelled"].includes((status.status || "").toLowerCase())) throw new Error(status.error || `Video generation ${status.status}.`);
          }
        }
        if (!videoUrl) throw new Error("Video is still processing. Please try again in a moment.");
        setPhase("finishing");
        const [conversations, activeId] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadActiveConversationId()]);
        const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations.find((conversation) => !conversation.archived) ?? newConversation(prompt.slice(0, 48));
        const message: Message = { id: uid("msg"), role: "assistant", content: "Created video", createdAt: Date.now(), status: "complete", source: "cloud", media: { type: "video", url: videoUrl, alt: prompt } };
        const updated: Conversation = { ...active, title: active.messages.length ? active.title : prompt.slice(0, 48), messages: [...active.messages, message], updatedAt: Date.now() };
        const next = conversations.some((conversation) => conversation.id === active.id) ? conversations.map((conversation) => conversation.id === active.id ? updated : conversation) : [updated, ...conversations];
        await memoryStore.saveConversations(next); await memoryStore.saveActiveConversationId(active.id); window.dispatchEvent(new Event("ambi:conversation-sync"));
        await new Promise((resolve) => setTimeout(resolve, 500)); window.location.reload();
      } catch (generationError) { setError(generationError instanceof Error ? generationError.message : "Video generation failed."); }
      finally { setVisible(false); window.dispatchEvent(new Event("ambi:video-end")); busyRef.current = false; }
    };
    window.addEventListener("ambi:generate-video", generate); return () => window.removeEventListener("ambi:generate-video", generate);
  }, []);

  if (!visible) return null;
  return <div className="image-generation-overlay" role="status" aria-live="polite"><div className="image-generation-modal"><div className="image-generation-art large"><div className="generation-orb"/><div className="generation-grid"/></div><div className="image-generation-copy"><span className="eyebrow">AMBI VIDEO ENGINE</span><h3>{phase === "preparing" ? "Preparing your video" : phase === "creating" ? "Creating your video" : "Finishing your video"}</h3><p>{phase === "preparing" ? "Planning the scene and motion…" : phase === "creating" ? "Rendering the video now. This can take a little while." : "Saving the finished video to this chat…"}</p><div className="generation-progress"><span className={phase !== "preparing" ? "done" : "active"}/><span className={phase === "finishing" ? "done" : phase === "creating" ? "active" : ""}/><span className={phase === "finishing" ? "active" : ""}/></div>{error && <div className="composer-error">{error}</div>}</div></div></div>;
}
