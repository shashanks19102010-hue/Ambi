"use client";

import { useEffect, useRef, useState } from "react";
import { memoryStore } from "@/lib/memory/store";
import { uid } from "@/lib/id";
import type { Conversation, Message } from "@/types/chat";

function newConversation(title: string): Conversation {
  const now = Date.now();
  return { id: uid("chat"), title, messages: [], createdAt: now, updatedAt: now };
}

export default function ImageGenerationBridge() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"preparing" | "creating" | "finishing">("preparing");
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    const generate = async (event: Event) => {
      if (busyRef.current) return;
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim() ?? "";
      if (!prompt) return;

      busyRef.current = true;
      setVisible(true);
      setError("");
      setPhase("preparing");
      window.dispatchEvent(new Event("ambi:image-start"));

      try {
        const [conversations, activeId] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadActiveConversationId()]);
        const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations.find((conversation) => !conversation.archived) ?? newConversation(prompt.slice(0, 48));
        const imageMessageId = uid("msg");
        const placeholder: Message = { id: imageMessageId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", source: "cloud", generation: { type: "image", phase: "preparing" } };
        const seeded: Conversation = { ...active, title: active.messages.length ? active.title : prompt.slice(0, 48), messages: [...active.messages, placeholder], updatedAt: Date.now() };
        const next = conversations.some((conversation) => conversation.id === active.id) ? conversations.map((conversation) => conversation.id === active.id ? seeded : conversation) : [seeded, ...conversations];
        await memoryStore.saveConversations(next);
        await memoryStore.saveActiveConversationId(active.id);
        window.dispatchEvent(new Event("ambi:conversation-sync"));

        await new Promise((resolve) => setTimeout(resolve, 450));
        setPhase("creating");
        const creatingConversations = next.map((conversation) => conversation.id === active.id ? { ...conversation, messages: conversation.messages.map((message) => message.id === imageMessageId ? { ...message, generation: { type: "image", phase: "creating" } } : message) } : conversation);
        await memoryStore.saveConversations(creatingConversations);
        window.dispatchEvent(new Event("ambi:conversation-sync"));

        const response = await fetch("/api/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }), cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as { dataUrl?: string; error?: string };
        if (!response.ok || !payload.dataUrl) throw new Error(payload.error || "Image generation failed.");

        setPhase("finishing");
        const finished = creatingConversations.map((conversation) => conversation.id === active.id ? { ...conversation, messages: conversation.messages.map((message) => message.id === imageMessageId ? { ...message, content: "Created image", status: "complete", media: { type: "image", dataUrl: payload.dataUrl!, alt: prompt }, generation: undefined } : message), updatedAt: Date.now() } : conversation);
        await memoryStore.saveConversations(finished);
        window.dispatchEvent(new Event("ambi:conversation-sync"));
        await new Promise((resolve) => setTimeout(resolve, 250));
        window.location.reload();
      } catch (generationError) {
        const message = generationError instanceof Error ? generationError.message : "Image generation failed.";
        setError(message);
        try {
          const conversations = await memoryStore.loadConversations();
          const activeId = await memoryStore.loadActiveConversationId();
          const updated = conversations.map((conversation) => activeId && conversation.id === activeId ? { ...conversation, messages: conversation.messages.map((item) => item.status === "streaming" && item.generation?.type === "image" ? { ...item, content: message, status: "error", generation: undefined } : item) } : conversation);
          await memoryStore.saveConversations(updated);
          window.dispatchEvent(new Event("ambi:conversation-sync"));
        } catch { /* keep the visible error */ }
      } finally {
        setVisible(false);
        window.dispatchEvent(new Event("ambi:image-end"));
        busyRef.current = false;
      }
    };

    window.addEventListener("ambi:generate-image", generate);
    return () => window.removeEventListener("ambi:generate-image", generate);
  }, []);

  if (!visible) return null;
  return <div className="image-generation-overlay" role="status" aria-live="polite">
    <div className="image-generation-modal">
      <div className="image-generation-art large"><div className="generation-orb"/><div className="generation-grid"/></div>
      <div className="image-generation-copy"><span className="eyebrow">AMBI IMAGE ENGINE</span><h3>{phase === "preparing" ? "Preparing your image" : phase === "creating" ? "Creating your image" : "Finishing your image"}</h3><p>{phase === "preparing" ? "Understanding the prompt and setting up the generation…" : phase === "creating" ? "The artwork is being generated now. This can take a little while." : "Finalizing the image and saving it to this chat…"}</p><div className="generation-progress"><span className={phase !== "preparing" ? "done" : "active"}/><span className={phase === "finishing" ? "done" : phase === "creating" ? "active" : ""}/><span className={phase === "finishing" ? "active" : ""}/></div>{error && <div className="composer-error">{error}</div>}</div>
    </div>
  </div>;
}
