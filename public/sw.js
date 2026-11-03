/* Cache only public installation assets. Never persist private HTML or API responses. */
const LIFEHUB_CACHE = "lifehub-public-v4";
const PUBLIC_ASSETS = ["/offline.html", "/icon-192.png", "/icon-512.png", "/icon-maskable.png", "/apple-touch-icon.png", "/icon.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(LIFEHUB_CACHE).then(cache => cache.addAll(PUBLIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("lifehub-public-") && key !== LIFEHUB_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
  } else if (PUBLIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
