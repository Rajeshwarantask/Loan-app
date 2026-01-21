const CACHE_NAME = "vizhuthugal-sangam-v4"
const OFFLINE_URL = "/offline"

/**
 * ✅ ONLY truly static files here
 * ❌ NO Next.js routes
 */
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/app-logo.png",
  "/icon-192.png",
  "/icon-512.png",
]

// INSTALL
self.addEventListener("install", (event) => {
  console.log("[SW] Installing")

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ACTIVATE
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating")

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
          })
        )
      )
      .then(() => self.clients.claim())
  )
})

// FETCH
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  if (!event.request.url.startsWith("http")) return
  if (event.request.url.includes("supabase.co")) return

  // ✅ Navigation requests (MOST IMPORTANT)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // ✅ Static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
    })
  )
})

// OPTIONAL MESSAGE HANDLER
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
