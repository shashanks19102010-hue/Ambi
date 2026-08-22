import type { Message } from "@/types/chat";

export interface LocalEngine {
  load(
    onProgress?: (value: number) => void
  ): Promise<void>;

  chat(
    messages: Message[]
  ): AsyncGenerator<string>;

  unload(): Promise<void>;
}

let enginePromise:
  | Promise<LocalEngine>
  | null = null;

export async function getLocalEngine(
  model: string
): Promise<LocalEngine> {
  if (enginePromise) {
    return enginePromise;
  }

  enginePromise = (async () => {
    const webllm =
      await import("@mlc-ai/web-llm");

    const created =
      await webllm.CreateMLCEngine(
        model,
        {
          initProgressCallback: (report) => {
            const pct =
              typeof report.progress ===
              "number"
                ? report.progress
                : 0;

            window.dispatchEvent(
              new CustomEvent(
                "ambi:model-progress",
                {
                  detail: pct
                }
              )
            );
          }
        }
      );

    return {
      async load() {},

      async *chat(
        messages: Message[]
      ) {
        const response =
          await created.chat.completions.create(
            {
              messages: messages.map(
                ({
                  role,
                  content
                }) => ({
                  role,
                  content
                })
              ),
              stream: true,
              temperature: 0.3,
              max_tokens: 1200
            }
          );

        for await (
          const chunk of response
        ) {
          const delta =
            chunk.choices[0]
              ?.delta
              ?.content ?? "";

          if (delta) {
            yield delta;
          }
        }
      },

      async unload() {
        await created.unload();
      }
    } satisfies LocalEngine;
  })();

  try {
    return await enginePromise;
  } catch (error) {
    enginePromise = null;
    throw error;
  }
}