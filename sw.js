// Station Météo — Service Worker
// Caches the app shell for instant loading and offline support.
// Weather data is always fetched live (never cached).
// All paths are relative to the SW location, so the app works
// whether served from the domain root or a subdirectory.

const CACHE_NAME = "station-meteo-v2";

const APP_SHELL = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "manifest.json",
  "sw.js",
  "assets/fonts/7segments.ttf",
  "assets/icons/192.png",
  "assets/icons/512.png",
  "assets/icons/apple-touch.png",
  "assets/icons/favicon.png",
];

// Install: cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network-only for API calls
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls or map tiles — always go to network
  if (
    url.hostname.includes("open-meteo.com") ||
    url.hostname.includes("openstreetmap.org") ||
    url.hostname.includes("unpkg.com")
  ) {
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful same-origin responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
