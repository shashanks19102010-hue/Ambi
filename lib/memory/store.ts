import { DB_NAME, DB_VERSION, DEFAULT_CLOUD_MODEL_ID, MAX_CONVERSATIONS, MAX_MEMORIES, CLOUD_MODEL_CATALOG, STORE_NAME } from "@/lib/constants";
import type { AppSettings, Conversation, MemoryItem } from "@/types/chat";

type RecordValue={key:string;value:unknown};let dbPromise:Promise<IDBDatabase>|null=null;
function openDb():Promise<IDBDatabase>{if(typeof window==="undefined")return Promise.reject(new Error("Browser storage is unavailable."));if(dbPromise)return dbPromise;const opening:Promise<IDBDatabase>=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:"key"});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error("IndexedDB open failed."));});dbPromise=opening.catch(error=>{dbPromise=null;throw error;});return dbPromise;}
async function write<T>(key:string,value:T){const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE_NAME,"readwrite");tx.objectStore(STORE_NAME).put({key,value} satisfies RecordValue);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??new Error("Storage write failed."));});}
async function read<T>(key:string):Promise<T|null>{const db=await openDb();return new Promise((resolve,reject)=>{const request=db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).get(key);request.onsuccess=()=>resolve((request.result?.value as T|undefined)??null);request.onerror=()=>reject(request.error??new Error("Storage read failed."));});}
function persistableConversations(items:Conversation[]):Conversation[]{return items.slice(0,MAX_CONVERSATIONS).map(c=>({...c,messages:c.messages.map(m=>m.media?.transient?(()=>{const{media:_media,...rest}=m;return rest;})():m)}));}
const validConversations=(value:unknown):Conversation[]=>Array.isArray(value)?value.filter((item):item is Conversation=>Boolean(item&&typeof item.id==="string"&&typeof item.title==="string"&&Array.isArray(item.messages))).slice(0,MAX_CONVERSATIONS):[];
const validMemories=(value:unknown):MemoryItem[]=>Array.isArray(value)?value.filter((item):item is MemoryItem=>Boolean(item&&typeof item.id==="string"&&typeof item.text==="string"&&typeof item.createdAt==="number"&&typeof item.updatedAt==="number")).slice(-MAX_MEMORIES):[];
const normalizeSettings=(value:unknown):AppSettings|null=>{if(!value||typeof value!=="object")return null;const c=value as Partial<AppSettings>;const requested=typeof c.model==="string"?c.model:"";const model=CLOUD_MODEL_CATALOG.some(m=>m.id===requested)?requested:DEFAULT_CLOUD_MODEL_ID;return{model,webSearch:Boolean(c.webSearch),memoryEnabled:c.memoryEnabled!==false,responseStyle:c.responseStyle==="concise"||c.responseStyle==="detailed"||c.responseStyle==="expert"?c.responseStyle:"normal",language:c.language==="en"||c.language==="hi"||c.language==="hinglish"?c.language:"auto",theme:c.theme==="dark"||c.theme==="light"||c.theme==="oled"?c.theme:"system",reducedMotion:Boolean(c.reducedMotion),temporaryChat:Boolean(c.temporaryChat)};};
export const memoryStore={
 async loadConversations(){return validConversations(await read<unknown>("conversations"));},
 async saveConversations(items:Conversation[]){await write("conversations",persistableConversations(items));},
 async loadActiveConversationId(){return read<string>("activeConversationId");},
 async saveActiveConversationId(id:string|null){await write("activeConversationId",id);},
 async loadSettings(){return normalizeSettings(await read<unknown>("settings"));},
 async saveSettings(settings:AppSettings){await write("settings",settings);},
 async loadMemories(){return validMemories(await read<unknown>("memories"));},
 async saveMemories(items:MemoryItem[]){await write("memories",validMemories(items));},
 async saveSnapshot(conversations:Conversation[],settings:AppSettings){await write("snapshot",{conversations:persistableConversations(conversations),settings,createdAt:Date.now()});},
 async loadSnapshot(){return read<{conversations:Conversation[];settings:AppSettings;createdAt:number}>("snapshot");},
 async clearTemporary(){await write("memories",validMemories(await read<unknown>("memories")).filter(m=>!m.expiresAt||m.expiresAt>Date.now()));},
 async clearAll(){const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE_NAME,"readwrite");tx.objectStore(STORE_NAME).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??new Error("Storage clear failed."));});}
};