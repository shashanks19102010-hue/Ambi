"use client";

import { useEffect, useRef, useState } from "react";
import { memoryStore } from "@/lib/memory/store";
import { uid } from "@/lib/id";
import type { Conversation, Message } from "@/types/chat";

function newConversation(title: string): Conversation { const now = Date.now(); return { id: uid("chat"), title, messages: [], createdAt: now, updatedAt: now }; }

export default function AudioGenerationBridge() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"preparing" | "creating" | "finishing">("preparing");
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    const generate = async (event: Event) => {
      if (busyRef.current) return;
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim() ?? "";
      if (!prompt) return;
      busyRef.current = true; setVisible(true); setError(""); setStatus("preparing"); window.dispatchEvent(new Event("ambi:audio-start"));
      try {
        await new Promise((resolve) => setTimeout(resolve, 350)); setStatus("creating");
        const response = await fetch("/api/audio/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: prompt }), cache: "no-store" });
        const first = await response.json().catch(() => ({})) as { jobId?: string; url?: string; error?: string };
        if (!response.ok || (!first.jobId && !first.url)) throw new Error(first.error || "Audio generation could not be started.");
        let url = first.url || "";
        if (!url && first.jobId) {
          for (let attempt = 0; attempt < 20; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const poll = await fetch(`/api/audio/generate?jobId=${encodeURIComponent(first.jobId)}`, { cache: "no-store" });
            const result = await poll.json().catch(() => ({})) as { status?: string; url?: string; error?: string };
            if (!poll.ok) throw new Error(result.error || "Audio status check failed.");
            if (result.url) { url = result.url; break; }
            if (["failed", "error", "cancelled"].includes((result.status || "").toLowerCase())) throw new Error(result.error || `Audio generation ${result.status}.`);
          }
        }
        if (!url) throw new Error("Audio is still processing. Please try again in a moment.");
        setStatus("finishing");
        const [conversations, activeId] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadActiveConversationId()]);
        const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations.find((conversation) => !conversation.archived) ?? newConversation(prompt.slice(0, 48));
        const message: Message = { id: uid("msg"), role: "assistant", content: "Created audio", createdAt: Date.now(), status: "complete", source: "cloud", media: { type: "audio", url, alt: prompt } };
        const updated: Conversation = { ...active, title: active.messages.length ? active.title : prompt.slice(0, 48), messages: [...active.messages, message], updatedAt: Date.now() };
        const next = conversations.some((conversation) => conversation.id === active.id) ? conversations.map((conversation) => conversation.id === active.id ? updated : conversation) : [updated, ...conversations];
        await memoryStore.saveConversations(next); await memoryStore.saveActiveConversationId(active.id); window.dispatchEvent(new Event("ambi:conversation-sync"));
        await new Promise((resolve) => setTimeout(resolve, 500)); window.location.reload();
      } catch (generationError) { setError(generationError instanceof Error ? generationError.message : "Audio generation failed."); }
      finally { setVisible(false); window.dispatchEvent(new Event("ambi:audio-end")); busyRef.current = false; }
    };
    window.addEventListener("ambi:generate-audio", generate); return () => window.removeEventListener("ambi:generate-audio", generate);
  }, []);

  if (!visible) return null;
  return <div className="image-generation-overlay" role="status" aria-live="polite"><div className="image-generation-modal"><div className="image-generation-art large"><div className="generation-orb"/><div className="generation-grid"/></div><div className="image-generation-copy"><span className="eyebrow">AMBI AUDIO ENGINE</span><h3>{status === "preparing" ? "Preparing your audio" : status === "creating" ? "Creating your audio" : "Finishing your audio"}</h3><p>{status === "preparing" ? "Preparing the voice request…" : status === "creating" ? "Generating the audio now. This can take a little while." : "Saving the finished audio to this chat…"}</p><div className="generation-progress"><span className={status !== "preparing" ? "done" : "active"}/><span className={status === "finishing" ? "done" : status === "creating" ? "active" : ""}/><span className={status === "finishing" ? "active" : ""}/></div>{error && <div className="composer-error">{error}</div>}</div></div></div>;
}
