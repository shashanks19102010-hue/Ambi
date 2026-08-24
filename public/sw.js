const CACHE = "ambi-shell-v3";
const APP_SHELL = ["/manifest.webmanifest", "/ambi-logo.png"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (event) => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const clone = response.clone(); void caches.open(CACHE).then((cache) => cache.put("/", clone)); return response; }).catch(() => caches.match("/")));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => { if (response.ok && response.type === "basic") { const clone = response.clone(); void caches.open(CACHE).then((cache) => cache.put(request, clone)); } return response; })));
});
