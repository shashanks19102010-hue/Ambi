"use client";
import { useEffect, useRef } from "react";
import { memoryStore } from "@/lib/memory/store";
import { uid } from "@/lib/id";
import type { Conversation, Message } from "@/types/chat";

function newConversation(title: string): Conversation { const now=Date.now(); return { id:uid("chat"), title, messages:[], createdAt:now, updatedAt:now }; }
function blobToDataUrl(blob: Blob): Promise<string> { return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Could not read generated media.")); reader.onerror=()=>reject(reader.error||new Error("Could not read generated media.")); reader.readAsDataURL(blob); }); }

export default function MediaGenerationBridge(){
 const busyRef=useRef(false);
 useEffect(()=>{
  const generate=async(event:Event)=>{
   if(busyRef.current)return;
   const detail=(event as CustomEvent<{type?: "image"|"video"; prompt?:string}>).detail;
   const type=detail?.type; const prompt=detail?.prompt?.trim()||"";
   if(!type||!prompt)return;
   busyRef.current=true;
   const startName=type==="image"?"ambi:image-start":"ambi:video-start"; const endName=type==="image"?"ambi:image-end":"ambi:video-end";
   window.dispatchEvent(new Event(startName));
   try{
    const [saved,activeId]=await Promise.all([memoryStore.loadConversations(),memoryStore.loadActiveConversationId()]);
    const active=saved.find(c=>c.id===activeId)||saved.find(c=>!c.archived)||newConversation(prompt);
    const messageId=uid("msg");
    const placeholder:Message={id:messageId,role:"assistant",content:"",createdAt:Date.now(),status:"streaming",generation:{type,phase:"preparing"}};
    const seeded:Conversation={...active,title:active.messages.length?active.title:prompt.slice(0,48),messages:[...active.messages,placeholder],updatedAt:Date.now()};
    const save=(items:Conversation[])=>memoryStore.saveConversations(items);
    const next=saved.some(c=>c.id===active.id)?saved.map(c=>c.id===active.id?seeded:c):[seeded,...saved];
    await save(next); await memoryStore.saveActiveConversationId(active.id); window.dispatchEvent(new Event("ambi:conversation-sync"));
    await new Promise(r=>setTimeout(r,350));
    const creating=next.map(c=>c.id===active.id?{...c,messages:c.messages.map(m=>m.id===messageId?{...m,generation:{type,phase:"creating"}}:m)}:c);
    await save(creating); window.dispatchEvent(new Event("ambi:conversation-sync"));
    let lastError:unknown;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch("/api/media/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type,prompt}),cache:"no-store"});
        if(!response.ok){const data=await response.json().catch(()=>({})) as {error?:string}; throw new Error(data.error||"Media generation failed.");}
        const blob=await response.blob(); if(!blob.size)throw new Error("Generated media was empty.");
        const dataUrl=await blobToDataUrl(blob);
        await save(creating.map(c=>c.id===active.id?{...c,messages:c.messages.map(m=>m.id===messageId?{...m,status:"complete",content:type==="image"?"Created image":"Created video",media:type==="image"?{type:"image",dataUrl,alt:prompt}:{type:"video",url:dataUrl,alt:prompt},generation:undefined}:m),updatedAt:Date.now()}:c));
        window.dispatchEvent(new Event("ambi:conversation-sync")); return;
      }catch(error){lastError=error; if(attempt<2)await new Promise(r=>setTimeout(r,700*(attempt+1)));}
    }
    throw lastError instanceof Error?lastError:new Error("Media generation failed.");
   }catch(error){
    const message=error instanceof Error?error.message:"Media generation failed.";
    try{const saved=await memoryStore.loadConversations();const activeId=await memoryStore.loadActiveConversationId();const updated=saved.map(c=>activeId&&c.id===activeId?{...c,messages:c.messages.map(m=>m.status==="streaming"&&m.generation?.type===type?{...m,content:message,status:"error",generation:undefined}:m),updatedAt:Date.now()}:c);await memoryStore.saveConversations(updated);window.dispatchEvent(new Event("ambi:conversation-sync"));}catch{}
   }finally{window.dispatchEvent(new Event(endName));busyRef.current=false;}
  };
  window.addEventListener("ambi:generate-media",generate); return()=>window.removeEventListener("ambi:generate-media",generate);
 },[]);
 return null;
}