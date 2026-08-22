# Ambi

Ambi is a local-first AI chat application for the browser. The main model path uses WebLLM/WebGPU, so model inference can happen on the user's device without an Ambi AI server.

## Architecture

- **Local inference:** `lib/ai/engine.ts` loads `@mlc-ai/web-llm` dynamically.
- **Reasoning/context:** `lib/memory/context.ts` limits context size to reduce runaway memory use.
- **Safety firewall:** `lib/security/safety.ts` blocks a small set of clearly dangerous patterns and the system prompt enforces safe behavior. This is defense-in-depth, not a guarantee of perfect safety.
- **Persistent local memory:** IndexedDB via `lib/memory/store.ts`.
- **Self-recovery:** `lib/recovery/watchdog.ts` periodically checkpoints state while the page is alive; `app/error.tsx` isolates application crashes.
- **Web research:** optional server-side search proxy. It is off by default. Local AI can remain local while web research is disabled.
- **Security headers:** `middleware.ts` adds CSP and other browser hardening headers.

## Run

```bash
npm install
npm run dev