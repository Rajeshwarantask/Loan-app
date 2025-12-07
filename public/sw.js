const CACHE_NAME = "vizhuthugal-sangam-v1"
const OFFLINE_URL = "/offline"

const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/calculator",
  "/loans",
  "/notices",
  "/request-loan",
  "/contact",
  "/settings",
  "/offline",
  "/manifest.json",
  "/app-logo.png",
  "/icon-192.png",
  "/icon-512.png",
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...")
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static assets")
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.error("[SW] Failed to cache:", error)
        })
      })
      .then(() => {
        console.log("[SW] Service worker installed successfully")
      }),
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...")
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("[SW] Service worker activated successfully")
      }),
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return
  }

  // Skip Chrome extensions and other non-http(s) requests
  if (!event.request.url.startsWith("http")) {
    return
  }

  if (event.request.url.includes("supabase.co")) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === "error") {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          if (
            event.request.url.includes("/dashboard") ||
            event.request.url.includes("/loans") ||
            event.request.url.includes("/calculator") ||
            event.request.url.includes("/notices") ||
            event.request.url.includes("/settings")
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }

          return response
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL)
          }
        })
    }),
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
