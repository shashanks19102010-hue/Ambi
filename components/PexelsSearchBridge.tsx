"use client";

import { useEffect, useRef, useState } from "react";
import { memoryStore } from "@/lib/memory/store";
import { uid } from "@/lib/id";
import type { Conversation, Message, PexelsMedia } from "@/types/chat";

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

function newConversation(title: string): Conversation { const now = Date.now(); return { id: uid("chat"), title, messages: [], createdAt: now, updatedAt: now }; }

export default function PexelsSearchBridge() {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const search = async (event: Event) => {
      if (busy.current) return;
      const detail = (event as CustomEvent<{ query?: string; type?: "photo" | "video" }>).detail;
      const query = detail?.query?.trim() ?? "";
      if (!query) return;
      busy.current = true; setLoading(true);
      try {
        const [saved, activeId] = await Promise.all([memoryStore.loadConversations(), memoryStore.loadActiveConversationId()]);
        const active = saved.find((item) => item.id === activeId) ?? saved.find((item) => !item.archived) ?? newConversation(query);
        const response = await fetch(`/api/pexels?q=${encodeURIComponent(query)}&type=${detail?.type === "video" ? "video" : "photo"}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as { results?: ResultItem[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Pexels search failed.");
        const results: PexelsMedia[] = (data.results ?? []).slice(0, 12).map((item) => ({
          id:item.id, type:item.type, title:item.title, pexelsUrl:item.url, previewUrl:item.preview,
          mediaUrl:item.media, width:item.width, height:item.height, photographer:item.photographer, photographerUrl:item.photographerUrl,
        }));
        const citations = results.map((item) => ({ title: item.title, url: item.pexelsUrl, snippet: `Photo/video by ${item.photographer} on Pexels` }));
        const message: Message = { id: uid("msg"), role:"assistant", content: results.length ? `Here are Pexels ${detail?.type === "video" ? "video" : "photo"} results for “${query}”.` : `No Pexels results were found for “${query}”.`, createdAt:Date.now(), status:"complete", source:"web", citations, pexels:results };
        const next: Conversation = { ...active, title: active.messages.length ? active.title : query.slice(0,48), messages:[...active.messages, message], updatedAt:Date.now() };
        const all = saved.some((item) => item.id === active.id) ? saved.map((item) => item.id === active.id ? next : item) : [next, ...saved];
        await memoryStore.saveConversations(all); await memoryStore.saveActiveConversationId(active.id); window.dispatchEvent(new Event("ambi:conversation-sync"));
      } catch (error) {
        const message: Message = { id:uid("msg"), role:"assistant", content:error instanceof Error ? error.message : "Pexels search failed.", createdAt:Date.now(), status:"error", source:"web" };
        const saved = await memoryStore.loadConversations(); const activeId = await memoryStore.loadActiveConversationId();
        const active = saved.find((item)=>item.id===activeId) ?? newConversation(query);
        const next: Conversation = { ...active, messages:[...active.messages,message], updatedAt:Date.now() };
        const all = saved.some((item)=>item.id===active.id) ? saved.map((item)=>item.id===active.id?next:item) : [next,...saved];
        await memoryStore.saveConversations(all); await memoryStore.saveActiveConversationId(active.id); window.dispatchEvent(new Event("ambi:conversation-sync"));
      } finally { busy.current=false; setLoading(false); }
    };
    window.addEventListener("ambi:search-pexels", search);
    return () => window.removeEventListener("ambi:search-pexels", search);
  }, []);
  if (!loading) return null;
  return <div className="pexels-search-status" role="status" aria-live="polite">Searching Pexels…</div>;
}
