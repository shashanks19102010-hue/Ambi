export type Role = "system" | "user" | "assistant" | "tool";
export type MessageStatus = "complete" | "streaming" | "error";

export interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  branchId?: string;
  source?: "local" | "web" | "tool" | "cloud";
  citations?: Citation[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  archived?: boolean;
  favorite?: boolean;
  tags?: string[];
  projectId?: string;
}

export type ResponseStyle = "concise" | "normal" | "detailed" | "expert";
export type AppLanguage = "auto" | "en" | "hi" | "hinglish";
export type Theme = "light" | "dark" | "system" | "oled";

export interface AppSettings {
  model: string;
  webSearch: boolean;
  safetyMode: "strict" | "balanced";
  memoryEnabled: boolean;
  autoRecover: boolean;
  localOnly: boolean;
  responseStyle: ResponseStyle;
  language: AppLanguage;
  theme: Theme;
  reducedMotion: boolean;
  temporaryChat: boolean;
  developerMode: boolean;
}

export interface MemoryItem {
  id: string;
  kind: "preference" | "project" | "context" | "temporary";
  text: string;
  createdAt: number;
  updatedAt: number;
  sourceConversationId?: string;
  expiresAt?: number;
  approved: boolean;
}

export interface ToolResult {
  name: string;
  ok: boolean;
  text: string;
  source?: string;
  citations?: Citation[];
}

export interface HealthState {
  inference: "ready" | "loading" | "unavailable" | "error";
  storage: "ready" | "degraded";
  network: "online" | "offline";
  recovery: "idle" | "recovering" | "safe" | "failed";
  lastRecoveryAt: number | null;
  safeMode: boolean;
  webSearch: "ready" | "disabled" | "error";
}

export interface CapabilityState {
  webgpu: boolean;
  wasm: boolean;
  cores: number;
  memoryGb: number | null;
  storageGb: number | null;
  tier: "Basic" | "Standard" | "Powerful" | "High Performance";
  online: boolean;
}
