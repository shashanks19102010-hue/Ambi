# Ambi

Ambi is a privacy-first, local-first AI workspace for the browser. It combines Groq cloud chat, browser-local WebGPU/WASM inference, live research, Pexels photo/video search, local memory, recovery controls and a PWA shell.

## Architecture

- **Cloud AI:** Groq models with streaming, retries, abort handling and server-side API keys.
- **Vision:** Qwen 3.6 27B is used for image understanding when an image is attached.
- **Local inference:** WebLLM/WebGPU is preferred and Transformers.js/WASM is the CPU fallback.
- **Context control:** bounded message history, memory and tool-data budgets prevent runaway prompt growth.
- **Local memory:** IndexedDB with validation and bounded storage.
- **Research:** optional Tavily search with DuckDuckGo fallback; external text is explicitly treated as untrusted data.
- **Stock media:** Pexels is the only media provider. “Photos” and “Videos” search Pexels; Ambi does not silently call a media-generation provider.
- **Security:** server-only secrets, same-origin checks on sensitive POST routes, CSP/COOP/CORP, rate limiting and defense-in-depth prompt-injection checks.
- **Recovery:** local inference retries/reinitialization and cloud transient-error retries.
- **PWA:** manifest and service worker are included for installable browser use.

## Environment

Copy `.env.example` to `.env.local` and add only the services you actually use:

```text
GROQ_API_KEY=
AMBI_VISION_MODEL=qwen/qwen3.6-27b
AMBI_WEB_SEARCH_ENABLED=0
TAVILY_API_KEY=
PEXELS_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
AMBI_ALLOWED_ORIGIN=
```

No Pollinations or Puter credentials are required by the current application.

## Run

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Production hardening roadmap

The next major layer for Ambi is semantic/vector memory, a typed tool broker, sandboxed code execution, file ingestion/indexing, project workspaces, durable media assets, optional encrypted sync, richer E2E coverage and model-routing policies.