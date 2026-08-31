# Ambi

Ambi is a calm, local-first AI workspace for the browser. The project supports local WebLLM/WebGPU inference while the current default chat UI uses the optional Groq cloud route for stronger models and reliability. No cloud provider key is required for the local engine itself.

## Architecture

- **Local inference:** `lib/ai/engine.ts` dynamically loads `@mlc-ai/web-llm`, prefers WebGPU, falls back to WASM/CPU, and now retries/reinitializes local inference failures.
- **Context control:** `lib/memory/context.ts` bounds message count and character budget so long conversations do not grow without limit.
- **Persistent local memory:** IndexedDB via `lib/memory/store.ts`.
- **Recovery:** `lib/recovery/watchdog.ts` checkpoints storage every 30s, retries health checks with exponential backoff, records recovery events, and exposes `HealthState` to the UI. `app/error.tsx` isolates React render crashes.
- **Cloud reliability:** `lib/ai/cloud.ts` retries transient network/provider errors up to three times and detects incomplete streams. The chat route also applies server-side request limiting.
- **Stock media:** optional Pexels photo/video search runs through a server-side proxy; the API key is never exposed to the browser.
- **Web research:** the server proxy is **fail-closed**. It only runs when `AMBI_WEB_SEARCH_ENABLED=1`; the default example is `0`. Tavily is used when configured, otherwise the explicitly enabled mode can use DuckDuckGo as its fallback.
- **Security headers:** the single source of truth is `next.config.ts`. It sets CSP, COOP, CORP, Permissions-Policy, X-Frame-Options, and related hardening headers. `wasm-unsafe-eval` is used instead of general `unsafe-eval` for WebAssembly compatibility.
- **Safety firewall:** `lib/security/safety.ts` is defense-in-depth only. It blocks a small set of obvious high-risk patterns and common prompt-injection phrases; it is not a complete safety system.
- **Diagnostics:** Settings exposes health state, network state, recovery state and the last recovery time.

## Environment

Copy `.env.example` to `.env.local` and add only the secrets you actually use. Keep real secrets out of Git.

## Run

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Notes

Sensitive API routes use a shared Upstash REST rate limiter when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, with a bounded in-memory fallback when they are not. Sensitive POST routes also enforce same-origin requests.
