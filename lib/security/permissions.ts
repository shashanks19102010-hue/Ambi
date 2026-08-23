export type PermissionLevel = "safe" | "confirm" | "restricted";

const TOOL_PERMISSIONS: Record<string, PermissionLevel> = {
  web_search: "safe",
  memory: "confirm",
  file_processor: "confirm",
  code_execution: "restricted",
};

export function getPermissionLevel(name: string): PermissionLevel {
  return TOOL_PERMISSIONS[name] ?? "restricted";
}

export function isAutoRunnable(name: string): boolean {
  return getPermissionLevel(name) === "safe";
}

export function requiresConfirmation(name: string): boolean {
  return getPermissionLevel(name) === "confirm";
}
