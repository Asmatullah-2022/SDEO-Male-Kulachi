/**
 * Minimal, conservative service worker: it only ever exists to (a) satisfy
 * Chrome's Android install criteria (a registered SW with a fetch handler)
 * and (b) cache the static app shell (hashed /_next/static assets, icons,
 * manifest) so the app opens instantly and has an offline fallback screen.
 *
 * It deliberately never touches anything else:
 *  - Non-GET requests (all Supabase auth/session/database calls, and every
 *    app write) are skipped outright — never cached, never intercepted.
 *  - Cross-origin requests (Supabase's own domain) are skipped — the
 *    browser handles them exactly as if this SW didn't exist.
 *  - Same-origin /api/* routes are always network-only — never cached.
 *  - Page navigations are always network-first (so auth/role checks in
 *    middleware always run against a live request); only when the network
 *    is unreachable do we fall back to the cached offline screen.
 */

const CACHE_NAME = "sdeo-kulachi-shell-v1";
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept writes/auth calls — Supabase sign-in, session refresh,
  // and every data mutation must always hit the network directly.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (Supabase, fonts, etc.) — leave completely untouched.
  if (url.origin !== self.location.origin) return;

  // Server API routes — always network-only, never cached.
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations — network-first, offline-page fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Static assets (hashed /_next/static files, icons, manifest, images) —
  // cache-first, then fall back to network and store a copy for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
