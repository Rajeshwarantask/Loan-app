const CACHE_NAME = "vizhuthugal-sangam-v4"
const OFFLINE_URL = "/offline"

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/app-logo.png",
  "/icon-192.png",
  "/icon-512.png",
]

// INSTALL - FIX #1: Skip waiting immediately
self.addEventListener("install", (event) => {
  console.log("[SW] Installing")

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        // Skip waiting immediately to take control faster
        self.skipWaiting()
      })
  )
})

// ACTIVATE - FIX #1: Claim clients immediately
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
      .then(() => {
        // Claim all clients immediately
        self.clients.claim()
      })
  )
})

// FETCH
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  if (!event.request.url.startsWith("http")) return
  if (event.request.url.includes("supabase.co")) return

  // Navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // Static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
    })
  )
})

// PUSH NOTIFICATIONS
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event)

  if (!event.data) {
    console.log("[SW] No data in push event")
    return
  }

  try {
    const data = event.data.json()
    const { title, body, icon, badge, tag } = data

    const options = {
      body: body || "Vizhuthugal Sangam",
      icon: icon || "/icon-192.png",
      badge: badge || "/icon-192.png",
      tag: tag || "vizhuthugal-notification",
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: data,
    }

    event.waitUntil(self.registration.showNotification(title || "Vizhuthugal Sangam", options))
  } catch (error) {
    console.error("[SW] Error handling push event:", error)
    event.waitUntil(
      self.registration.showNotification("Vizhuthugal Sangam", {
        body: event.data.text(),
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      })
    )
  }
})

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.notification.tag)
  event.notification.close()

  const urlToOpen = event.notification.data?.url || "/"
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === urlToOpen && "focus" in clientList[i]) {
          return clientList[i].focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification.tag)
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
