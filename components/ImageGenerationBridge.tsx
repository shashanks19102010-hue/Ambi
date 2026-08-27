"use client";

import { useEffect, useRef, useState } from "react";
import { memoryStore } from "@/lib/memory/store";
import { uid } from "@/lib/id";
import type { Conversation, Message } from "@/types/chat";
import { DEFAULT_PUTER_IMAGE_MODEL, normalizeMediaModel } from "@/lib/media/puter-models";
import { getMediaSource, getPuter, withRetries } from "@/lib/media/puter";

function newConversation(title: string): Conversation { const now = Date.now(); return { id: uid("chat"), title, messages: [], createdAt: now, updatedAt: now }; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function runImage(prompt: string, model: string) {
  const selected = normalizeMediaModel(model, "image");
  const models = [selected, DEFAULT_PUTER_IMAGE_MODEL].filter((value, index, list) => list.indexOf(value) === index);
  let lastError: unknown;
  const puter = await getPuter();
  for (const candidate of models) {
    try {
      return await withRetries(async () => {
        const result = await puter.ai.txt2img(prompt, { model: candidate });
        const src = getMediaSource(result, "image");
        if (!src) throw new Error("The image provider returned no usable image.");
        return { src, model: candidate };
      }, 2);
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Image generation failed.");
}

export default function ImageGenerationBridge() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"preparing" | "creating" | "finishing">("preparing");
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    const generate = async (event: Event) => {
      if (busyRef.current) return;
      const detail = (event as CustomEvent<{ prompt?: string; model?: string }>).detail;
      const prompt = detail?.prompt?.trim() ?? "";
      if (!prompt) return;
      const selectedModel = normalizeMediaModel(detail?.model, "image");
      busyRef.current = true;
      setVisible(true); setError(""); setPhase("preparing");
      window.dispatchEvent(new Event("ambi:image-start"));
      try {
        const [conversations, activeId] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadActiveConversationId()]);
        const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations.find((conversation) => !conversation.archived) ?? newConversation(prompt.slice(0, 48));
        const imageMessageId = uid("msg");
        const placeholder: Message = { id: imageMessageId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", source: "cloud", generation: { type: "image", phase: "preparing", model: selectedModel } };
        const seeded: Conversation = { ...active, title: active.messages.length ? active.title : prompt.slice(0, 48), messages: [...active.messages, placeholder], updatedAt: Date.now() };
        const next: Conversation[] = conversations.some((conversation) => conversation.id === active.id) ? conversations.map((conversation) => conversation.id === active.id ? seeded : conversation) : [seeded, ...conversations];
        await memoryStore.saveConversations(next); await memoryStore.saveActiveConversationId(active.id); window.dispatchEvent(new Event("ambi:conversation-sync"));
        await sleep(450); setPhase("creating");
        const creating: Conversation[] = next.map((conversation) => conversation.id === active.id ? { ...conversation, messages: conversation.messages.map((message) => message.id === imageMessageId ? { ...message, generation: { type: "image", phase: "creating", model: selectedModel } } : message) } : conversation);
        await memoryStore.saveConversations(creating); window.dispatchEvent(new Event("ambi:conversation-sync"));

        const result = await runImage(prompt, selectedModel);
        setPhase("finishing");
        const finished: Conversation[] = creating.map((conversation) => conversation.id === active.id ? { ...conversation, messages: conversation.messages.map((message) => message.id === imageMessageId ? { ...message, content: "Created image", status: "complete", media: { type: "image", dataUrl: result.src, alt: prompt }, generation: undefined } : message), updatedAt: Date.now() } : conversation);
        await memoryStore.saveConversations(finished); window.dispatchEvent(new Event("ambi:conversation-sync"));
        await sleep(350);
      } catch (generationError) {
        const message = generationError instanceof Error ? generationError.message : "Image generation failed.";
        setError(message);
        try {
          const conversations = await memoryStore.loadConversations();
          const activeId = await memoryStore.loadActiveConversationId();
          const updated: Conversation[] = conversations.map((conversation) => activeId && conversation.id === activeId ? { ...conversation, messages: conversation.messages.map((item) => item.status === "streaming" && item.generation?.type === "image" ? { ...item, content: message, status: "error", generation: undefined } : item) } : conversation);
          await memoryStore.saveConversations(updated); window.dispatchEvent(new Event("ambi:conversation-sync"));
        } catch { /* keep the visible failure state */ }
        await sleep(900);
      } finally {
        setVisible(false); window.dispatchEvent(new Event("ambi:image-end")); busyRef.current = false;
      }
    };
    window.addEventListener("ambi:generate-image", generate);
    return () => window.removeEventListener("ambi:generate-image", generate);
  }, []);

  if (!visible) return null;
  return <div className="image-generation-overlay" role="status" aria-live="polite">
    <div className="image-generation-modal">
      <div className="image-generation-art large"><div className="generation-orb"/><div className="generation-grid"/></div>
      <div className="image-generation-copy">
        <span className="eyebrow">AMBI IMAGE ENGINE · PUTER</span>
        <h3>{phase === "preparing" ? "Preparing your image" : phase === "creating" ? "Creating your image" : "Finishing your image"}</h3>
        <p>{phase === "preparing" ? "Understanding the request and preparing the generation…" : phase === "creating" ? "Creating the artwork now. This can take a little while." : "Finalizing the image and saving it to this chat…"}</p>
        <div className="generation-progress"><span className={phase !== "preparing" ? "done" : "active"}/><span className={phase === "finishing" ? "done" : phase === "creating" ? "active" : ""}/><span className={phase === "finishing" ? "active" : ""}/></div>
        {error && <div className="composer-error">{error}</div>}
      </div>
    </div>
  </div>;
}
