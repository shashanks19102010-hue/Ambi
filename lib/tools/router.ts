import { sanitizeExternalText } from "@/lib/security/safety";
import type { ToolResult } from "@/types/chat";

const TOOL_TIMEOUT = 8000;

export async function runOptionalTool(name: string, input: string): Promise<ToolResult> {
  if (name !== "web_search") return { name, ok: false, text: "Tool not available." };
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(input.slice(0, 300))}`, { signal: AbortSignal.timeout(TOOL_TIMEOUT), headers: { "X-Ambi-Tool": "web-search" } });
    const data = (await response.json().catch(() => ({}))) as { results?: Array<{ title?: string; url?: string; content?: string; snippet?: string }>; disabled?: boolean };
    if (!response.ok) return { name, ok: false, text: data.disabled ? "Web research is disabled. Enable it in Settings." : "Web research is unavailable right now." };
    const items = (data.results ?? []).slice(0, 6).map((result) => ({ title: result.title ?? "Untitled", url: result.url ?? "", snippet: sanitizeExternalText(result.content ?? result.snippet ?? "") }));
    return { name, ok: true, text: items.map((item, index) => `[${index + 1}] ${item.title}\n${item.url}\n${item.snippet}`).join("\n\n"), citations: items };
  } catch {
    return { name, ok: false, text: "Web research timed out or failed. Local AI remains available." };
  }
}
