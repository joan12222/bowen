// Hand-written cache-first Service Worker for 博文.
//
// This app is local-first (all data lives in OPFS via wa-sqlite) and rarely
// needs the network, so the traditional "network-first, fall back to cache"
// PWA pattern is unnecessary complexity here. Cache-first keeps things fast,
// simple, and fully offline-capable once the shell has been visited once.
//
// IMPORTANT: bump CACHE_VERSION on every release that changes any cached
// asset (JS/CSS/HTML/icons/wasm) — this is what forces clients to fetch fresh
// files instead of serving stale ones forever from cache-first.
const CACHE_VERSION = "v4"
const CACHE_NAME = `bowen-${CACHE_VERSION}`

// Small set of known-stable paths worth precaching eagerly on install. The
// rest of the Next.js static export (hashed JS/CSS chunks, route HTML) gets
// cached opportunistically as the user navigates — see the fetch handler.
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline and not cached: for page navigations, fall back to the
          // cached app shell so the PWA still opens (data loads from OPFS).
          if (request.mode === "navigate") return caches.match("/")
          return undefined
        })
    })
  )
})
