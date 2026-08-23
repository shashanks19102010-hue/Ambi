const CACHE = "ambi-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/ambi-logo.png"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => { const request = event.request; if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return; event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => { const clone = response.clone(); void caches.open(CACHE).then((cache) => cache.put(request, clone)); return response; }).catch(() => caches.match("/")))); });
