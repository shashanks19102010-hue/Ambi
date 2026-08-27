import { isAutoRunnable } from "@/lib/security/permissions";
import { scanExternalContent } from "@/lib/security/safety";
import { getToolDefinition, validateToolInput } from "@/lib/tools/registry";
import type { ToolResult } from "@/types/chat";

export async function runOptionalTool(name: string, input: string): Promise<ToolResult> {
  const validation = validateToolInput(name, input);
  if (!validation.ok) return { name, ok: false, text: validation.reason };
  if (!getToolDefinition(name)) return { name, ok: false, text: "Tool not registered." };
  if (!isAutoRunnable(name)) return { name, ok: false, text: "This tool requires confirmation before it can run." };
  if (name !== "web_search") return { name, ok: false, text: "Tool is registered but not enabled yet." };

  const { definition } = validation;
  let attempt = 0;
  while (attempt <= definition.maxRetries) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(validation.input.slice(0, definition.maxInputLength))}`, {
        signal: AbortSignal.timeout(definition.timeoutMs),
        headers: { "X-Ambi-Tool": "web-search" },
      });
      const data = (await response.json().catch(() => ({}))) as { results?: Array<{ title?: string; url?: string; content?: string; snippet?: string }>; disabled?: boolean };
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        if (retryable && attempt < definition.maxRetries) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, Math.min(4000, 500 * 2 ** (attempt - 1))));
          continue;
        }
        return { name, ok: false, text: data.disabled ? "Web research is disabled. Enable it in Settings." : "Web research is unavailable right now." };
      }
      const warnings = new Set<string>();
      const items = (data.results ?? []).slice(0, 6).map((result) => {
        const scan = scanExternalContent(result.content ?? result.snippet ?? "");
        scan.warnings.forEach((warning) => warnings.add(warning));
        return { title: result.title ?? "Untitled", url: result.url ?? "", snippet: scan.sanitized };
      });
      const warningText = warnings.size ? `\n\nSAFETY NOTICE — ${[...warnings].join(" ")}` : "";
      return { name, ok: true, text: `${items.map((item, index) => `[${index + 1}] ${item.title}\n${item.url}\n${item.snippet}`).join("\n\n")}${warningText}`, citations: items };
    } catch {
      if (attempt >= definition.maxRetries) return { name, ok: false, text: "Web research timed out or failed. Local AI remains available." };
      attempt += 1;
    }
  }
  return { name, ok: false, text: "Web research failed safely after the configured retry limit." };
}
