import { getPermissionLevel, type PermissionLevel } from "@/lib/security/permissions";

export interface ToolDefinition {
  name: string;
  permission: PermissionLevel;
  maxInputLength: number;
  timeoutMs: number;
  maxRetries: number;
}

const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  web_search: {
    name: "web_search",
    permission: getPermissionLevel("web_search"),
    maxInputLength: 300,
    timeoutMs: 8000,
    maxRetries: 1,
  },
  memory: {
    name: "memory",
    permission: getPermissionLevel("memory"),
    maxInputLength: 2000,
    timeoutMs: 5000,
    maxRetries: 0,
  },
  file_processor: {
    name: "file_processor",
    permission: getPermissionLevel("file_processor"),
    maxInputLength: 12000,
    timeoutMs: 15000,
    maxRetries: 1,
  },
  code_execution: {
    name: "code_execution",
    permission: getPermissionLevel("code_execution"),
    maxInputLength: 12000,
    timeoutMs: 10000,
    maxRetries: 0,
  },
};

export function getToolDefinition(name: string): ToolDefinition | null {
  return TOOL_REGISTRY[name] ?? null;
}

export function validateToolInput(name: string, input: string) {
  const definition = getToolDefinition(name);
  if (!definition) return { ok: false as const, reason: "Tool not registered." };
  const normalized = input.trim();
  if (!normalized) return { ok: false as const, reason: "Tool input is empty." };
  if (normalized.length > definition.maxInputLength) {
    return { ok: false as const, reason: `Tool input exceeds ${definition.maxInputLength.toLocaleString()} characters.` };
  }
  return { ok: true as const, definition, input: normalized };
}
