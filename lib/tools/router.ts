import { sanitizeExternalText } from "@/lib/security/safety";

export interface ToolResult {
  name: string;
  ok: boolean;
  text: string;
}

export async function runOptionalTool(
  name: string,
  input: string
): Promise<ToolResult> {
  if (name !== "web_search") {
    return {
      name,
      ok: false,
      text: "Unknown tool."
    };
  }

  try {
    const response =
      await fetch(
        `/api/search?q=${encodeURIComponent(
          input
        )}`,
        {
          signal:
            AbortSignal.timeout(8000)
        }
      );

    if (!response.ok) {
      return {
        name,
        ok: false,
        text:
          "Web search is unavailable."
      };
    }

    const data =
      (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
        }>;
      };

    const text =
      (data.results ?? [])
        .slice(0, 5)
        .map(
          (result) =>
            `${result.title ?? "Untitled"}\n` +
            `${result.url ?? ""}\n` +
            `${sanitizeExternalText(
              result.content ?? ""
            )}`
        )
        .join("\n\n");

    return {
      name,
      ok: true,
      text
    };
  } catch {
    return {
      name,
      ok: false,
      text:
        "Web search timed out or failed."
    };
  }
}