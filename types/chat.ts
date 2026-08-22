export type Role =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?:
    | "complete"
    | "streaming"
    | "error";
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  model: string;
  webSearch: boolean;
  safetyMode:
    | "strict"
    | "balanced";
  memoryEnabled: boolean;
  autoRecover: boolean;
}

export interface HealthState {
  inference:
    | "ready"
    | "loading"
    | "unavailable"
    | "error";

  storage:
    | "ready"
    | "degraded";

  lastRecoveryAt:
    | number
    | null;

  safeMode: boolean;
}