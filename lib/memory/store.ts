import { DB_NAME, DB_VERSION, DEFAULT_CLOUD_MODEL_ID, MAX_CONVERSATIONS, CLOUD_MODEL_CATALOG, STORE_NAME } from "@/lib/constants";
import { DEFAULT_PUTER_IMAGE_MODEL, DEFAULT_PUTER_VIDEO_MODEL, normalizeMediaModel } from "@/lib/media/puter-models";
import type { AppSettings, Conversation, MemoryItem } from "@/types/chat";

type RecordValue = { key: string; value: unknown };
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser storage is unavailable."));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
  }).catch((error) => { dbPromise = null; throw error; });
  return dbPromise;
}

async function write<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ key, value } satisfies RecordValue);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Storage write failed."));
  });
}

async function read<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise<T | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result?.value as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Storage read failed."));
  });
}

const validConversations = (value: unknown): Conversation[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Conversation => Boolean(item && typeof item.id === "string" && Array.isArray(item.messages))).slice(0, MAX_CONVERSATIONS);
};

const normalizeSettings = (value: unknown): AppSettings | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AppSettings>;
  const requestedModel = typeof candidate.model === "string" ? candidate.model : "";
  const model = CLOUD_MODEL_CATALOG.some((item) => item.id === requestedModel) ? requestedModel : DEFAULT_CLOUD_MODEL_ID;
  return {
    model,
    imageModel: normalizeMediaModel(typeof candidate.imageModel === "string" ? candidate.imageModel : DEFAULT_PUTER_IMAGE_MODEL, "image"),
    videoModel: normalizeMediaModel(typeof candidate.videoModel === "string" ? candidate.videoModel : DEFAULT_PUTER_VIDEO_MODEL, "video"),
    webSearch: Boolean(candidate.webSearch),
    safetyMode: candidate.safetyMode === "balanced" ? "balanced" : "strict",
    memoryEnabled: candidate.memoryEnabled !== false,
    autoRecover: candidate.autoRecover !== false,
    localOnly: Boolean(candidate.localOnly),
    responseStyle: candidate.responseStyle === "concise" || candidate.responseStyle === "detailed" || candidate.responseStyle === "expert" ? candidate.responseStyle : "normal",
    language: candidate.language === "en" || candidate.language === "hi" || candidate.language === "hinglish" ? candidate.language : "auto",
    theme: candidate.theme === "dark" || candidate.theme === "light" || candidate.theme === "oled" ? candidate.theme : "system",
    reducedMotion: Boolean(candidate.reducedMotion),
    temporaryChat: Boolean(candidate.temporaryChat),
    developerMode: Boolean(candidate.developerMode),
  };
};

export const memoryStore = {
  async loadConversations() { return validConversations(await read<unknown>("conversations")); },
  async saveConversations(items: Conversation[]) { await write("conversations", items.slice(0, MAX_CONVERSATIONS)); },
  async loadActiveConversationId() { return read<string>("activeConversationId"); },
  async saveActiveConversationId(id: string | null) { await write("activeConversationId", id); },
  async loadSettings() { return normalizeSettings(await read<unknown>("settings")); },
  async saveSettings(settings: AppSettings) { await write("settings", settings); },
  async loadMemories() { return (await read<MemoryItem[]>("memories")) ?? []; },
  async saveMemories(items: MemoryItem[]) { await write("memories", items); },
  async saveSnapshot(conversations: Conversation[], settings: AppSettings) { await write("snapshot", { conversations, settings, createdAt: Date.now() }); },
  async loadSnapshot() { return read<{ conversations: Conversation[]; settings: AppSettings; createdAt: number }>("snapshot"); },
  async clearTemporary() { await write("memories", (await read<MemoryItem[]>("memories") ?? []).filter((item) => !item.expiresAt || item.expiresAt > Date.now())); },
  async clearAll() {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Storage clear failed."));
    });
  },
};
