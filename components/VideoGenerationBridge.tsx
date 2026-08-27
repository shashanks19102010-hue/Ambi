"use client";

import { useEffect, useRef, useState } from "react";
import { memoryStore } from "@/lib/memory/store";
import { uid } from "@/lib/id";
import type { Conversation, Message } from "@/types/chat";
import { DEFAULT_PUTER_VIDEO_MODEL, normalizeMediaModel } from "@/lib/media/puter-models";
import { getMediaSource, getPuter, withRetries } from "@/lib/media/puter";

function newConversation(title: string): Conversation { const now = Date.now(); return { id: uid("chat"), title, messages: [], createdAt: now, updatedAt: now }; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function secondsForModel(model: string) { return model.startsWith("sora-2") ? 4 : model.startsWith("veo-3") ? 4 : 5; }

async function runVideo(prompt: string, model: string) {
  const selected = normalizeMediaModel(model, "video");
  const models = [selected, DEFAULT_PUTER_VIDEO_MODEL].filter((value, index, list) => list.indexOf(value) === index);
  let lastError: unknown;
  const puter = await getPuter();
  for (const candidate of models) {
    try {
      return await withRetries(async () => {
        const result = await puter.ai.txt2vid(prompt, { model: candidate, seconds: secondsForModel(candidate) });
        const src = getMediaSource(result, "video");
        if (!src) throw new Error("The video provider returned no usable video.");
        return { src, model: candidate };
      }, 2);
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Video generation failed.");
}

export default function VideoGenerationBridge() {
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
      const selectedModel = normalizeMediaModel(detail?.model, "video");
      busyRef.current = true;
      setVisible(true); setError(""); setPhase("preparing");
      window.dispatchEvent(new Event("ambi:video-start"));
      try {
        const [conversations, activeId] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadActiveConversationId()]);
        const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations.find((conversation) => !conversation.archived) ?? newConversation(prompt.slice(0, 48));
        const videoMessageId = uid("msg");
        const placeholder: Message = { id: videoMessageId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", source: "cloud", generation: { type: "video", phase: "preparing", model: selectedModel } };
        const seeded = { ...active, title: active.messages.length ? active.title : prompt.slice(0, 48), messages: [...active.messages, placeholder], updatedAt: Date.now() };
        const next = conversations.some((conversation) => conversation.id === active.id) ? conversations.map((conversation) => conversation.id === active.id ? seeded : conversation) : [seeded, ...conversations];
        await memoryStore.saveConversations(next); await memoryStore.saveActiveConversationId(active.id); window.dispatchEvent(new Event("ambi:conversation-sync"));
        await sleep(450); setPhase("creating");
        const creating = next.map((conversation) => conversation.id === active.id ? { ...conversation, messages: conversation.messages.map((message) => message.id === videoMessageId ? { ...message, generation: { type: "video", phase: "creating", model: selectedModel } } : message) } : conversation);
        await memoryStore.saveConversations(creating); window.dispatchEvent(new Event("ambi:conversation-sync"));

        const result = await runVideo(prompt, selectedModel);
        setPhase("finishing");
        const finished = creating.map((conversation) => conversation.id === active.id ? { ...conversation, messages: conversation.messages.map((message) => message.id === videoMessageId ? { ...message, content: "Created video", status: "complete", media: { type: "video", url: result.src, alt: prompt }, generation: undefined } : message), updatedAt: Date.now() } : conversation);
        await memoryStore.saveConversations(finished); window.dispatchEvent(new Event("ambi:conversation-sync"));
        await sleep(400);
      } catch (generationError) {
        const message = generationError instanceof Error ? generationError.message : "Video generation failed.";
        setError(message);
        try {
          const conversations = await memoryStore.loadConversations();
          const activeId = await memoryStore.loadActiveConversationId();
          const updated = conversations.map((conversation) => activeId && conversation.id === activeId ? { ...conversation, messages: conversation.messages.map((item) => item.status === "streaming" && item.generation?.type === "video" ? { ...item, content: message, status: "error", generation: undefined } : item) } : conversation);
          await memoryStore.saveConversations(updated); window.dispatchEvent(new Event("ambi:conversation-sync"));
        } catch { /* keep the visible failure state */ }
        await sleep(900);
      } finally {
        setVisible(false); window.dispatchEvent(new Event("ambi:video-end")); busyRef.current = false;
      }
    };
    window.addEventListener("ambi:generate-video", generate);
    return () => window.removeEventListener("ambi:generate-video", generate);
  }, []);

  if (!visible) return null;
  return <div className="image-generation-overlay" role="status" aria-live="polite">
    <div className="image-generation-modal">
      <div className="image-generation-art large"><div className="generation-orb"/><div className="generation-grid"/></div>
      <div className="image-generation-copy">
        <span className="eyebrow">AMBI VIDEO ENGINE · PUTER</span>
        <h3>{phase === "preparing" ? "Preparing your video" : phase === "creating" ? "Creating your video" : "Finishing your video"}</h3>
        <p>{phase === "preparing" ? "Understanding the request and planning the scene…" : phase === "creating" ? "Rendering the video now. This can take a little while." : "Saving the finished video to this chat…"}</p>
        <div className="generation-progress"><span className={phase !== "preparing" ? "done" : "active"}/><span className={phase === "finishing" ? "done" : phase === "creating" ? "active" : ""}/><span className={phase === "finishing" ? "active" : ""}/></div>
        {error && <div className="composer-error">{error}</div>}
      </div>
    </div>
  </div>;
}
